# Dual-Channel Payment (QRIS Statis + Transfer Bank) — Design

**Date:** 2026-08-25
**Status:** Approved by owner
**Scope:** Level A manual QRIS — QRIS sebagai tujuan bayar kedua di samping transfer bank BCA/BNI. Verifikasi admin tetap manual (upload screenshot → admin cek).

## Keputusan Desain (owner-approved)

1. **UI:** Tampilkan rekening bank DAN panel QRIS sekaligus di kolom kiri FormPayment. Selector kecil "Saya bayar via:" (Transfer Bank | QRIS) mengontrol nilai `payment_method`.
2. **Nomor referensi:** Input opsional max 50 karakter, hanya tampil saat metode QRIS dipilih. Disimpan ke kolom `transaction_id`.
3. **Instruksi:** Satu teks global (`REGISTRATION_PAYMENT_INSTRUCTIONS`) untuk kedua metode.
4. **Sumber gambar QRIS:** env `REGISTRATION_QR_IMAGE_URL` (default `/qris.jpeg`; file sudah ada di `public/qris.jpeg`).
5. **Tanpa perubahan alur verifikasi admin.**

## Temuan Kunci

- Kolom `transaction_id` **sudah dihapus** oleh migration `2026_07_23_000002_add_registration_promo_pricing.php:15` dan `PaymentTest.php:117` men-assert ketidakhadirannya → perlu migration re-add + update assertion.
- Enum DB `payment_method` ('BANK_TRANSFER','QRIS') tidak pernah diubah — QRIS valid sejak awal.
- Config-driven: `config('registration.payment_methods')` memvalidasi input (SubmitPaymentRequest) sekaligus dikirim ke FE via PaymentFormResource.
- Guard idempotensi submit saat ini hanya membandingkan proof+promo; harus diperluas dengan payment_method + transaction_id agar ganti metode tetap ter-update.

## Perubahan Backend

| Berkas | Perubahan |
|---|---|
| Migration baru | Re-add `transaction_id` string(50) nullable after `payment_method` |
| `config/registration.php` | `payment_methods => ['BANK_TRANSFER','QRIS']`; blok `'qris' => ['image_url' => env('REGISTRATION_QR_IMAGE_URL')]` |
| `SubmitPaymentRequest` | Rule `transaction_id => nullable|string|max:50` |
| `RegistrationService::submitPayment` | Simpan/clear `transaction_id`; guard idempotensi diperluas (method + tx ref) |
| `Registration` model | `$fillable += transaction_id` |
| `PaymentFormResource` | Field `qrisImageUrl` (nullable dari config) |
| `AdminPaymentResource` | Expose `transactionId`; tampilkan di `Admin/Payments/Show.tsx` (+ `adminTypes.ts`) |

## Perubahan Frontend

| Berkas | Perubahan |
|---|---|
| `schemas/uploadPayment.ts` | `z.literal('BANK_TRANSFER')` → `z.enum(['BANK_TRANSFER','QRIS'])`; field opsional `transaction_id` |
| `types/registrationTypes.ts` | `PaymentFormValues.transaction_id?: string`; `PaymentPageData.qrisImageUrl: string \| null` |
| `components/FormPayment.tsx` | Panel QRIS + RadioGroup "Saya bayar via"; input referensi kondisional QRIS; defaultValues dari prop |
| `Pages/Registration/Payment.tsx` | Pass `qrisImageUrl` ke form |

## Test Plan (TDD)

BE (`tests/Feature/Registration/PaymentTest.php`):
- RED `can submit payment via qriss with optional transaction reference`
- RED `rejects payment methods outside configured list`
- RED `exposes qris image url in payment form data`
- Update assertion `Schema::hasColumn(...transaction_id)` → true

FE: verifikasi `tsc --noEmit` + `npm run build` (repo tanpa test komponen).

## Batasan

- Jangan sentuh pekerjaan user lain yang belum di-commit (Stage Scores feature, .env*, docs/API, routes/api.php).
- Tanpa commit/push — owner yang melakukan commit sendiri.
- storage/framework/views/*.php adalah artifact build — abaikan.
