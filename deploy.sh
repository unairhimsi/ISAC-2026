#!/bin/bash
set -e

cd ~/isac-app

php_bin="/opt/alt/php83/usr/bin/php"

echo "=== Maintenance mode ON ==="
$php_bin artisan down || true

echo "=== Git pull ==="
git pull origin main

echo "=== Composer install ==="
$php_bin /usr/local/bin/composer install --no-dev --optimize-autoloader

echo "=== NPM install & build ==="
npm install
npm run build

echo "=== Migration ==="
$php_bin artisan migrate --force

echo "=== Clear cache ==="
$php_bin artisan config:clear
$php_bin artisan route:clear
$php_bin artisan view:clear
$php_bin artisan cache:clear

echo "=== Rebuild cache ==="
$php_bin artisan config:cache
$php_bin artisan route:cache
$php_bin artisan view:cache

echo "=== Restart queue ==="
$php_bin artisan queue:restart || true

echo "=== Maintenance mode OFF ==="
$php_bin artisan up

echo "Deploy selesai: $(date)"
