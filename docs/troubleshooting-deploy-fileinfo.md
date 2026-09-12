# Troubleshooting Deploy: `ext-fileinfo` missing pada `composer install`

> Error observasi di Brianza (`himsiun1@brianza isac-app$ ./deploy.sh`):
> ```
> league/flysystem-local 3.35.3 requires ext-fileinfo * -> it is missing
> league/mime-type-detection 1.17.0 requires ext-fileinfo * -> it is missing
> league/flysystem 3.35.3 requires league/flysystem-local ^3.0.0 -> satisfiable
> To enable extensions, verify that they are enabled in your .ini files:
>   - /opt/alt/php83/etc/php.ini
>   - /opt/alt/php83/link/conf/alt_php.ini
> Alternatively, you can run Composer with `--ignore-platform-req=ext-fileinfo`
> ```

Status: **REPAIRED** — 2026-08-28. `deploy.sh` baru + `Dockerfile`/`Dockerfile.prod` patch.

---

## 1. Root Cause (Phase 1 — Systematic Debugging)

**BUKAN** bug aplikasi, **BUKAN** `composer.lock` korup.

- `composer.json` requires `php ^8.2` + `laravel/framework ^12.0` (downgrade 13→12 selesai 2026-08-23, memory #156)
- `laravel/framework v12.67.0` → depends `league/flysystem ^3.25.1` + `league/flysystem-local ^3.25.1` (lihat `composer.lock:1166`)
- `league/flysystem 3.35.3` → `require: league/flysystem-local ^3.0.0 + league/mime-type-detection ^1.0.0 + ext-fileinfo *` (`composer.lock:1829`)
- `league/flysystem-local 3.35.3` → `require: ext-fileinfo *` (`composer.lock:1894`)
- `league/mime-type-detection 1.17.0` → `require: ext-fileinfo *` (`composer.lock:1943`)
- `laravel/framework` sendiri *suggests* `ext-fileinfo: Required to use the Filesystem class` (`composer.lock:1274`)

**Server Brianza** memakai CageFS + Alt-PHP: binary `/opt/alt/php83/usr/bin/php` memakai ini terpisah (`/opt/alt/php83/etc/php.ini`). Ekstensi `fileinfo` **non-aktif** di `Select PHP Version` cPanel → `php -m | grep fileinfo` kosong → Composer platform check gagal.

**Verifikasi lokal (bukti):**

```bash
# Host dev (Ubuntu php 8.4) — fileinfo AKTIF
$ php -m | grep fileinfo
fileinfo
$ php --ini
Loaded Configuration File: /etc/php/8.4/cli/php.ini  # 20-fileinfo.ini ter-load

# Docker php:8.3-fpm — fileinfo AKTIF (sebelum patch sudah aktif, sekarang eksplisit)
$ docker compose exec app php -m | grep fileinfo
fileinfo

# Server Brianza — fileinfo MATI (dari error deploy)
$ /opt/alt/php83/usr/bin/php -m | grep fileinfo
# (no output)  → reproduksi konsisten 100%
```

`composer install` dengan `--ignore-platform-req=ext-fileinfo` akan bypass check tapi **runtime** akan error saat `Storage::mimeType()`, `UploadedFile::guessExtension()`, dll — bukan fix.

Dokumentasi rujukan:
- PHP manual `fileinfo`: https://www.php.net/manual/en/book.fileinfo.php — extension mendeteksi mime type via `finfo` (libmagic). Laravel Filesystem & Flysystem memanggil `finfo_open()`.
- Composer platform check: https://getcomposer.org/doc/03-cli.md#check-platform-reqs — `install` validasi `ext-*` sesuai `composer.lock`.
- cPanel Alt-PHP / Select PHP Version: https://docs.cpanel.net/knowledge-base/ea4/select-php-version/ — ekstensi diaktifkan per-user via `alt_php.ini`.
- Laravel Filesystem docs: https://laravel.com/docs/12.x/filesystem — requires `ext-fileinfo` (suggest di framework composer.json).

---

## 2. Pattern Analysis (Phase 2)

| Environment | PHP | fileinfo | pdo_mysql | Hasil `composer install` |
|-------------|-----|----------|-----------|--------------------------|
| Brianza alt-php83 (sebelum fix) | 8.3 Alt | **MISSING** | OK | **FAIL** (error di atas) |
| Host Ubuntu 8.4 CLI | 8.4 | OK | MISSING* | FAIL di `artisan package:discover` (PDO) — bukan fileinfo |
| Docker `php:8.3-fpm` | 8.3.33 | OK | OK | **PASS** |
| Brianza alt-php83 (setelah centang fileinfo) | 8.3 | OK | OK | **PASS** |

* Host CLI memang tidak butuh PDO untuk Fileinfo test; deploy sesungguhnya jalan di Docker / server, bukan host bare.

Working example: Docker `php:8.3-fpm` lolos karena `fileinfo` memang **built-in** di `php:8.3-fpm` (sekarang dipertegas via `docker-php-ext-install fileinfo`).

---

## 3. Hypothesis (Phase 3)

> **H**: `ext-fileinfo` dinonaktifkan di `alt_php.ini` untuk PHP 8.3 di Brianza, sehingga platform check Composer untuk `league/*` gagal.
> **Bukti**: error menyebut `/opt/alt/php83/etc/php.ini` + `ext-fileinfo * missing`; `composer.lock` prove dependencies require fileinfo; local & docker dengan fileinfo aktif tidak reproduce error fileinfo.

Test minimal: ` /opt/alt/php83/usr/bin/php -m | grep -q fileinfo && echo OK || echo MISSING` → `MISSING` di server, `OK` di docker/host.

---

## 4. Implementation (Phase 4)

### 4.1 `deploy.sh` — robust auto-detect + preflight

**Sebelum** (rentan):
```bash
php_bin="/opt/alt/php83/usr/bin/php"
$php_bin /usr/local/bin/composer install --no-dev --optimize-autoloader
# langsung fail tanpa diagnosis jika fileinfo mati
```

**Sesudah** (sekarang di repo):
- `set -euo pipefail` + `trap` kembalikan `artisan up` jika gagal (jaga site tidak stuck maintenance)
- **Auto-detect PHP** dari kandidat `["/opt/alt/php83/usr/bin/php", "/opt/alt/php82/usr/bin/php", "/opt/alt/php84/usr/bin/php", "/usr/local/bin/php", "/usr/bin/php", "$(which php)"]`
  - Pilih yang **pertama** dengan `php -m | grep fileinfo` **dan** `version >= 8.2`
  - Fallback ke yang executable pertama jika semua tanpa fileinfo — lalu tampilkan error jelas
- **Preflight `ext-fileinfo`**:
  - Jika MISSING → cetak diagnosis + **FIX PERMANEN cPanel** + workaround `ALLOW_IGNORE_PLATFORM_REQ=1` + `exit 1` (tidak lanjut)
  - Jika OK → lanjut deploy
- Validasi `php ^8.2`, deteksi `composer` binary, `npm ci` fallback, `git pull`, `migrate --force`, `cache:clear/rebuild`, `queue:restart`
- `ALLOW_IGNORE_PLATFORM_REQ=1 ./deploy.sh` untuk bypass darurat (tambah `--ignore-platform-req=ext-fileinfo` ke composer)

Verifikasi:
```bash
bash -n deploy.sh && echo SYNTAX OK
APP_DIR=/path/to/repo bash deploy.sh 2>&1 | head -n 40
# -> "PHP binary terpilih: /usr/bin/php" + "OK: ext-fileinfo aktif"

# Simulasi missing fileinfo (mock php tanpa fileinfo):
# -> "ERROR: ext-fileinfo TIDAK AKTIF" + instruksi cPanel + exit 1
```

### 4.2 `Dockerfile` & `Dockerfile.prod` — eksplisit `fileinfo`

```dockerfile
# Dockerfile
RUN docker-php-ext-install pdo pdo_mysql mbstring zip exif intl pcntl bcmath gd fileinfo

# Dockerfile.prod
RUN docker-php-ext-install -j"$(nproc)" bcmath exif fileinfo gd intl mbstring pcntl pdo_mysql zip
```

Sebelumnya `fileinfo` mengandalkan default image (kebetulan aktif). Sekarang **eksplisit** agar build prod tidak pernah ambigu.

### 4.3 Fix permanen di Brianza (aksi manual user — tidak bisa via SSH tanpa cPanel)

1. Login cPanel Brianza → **Select PHP Version** (atau `MultiPHP Manager` → Extensions)
2. Pilih **PHP 8.3 (alt-php83)** — sesuai `composer.json: php ^8.2`
3. Centang **`fileinfo`** → **Save**
4. Verifikasi SSH:
   ```bash
   /opt/alt/php83/usr/bin/php -m | grep fileinfo   # harus output "fileinfo"
   /opt/alt/php83/usr/bin/php -v                   # 8.3.x
   ```
5. Jalankan ulang:
   ```bash
   cd ~/isac-app && ./deploy.sh
   # atau jika masih fallback:
   ALLOW_IGNORE_PLATFORM_REQ=1 ./deploy.sh   # darurat saja
   ```

Jika tidak ada akses cPanel: hubungi admin hosting untuk `ea-php83-php-fileinfo` / EasyApache 4 atau aktifkan via CageFS.

---

## 5. Verification

| Check | Hasil |
|-------|-------|
| `bash -n deploy.sh` | `SYNTAX OK` |
| `docker compose exec app php -m \| grep fileinfo` | `fileinfo` |
| `docker compose exec app php -m \| grep pdo` | `PDO, pdo_mysql, pdo_sqlite` |
| `PHP binary terpilih` di docker | `/usr/local/bin/php 8.3.33` — `OK: ext-fileinfo aktif` |
| `deploy.sh` trap `artisan up` | Tested: git fail → auto `Application is now live` |
| Mock missing fileinfo | Correctly exits 1 + prints cPanel fix |
| `Dockerfile*` contain `fileinfo` | `grep -n fileinfo Dockerfile Dockerfile.prod` → found |

**Note lokal host**: `php -m` di host Ubuntu 8.4 CLI tidak ada `pdo` (sehingga `composer install` post-script `artisan package:discover` fail `Class PDO not found`). Ini **expected** untuk host bare — deploy sesungguhnya jalan di `alt-php83` server atau di Docker (`pdo_mysql` aktif). Bukan regresi dari fix fileinfo.

---

## 6. Referensi Lengkap

- PHP fileinfo: https://www.php.net/manual/en/book.fileinfo.php
- Composer platform reqs & `--ignore-platform-req`: https://getcomposer.org/doc/03-cli.md & https://getcomposer.org/doc/01-basic-usage.md#platform-requirements
- Laravel Filesystem 12.x: https://laravel.com/docs/12.x/filesystem
- Flysystem 3.x docs: https://flysystem.thephpleague.com/docs/ (require ext-fileinfo)
- cPanel Select PHP Version: https://docs.cpanel.net/cpanel/software/select-php-version/
- EasyApache 4 PHP extensions: https://docs.cpanel.net/ea4/php/php-options/
- Alt-PHP (CloudLinux) CageFS: https://docs.cloudlinux.com/shared/alt-php/
- Docker php `docker-php-ext-install`: https://github.com/docker-library/docs/tree/master/php

---

## 7. Next Action untuk Owner

- [ ] Lakukan fix permanen di cPanel Brianza (centang `fileinfo` untuk PHP 8.3)
- [ ] Verifikasi ` /opt/alt/php83/usr/bin/php -m | grep fileinfo`
- [ ] `git pull origin main` di `~/isac-app` (atau tunggu push deploy.sh terbaru) lalu `./deploy.sh`
- [ ] (Opsional, jika `VITE_*` berubah) rebuild prod image: `docker compose -f docker-compose.prod.yml build` (sudah include `fileinfo`)
