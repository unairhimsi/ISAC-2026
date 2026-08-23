# Transfer-Only Payment (BCA & BNI) + GitHub Actions CI/CD Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hapus QRIS dari form pembayaran (transfer-only, tampil 2 kartu rekening BCA & BNI dari .env dengan tombol copy), lalu setup CI/CD GitHub Actions auto-deploy ke cPanel.

**Architecture:** Rekening bank disimpan di env vars → dibaca `config/registration.php` → dikirim frontend via `PaymentFormResource.bankAccounts`. Validasi submission dibatasi ke `BANK_TRANSFER` via config. Kolom enum DB tidak diubah (data historis QRIS aman). CI/CD: workflow `appleboy/ssh-action` menjalankan `~/isac-app/deploy.sh` di server saat push ke `main`.

**Tech Stack:** Laravel 13 (PHP 8.3), React TS + react-hook-form + zod, TanStack Query, GitHub Actions (`appleboy/ssh-action@v1.0.3`).

## Global Constraints

- Jangan ubah kolom enum DB `registrations.payment_method` — tanpa migration.
- Jangan hapus case `QRIS` dari `app/Models/PaymentMethod.php`.
- Jangan ubah `resources/js/Pages/Admin/Payments.tsx` dan `resources/js/Pages/Admin/Payments/Show.tsx` (label/filter QRIS dipertahankan untuk data historis).
- UI style halaman payment tetap sama (border-primary, bg-background, rounded-2xl, uppercase tracking labels).
- Nomor rekening: BCA `003840011210`, BNI `2082369546`, nama pemilik keduanya `Gabriella Veronika Liander`.
- JANGAN commit/push sebelum user konfirmasi eksplisit — push ke `main` akan memicu deploy produksi.
- Semua path frontend relatif dari `resources/js/`.

---

### Task 1: Backend — config, validasi, resource

**Files:**
- Modify: `config/registration.php`
- Modify: `app/Http/Requests/Registration/SubmitPaymentRequest.php:20`
- Modify: `app/Http/Resources/PaymentFormResource.php:30`

**Interfaces:**
- Produces: `config('registration.payment_methods')` = `['BANK_TRANSFER']`; `config('registration.bank_accounts')` = array of `['bank','account_number','account_name']`; API response field `bankAccounts: [{bank, accountNumber, accountName}]` (dipakai Task 2).

- [ ] **Step 1: Update `config/registration.php`**

Ganti seluruh isi menjadi:

```php
<?php

return [
    'payment_methods' => ['BANK_TRANSFER'],
    'payment_instructions' => env('REGISTRATION_PAYMENT_INSTRUCTIONS', 'Ikuti instruksi pembayaran resmi panitia ISAC.'),
    'promo' => [
        'code' => env('REGISTRATION_PROMO_CODE', 'ISAXOP'),
        'discount_percent' => (int) env('REGISTRATION_PROMO_DISCOUNT_PERCENT', 15),
    ],
    'bank_accounts' => [
        [
            'bank' => 'BCA',
            'account_number' => env('REGISTRATION_BCA_ACCOUNT_NUMBER', ''),
            'account_name' => env('REGISTRATION_BCA_ACCOUNT_NAME', ''),
        ],
        [
            'bank' => 'BNI',
            'account_number' => env('REGISTRATION_BNI_ACCOUNT_NUMBER', ''),
            'account_name' => env('REGISTRATION_BNI_ACCOUNT_NAME', ''),
        ],
    ],
];
```

- [ ] **Step 2: Update validasi di `SubmitPaymentRequest.php`**

Ganti baris:
```php
'payment_method' => ['required', Rule::in(['BANK_TRANSFER', 'QRIS'])],
```
menjadi:
```php
'payment_method' => ['required', Rule::in(config('registration.payment_methods'))],
```

- [ ] **Step 3: Update `PaymentFormResource.php`**

Ganti baris `'qrImageUrl' => config('registration.qr_image_url'),` menjadi:

```php
'bankAccounts' => collect(config('registration.bank_accounts'))
    ->map(fn (array $account): array => [
        'bank' => (string) $account['bank'],
        'accountNumber' => (string) $account['account_number'],
        'accountName' => (string) $account['account_name'],
    ])
    ->all(),
```

- [ ] **Step 4: Sanity check config**

Run: `docker compose exec -T app php artisan tinker --execute="var_dump(config('registration.bank_accounts'));"` (fallback: `php artisan tinker --execute=...` jika container mati).
Expected: array berisi BCA & BNI dengan nomor dari `.env` (setelah Task 3). Jika belum, boleh lanjut — diverifikasi penuh di Task 4.

---

### Task 2: Frontend — types, schema, FormPayment + tombol copy, page, FAQ

**Files:**
- Modify: `resources/js/features/registrations/types/registrationTypes.ts:72-85`
- Modify: `resources/js/features/registrations/schemas/uploadPayment.ts:11`
- Modify: `resources/js/features/registrations/components/FormPayment.tsx`
- Modify: `resources/js/Pages/Registration/Payment.tsx:71`
- Modify: `resources/js/constants/faq.ts:54`

**Interfaces:**
- Consumes: API field `bankAccounts` dari Task 1.
- Produces: type `BankAccount { bank: string; accountNumber: string; accountName: string }`; `PaymentPageData.bankAccounts: BankAccount[]` (tanpa `qrImageUrl`); schema `payment_method: z.literal('BANK_TRANSFER')`.

- [ ] **Step 1: Update `registrationTypes.ts`**

Tambahkan type baru setelah baris `export type PaymentMethod = ...`:

```ts
export type BankAccount = { bank: string; accountNumber: string; accountName: string }
```

Di `PaymentPageData`, ganti baris:
```ts
  paymentMethods: PaymentMethod[]; paymentInstructions: string | null
  qrImageUrl: string | null; paymentStatus: RegistrationStatus; existingProof: ExternalFile | null
```
menjadi:
```ts
  paymentMethods: PaymentMethod[]; paymentInstructions: string | null
  bankAccounts: BankAccount[]; paymentStatus: RegistrationStatus; existingProof: ExternalFile | null
```

(Catatan: `PaymentMethod` union `'BANK_TRANSFER' | 'QRIS'` dipertahankan untuk data historis admin.)

- [ ] **Step 2: Update `uploadPayment.ts`**

Ganti:
```ts
payment_method: z.enum(['BANK_TRANSFER', 'QRIS']),
```
menjadi:
```ts
payment_method: z.literal('BANK_TRANSFER'),
```

- [ ] **Step 3: Rewrite `FormPayment.tsx`**

Perubahan pada file yang ada:

a) Import lucide icons — tambah `Check`, `Copy` ke import `lucide-react` yang ada di file (jika belum ada import lucide, tambahkan):
```tsx
import { Check, Copy } from 'lucide-react'
```

b) Props: hapus `qrImageUrl: string | null` dan `paymentMethods: PaymentMethod[]`; tambah `bankAccounts: BankAccount[]`. Import type `BankAccount` dari `../types/registrationTypes`. Hapus type `PaymentMethod` dari import jika tidak lagi dipakai.

c) Hapus konstanta `methodLabels`.

d) Tambah state & helpers di dalam komponen (sebelum `useForm`):

```tsx
const [copiedBank, setCopiedBank] = useState<string | null>(null)

const formatAccountNumber = (value: string) => value.replace(/(\d{4})(?=\d)/g, '$1 ')

const handleCopyAccount = async (bank: string, accountNumber: string) => {
  try {
    await navigator.clipboard.writeText(accountNumber)
  } catch {
    const textarea = document.createElement('textarea')
    textarea.value = accountNumber
    document.body.appendChild(textarea)
    textarea.select()
    document.execCommand('copy')
    document.body.removeChild(textarea)
  }
  setCopiedBank(bank)
  window.setTimeout(() => setCopiedBank((current) => (current === bank ? null : current)), 2000)
}
```

e) `useForm` defaultValues: ganti `payment_method: paymentMethods[0] ?? 'QRIS'` menjadi `payment_method: 'BANK_TRANSFER'`.

f) Ganti blok kotak QR (dari `<div className="flex justify-center w-full">` sampai penutupnya yang berisi `qrImageUrl ? <img ...> : ...`) dengan:

```tsx
<div className="flex justify-center w-full">
  <div className="w-full max-w-[260px] space-y-3">
    <p className="text-center text-sm font-semibold uppercase tracking-wide text-foreground">Rekening Tujuan</p>
    {bankAccounts.map((account) => (
      <div key={account.bank} className="rounded-2xl border border-primary bg-background p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold uppercase tracking-wide text-foreground">{account.bank}</p>
          <button
            type="button"
            onClick={() => handleCopyAccount(account.bank, account.accountNumber)}
            className="flex cursor-pointer items-center gap-1 rounded-full border border-input px-3 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
            aria-label={`Salin nomor rekening ${account.bank}`}
          >
            {copiedBank === account.bank ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
            {copiedBank === account.bank ? 'Tersalin' : 'Salin'}
          </button>
        </div>
        <p className="mt-2 text-lg font-bold tracking-wide text-foreground">{formatAccountNumber(account.accountNumber)}</p>
        <p className="mt-1 text-xs text-muted-foreground">a.n. {account.accountName}</p>
      </div>
    ))}
  </div>
</div>
```

g) Hapus seluruh blok `<Controller name="payment_method" ...>` (dropdown metode pembayaran).

h) Judul kartu harga tetap "Total Biaya Pendaftaran"; tidak ada perubahan lain pada promo/upload/submit.

- [ ] **Step 4: Update `Pages/Registration/Payment.tsx`**

Ganti prop `qrImageUrl={payment.qrImageUrl}` dan `paymentMethods={payment.paymentMethods}` menjadi:
```tsx
bankAccounts={payment.bankAccounts}
```
(hapus baris `paymentMethods={...}` — tidak dipakai lagi oleh FormPayment.)

- [ ] **Step 5: Update FAQ `constants/faq.ts` line 54**

Ganti jawaban menjadi:
```ts
'Pembayaran dilakukan melalui transfer bank ke rekening resmi panitia (BCA atau BNI). Setelah membayar, unggah bukti pembayaran pada halaman Payment agar dapat diperiksa dan diverifikasi oleh panitia.',
```

- [ ] **Step 6: Typecheck/build frontend**

Run: `npm run build` (atau script typecheck yang tersedia di `package.json`).
Expected: sukses tanpa error TypeScript.

---

### Task 3: File environment (4 file)

**Files:**
- Modify: `.env`, `.env.example`, `.env.production`, `.env.production.example`

**Interfaces:**
- Consumes: nama env var yang dibaca `config/registration.php` di Task 1.

- [ ] **Step 1: Di KEEMPAT file**, hapus baris `REGISTRATION_QR_IMAGE_URL=/qris.png`

- [ ] **Step 2: Di KEEMPAT file**, tambahkan setelah `REGISTRATION_PAYMENT_INSTRUCTIONS`:

```env
REGISTRATION_BCA_ACCOUNT_NUMBER="003840011210"
REGISTRATION_BCA_ACCOUNT_NAME="Gabriella Veronika Liander"
REGISTRATION_BNI_ACCOUNT_NUMBER="2082369546"
REGISTRATION_BNI_ACCOUNT_NAME="Gabriella Veronika Liander"
```

Catatan: `.env.production` punya `REGISTRATION_PROMO_CODE=ORCHESTRATE26` — JANGAN disentuh.

---

### Task 4: Tests update + verifikasi backend

**Files:**
- Modify: `tests/Feature/Registration/PaymentTest.php` (baris 80, 107)
- Modify: `tests/Feature/Registration/CanonicalWorkflowTest.php` (baris 84)
- Modify: `tests/Feature/Admin/AdminPaymentTest.php` (bari 118, 135, 178, 210)

**Interfaces:**
- Consumes: validasi baru dari Task 1 (QRIS akan ditolak sebagai 422).

- [ ] **Step 1: Ganti semua `'payment_method' => 'QRIS'` menjadi `'payment_method' => 'BANK_TRANSFER'`** di ketiga file test. Untuk query param filter di `AdminPaymentTest.php:135` (`payment_method=QRIS`), ganti juga menjadi `payment_method=BANK_TRANSFER`.

- [ ] **Step 2: Jalankan test**

Run: `docker compose exec -T app php artisan test` (fallback: `php artisan test`).
Expected: semua PASS. Jika container DB tidak jalan, jalankan `docker compose up -d` dulu.

---

### Task 5: deploy.sh + GitHub Actions workflow

**Files:**
- Modify: `deploy.sh` (root repo, saat ini kosong/untracked)
- Create: `.github/workflows/deploy.yml`

**Interfaces:**
- Produces: script deploy idempotent di server `~/isac-app/deploy.sh`; workflow trigger push `main`.

- [ ] **Step 1: Isi `deploy.sh`** (root repo):

```bash
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
```

Lalu: `chmod +x deploy.sh`

- [ ] **Step 2: Buat `.github/workflows/deploy.yml`:**

```yaml
name: Deploy to Production

on:
  push:
    branches:
      - main

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Deploy via SSH
        uses: appleboy/ssh-action@v1.0.3
        with:
          host: ${{ secrets.SSH_HOST }}
          username: ${{ secrets.SSH_USER }}
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          port: ${{ secrets.SSH_PORT }}
          script: |
            bash ~/isac-app/deploy.sh
```

---

### Task 6: QA akhir + handoff manual steps (GATED)

- [ ] **Step 1: Re-run full verification**: `php artisan test` PASS + `npm run build` PASS.
- [ ] **Step 2: Laporkan hasil ke user + checklist langkah manual server/GitHub** (salin deploy.sh ke server, generate SSH key CI, authorized_keys, cari port SSH, set 4 secrets GitHub).
- [ ] **Step 3: MINTA KONFIRMASI EKSPLISIT** sebelum `git add/commit/push`. Push ke `main` = deploy produksi (semua perubahan payment ikut live). Jangan push tanpa persetujuan.
