# Design: Transfer-Only Payment (BCA & BNI) + GitHub Actions CI/CD

Date: 2026-08-23
Status: Approved by user

---

## Part A — Payment: hapus QRIS, transfer-only dengan 2 rekening

### Keputusan yang disetujui user

1. QRIS dihapus total dari UI pembayaran (tidak ada gambar QR, tidak ada opsi QRIS).
2. Metode pembayaran = **transfer bank saja**, ditampilkan sebagai **2 kartu rekening** (BCA & BNI) tanpa dropdown pemilihan metode/bank.
3. Setiap kartu rekening punya **tombol copy** untuk menyalin nomor rekening.
4. Nilai `payment_method` yang dikirim & tersimpan selalu `BANK_TRANSFER`.
5. Kolom enum DB `registrations.payment_method` **tidak diubah** (case `QRIS` dipertahankan untuk data historis); QRIS diblokir hanya di layer validasi/config.
6. Halaman admin (`Admin/Payments.tsx`, `Admin/Payments/Show.tsx`) **tidak diubah** — filter dan label `QRIS` dipertahankan agar data historis tetap bisa difilter/ditampilkan.
7. UI style halaman payment tetap sama; fungsionalitas lain (quote promo, upload bukti ImageKit, status machine, verifikasi admin) tidak berubah.
8. Data rekening disimpan di `.env` dan dibaca via `config/registration.php`.

### Perubahan backend

| File | Perubahan |
|---|---|
| `config/registration.php` | `payment_methods` → `['BANK_TRANSFER']`; hapus key `qr_image_url`; tambah `bank_accounts` (BCA & BNI, masing-masing `bank`, `account_number`, `account_name` dari env) |
| `app/Http/Requests/Registration/SubmitPaymentRequest.php` | Validasi `payment_method` → `Rule::in(config('registration.payment_methods'))` |
| `app/Http/Resources/PaymentFormResource.php` | Field `qrImageUrl` diganti `bankAccounts[]` → `[{bank, accountNumber, accountName}]` |
| `app/Models/PaymentMethod.php` | **Tidak diubah** (case QRIS dipertahankan untuk hydrate data lama) |
| Migration | **Tidak ada** |

### Perubahan frontend

| File | Perubahan |
|---|---|
| `resources/js/features/registrations/types/registrationTypes.ts` | Tambah type `BankAccount {bank, accountNumber, accountName}`; ganti `qrImageUrl` → `bankAccounts: BankAccount[]` pada tipe data payment |
| `resources/js/features/registrations/schemas/uploadPayment.ts` | `payment_method: z.literal('BANK_TRANSFER')` |
| `resources/js/features/registrations/components/FormPayment.tsx` | Hapus dropdown metode & prop `qrImageUrl`; kotak QR diganti 2 kartu rekening bergaya sama (border-primary, bg-background, rounded-2xl); tiap kartu: nama bank, nomor rekening (ditampilkan berkelompok 4 digit), nama pemilik, tombol copy dengan feedback "Tersalin" ±2 detik; submit tetap kirim `payment_method: 'BANK_TRANSFER'` |
| `resources/js/Pages/Registration/Payment.tsx` | Pass `bankAccounts` menggantikan `qrImageUrl` |
| `resources/js/constants/faq.ts` | Jawaban FAQ pembayaran: transfer bank ke rekening resmi panitia (BCA atau BNI) |

Perilaku tombol copy: `navigator.clipboard.writeText(nomor)` dengan fallback `execCommand`; state `copiedBank` menandai kartu yang baru dicopy, reset setelah 2 detik.

### File environment (4 file)

Tambah di `.env`, `.env.production`, `.env.example`, `.env.production.example`:

```env
REGISTRATION_BCA_ACCOUNT_NUMBER="003840011210"
REGISTRATION_BCA_ACCOUNT_NAME="Gabriella Veronika Liander"
REGISTRATION_BNI_ACCOUNT_NUMBER="2082369546"
REGISTRATION_BNI_ACCOUNT_NAME="Gabriella Veronika Liander"
```

Hapus `REGISTRATION_QR_IMAGE_URL=...` dari keempat file. Nomor BCA dinormalisasi tanpa spasi (`0038 4001 1210` → `003840011210`); pemformatan tampilan dilakukan di frontend. Nilai asli dipakai juga di file example karena nomor rekening ini memang informasi publik yang ditampilkan ke semua pendaftar.

### Test

Update penggunaan `QRIS` → `BANK_TRANSFER` pada `tests/Feature/Registration/PaymentTest.php`, `tests/Feature/Registration/CanonicalWorkflowTest.php`, `tests/Feature/Admin/AdminPaymentTest.php`. Verifikasi: `php artisan test`, build frontend.

---

## Part B — CI/CD: GitHub Actions auto-deploy ke cPanel

### Konteks produksi

- Hosting: cPanel (DomainNesia), host SSH `brianza.id.rapidplex.com`, user `himsiun1`
- Path aplikasi di server: `~/isac-app`
- PHP 8.3 alt-php: `/opt/alt/php83/usr/bin/php`
- Domain: `https://isac.himsiunair.com`

### Perubahan di repo

1. **`deploy.sh`** (root repo, saat ini kosong) — diisi script deploy lengkap: maintenance mode ON → git pull → composer install --no-dev → npm install & build → migrate --force → clear cache → rebuild cache → queue restart → maintenance mode OFF. Menjadi source of truth; user menyalinnya ke server `~/isac-app/deploy.sh`.
2. **`.github/workflows/deploy.yml`** — workflow `Deploy to Production`, trigger `push` ke `main`, satu job `deploy` memakai `appleboy/ssh-action@v1.0.3` menjalankan `bash ~/isac-app/deploy.sh` via secrets `SSH_HOST`, `SSH_USER`, `SSH_PRIVATE_KEY`, `SSH_PORT`.

### Langkah manual (di luar repo, dikerjakan user)

1. Salin `deploy.sh` dari repo ke server `~/isac-app/deploy.sh`, `chmod +x`.
2. Di server: generate keypair ed25519 khusus CI (`~/.ssh/gh_actions_deploy`), append public key ke `authorized_keys`.
3. Tentukan port SSH (default 22; cek cPanel → SSH Access jika custom).
4. GitHub repo → Settings → Secrets and variables → Actions → buat 4 secret: `SSH_PRIVATE_KEY`, `SSH_HOST=brianza.id.rapidplex.com`, `SSH_USER=himsiun1`, `SSH_PORT`.
5. Push ke `main` → pantau tab Actions → verifikasi situs tetap jalan.

### Catatan keamanan

- Private key **tidak perlu** ditempel ke chat/AI mana pun — langsung paste ke GitHub Secrets.
- Key CI terpisah dari key personal; revoke cukup dengan hapus baris di `authorized_keys`.
- Troubleshooting PATH npm non-interaktif: gunakan path absolut hasil `which npm` di server bila perlu.

---

## Out of scope

- Migration DB / penghapusan case QRIS dari kolom enum.
- CRUD admin untuk rekening bank.
- Job test terpisah sebelum deploy di workflow (bisa ditambah belakangan).
- Penghapusan asset `public/qris.png` (tidak lagi direferensikan, dibiarkan).
