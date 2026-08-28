#!/bin/bash
set -euo pipefail

APP_DIR="${APP_DIR:-$HOME/isac-app}"
if [[ ! -d "$APP_DIR" && -d "/home/misbahul45/code/ISAC-2026" ]]; then
  APP_DIR="/home/misbahul45/code/ISAC-2026"
fi
cd "$APP_DIR" || { echo "ERROR: APP_DIR tidak ditemukan: $APP_DIR"; exit 1; }

red()   { printf "\033[0;31m%s\033[0m\n" "$*"; }
green() { printf "\033[0;32m%s\033[0m\n" "$*"; }
yellow(){ printf "\033[0;33m%s\033[0m\n" "$*"; }
info()  { printf "=== %s ===\n" "$*"; }

CANDIDATES=(
  "/opt/alt/php83/usr/bin/php"
  "/opt/alt/php82/usr/bin/php"
  "/opt/alt/php84/usr/bin/php"
  "/usr/local/bin/php"
  "/usr/bin/php"
  "$(command -v php 2>/dev/null || echo /usr/bin/php)"
)

php_bin=""
php_found=""
for p in "${CANDIDATES[@]}"; do
  [[ -x "$p" ]] || continue
  php_found="$p"
  if "$p" -m 2>/dev/null | grep -qi "^fileinfo"; then
    if "$p" -r 'exit(version_compare(PHP_VERSION, "8.2.0", ">=") ? 0 : 1);' 2>/dev/null; then
      php_bin="$p"
      break
    fi
  fi
done

if [[ -z "$php_bin" ]]; then
  for p in "${CANDIDATES[@]}"; do
    if [[ -x "$p" ]]; then
      php_bin="$p"
      break
    fi
  done
fi

if [[ -z "$php_bin" || ! -x "$php_bin" ]]; then
  red "FATAL: Tidak menemukan binary PHP yang executable."
  echo "Cek kandidat: ${CANDIDATES[*]}"
  exit 1
fi

echo "PHP binary terpilih: $php_bin"
"$php_bin" -v | head -n1
echo "php.ini loaded: $("$php_bin" --ini 2>&1 | grep "Loaded Configuration")"

composer_bin=""
for c in "/usr/local/bin/composer" "/opt/alt/php83/usr/bin/composer" "$(command -v composer 2>/dev/null || echo "")"; do
  [[ -x "$c" ]] && composer_bin="$c" && break
  [[ -f "$c" ]] && composer_bin="$c" && break
done
if [[ -z "$composer_bin" ]]; then
  composer_bin="composer"
fi
echo "Composer binary: $composer_bin ($("$php_bin" "$composer_bin" --version 2>&1 | head -n1 || echo "not found"))"

info "Preflight check: ext-fileinfo"
if ! "$php_bin" -m 2>/dev/null | grep -qi "^fileinfo"; then
  red "ERROR: ext-fileinfo TIDAK AKTIF pada $php_bin"
  echo ""
  yellow "Dampak:"
  echo "  league/flysystem 3.35.3, league/flysystem-local 3.35.3, league/mime-type-detection 1.17.0"
  echo "  semuanya require ext-fileinfo * (lihat composer.lock:1829,1894,1943)"
  echo "  -> composer install SELALU gagal tanpa fileinfo."
  echo ""
  yellow "FIX PERMANEN (wajib di Brianza/cPanel shared hosting):"
  echo "  1. Login cPanel Brianza -> 'Select PHP Version' (atau 'MultiPHP Manager' -> 'Options' -> 'Extensions')"
  echo "  2. Pilih versi PHP 8.3 (alt-php83) — sesuai composer.json require php ^8.2 + Laravel 12"
  echo "  3. Centang ekstensi 'fileinfo' -> Save"
  echo "  4. Verifikasi SSH: /opt/alt/php83/usr/bin/php -m | grep fileinfo  (harus muncul 'fileinfo')"
  echo "  5. Jalankan ulang ./deploy.sh"
  echo ""
  echo "  Alternatif (jika tidak ada akses cPanel, butuh admin hosting):"
  echo "    - Minta admin aktifkan ext-fileinfo untuk alt-php83 via EasyApache 4 / CageFS"
  echo "    - Atau arahkan deploy ke binary lain yang sudah aktif: /usr/bin/php -m | grep fileinfo"
  echo ""
  yellow "WORKAROUND SEMENTARA (tidak direkomendasikan, hanya darurat):"
  echo "  $php_bin $composer_bin install --no-dev --optimize-autoloader --ignore-platform-req=ext-fileinfo"
  echo "  WARNING: Filesystem/mime detection bisa error runtime tanpa fileinfo."
  echo ""
  if [[ "${ALLOW_IGNORE_PLATFORM_REQ:-}" == "1" ]]; then
    yellow "ALLOW_IGNORE_PLATFORM_REQ=1 terdeteksi -> melanjutkan dengan --ignore-platform-req=ext-fileinfo"
    COMPOSER_EXTRA_ARGS="--ignore-platform-req=ext-fileinfo"
  else
    red "Deploy dihentikan. Aktifkan fileinfo dulu, atau jalankan:"
    echo "  ALLOW_IGNORE_PLATFORM_REQ=1 ./deploy.sh   # untuk bypass darurat"
    exit 1
  fi
else
  green "OK: ext-fileinfo aktif pada $php_bin"
  COMPOSER_EXTRA_ARGS=""
fi

if ! "$php_bin" -r 'exit(version_compare(PHP_VERSION, "8.2.0", ">=") ? 0 : 1);'; then
  red "ERROR: PHP version < 8.2, but composer.json requires ^8.2 (Laravel 12). Upgrade alt-php."
  exit 1
fi

cleanup_on_error() {
  local ec=$?
  red "Deploy gagal (exit $ec). Mengembalikan maintenance mode OFF agar site tidak stuck..."
  "$php_bin" artisan up 2>/dev/null || true
  exit $ec
}
trap cleanup_on_error ERR

info "Maintenance mode ON"
"$php_bin" artisan down --render="errors::503" --retry=60 2>/dev/null || "$php_bin" artisan down || true

info "Git pull"
git rev-parse --short HEAD 2>/dev/null || true
git pull origin main

info "Composer install"
if [[ -n "${COMPOSER_EXTRA_ARGS:-}" ]]; then
  "$php_bin" "$composer_bin" install --no-dev --optimize-autoloader --no-interaction $COMPOSER_EXTRA_ARGS
else
  "$php_bin" "$composer_bin" install --no-dev --optimize-autoloader --no-interaction
fi

info "NPM install & build"
if [[ -f package-lock.json ]]; then
  npm ci || npm install
else
  npm install
fi
npm run build

info "Migration"
"$php_bin" artisan migrate --force

info "Clear cache"
"$php_bin" artisan config:clear || true
"$php_bin" artisan route:clear || true
"$php_bin" artisan view:clear || true
"$php_bin" artisan cache:clear || true
"$php_bin" artisan event:clear 2>/dev/null || true

info "Rebuild cache"
"$php_bin" artisan config:cache || yellow "config:cache skip (mungkin .env belum lengkap)"
"$php_bin" artisan route:cache || yellow "route:cache skip"
"$php_bin" artisan view:cache || yellow "view:cache skip"

info "Restart queue"
"$php_bin" artisan queue:restart || true

trap - ERR
info "Maintenance mode OFF"
"$php_bin" artisan up

green "Deploy selesai: $(date)"
echo "PHP: $("$php_bin" -v | head -n1)"
echo "Commit: $(git rev-parse --short HEAD 2>/dev/null || echo unknown)"
