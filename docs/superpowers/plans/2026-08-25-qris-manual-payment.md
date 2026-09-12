# Dual-Channel Payment (QRIS + Bank Transfer) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Payment form accepts QRIS (static image from env) alongside BCA/BNI bank transfer, with optional transaction reference stored in `registrations.transaction_id`.

**Architecture:** Config-driven dual method (`config/registration.payment_methods`), manual admin verification unchanged. QRIS is a display-only destination panel; submission path identical to bank transfer plus optional `transaction_id`.

**Tech Stack:** Laravel 13 (Pest), React 19 + TS + react-hook-form + zod + TanStack Query, Inertia.

## Global Constraints

- No commits/pushes — owner commits manually.
- Do not touch unrelated uncommitted work: AdminStageScores feature files, `.env*`, `docs/API/*`, `routes/api.php`, `storage/framework/views/*`.
- DB enum `payment_method` already contains 'QRIS' — never alter enum.
- Single source of truth: `config('registration.payment_methods')`.
- Spec: `docs/superpowers/specs/2026-08-25-qris-manual-payment-design.md`.

---

### Task 1: BE — transaction_id column + config + request rule + service

**Files:**
- Create: `database/migrations/2026_08_25_000001_add_transaction_id_to_registrations_table.php`
- Modify: `config/registration.php`
- Modify: `app/Http/Requests/Registration/SubmitPaymentRequest.php`
- Modify: `app/Services/RegistrationService.php` (submitPayment ~line 364-406)
- Modify: `app/Models/Registration.php` ($fillable)
- Test: `tests/Feature/Registration/PaymentTest.php`

**Interfaces:**
- Produces: `registrations.transaction_id` (string 50 nullable); API input field `transaction_id`; config key `registration.qris.image_url`.

- [ ] **Step 1: RED tests** — add to `PaymentTest.php`:

```php
test('can submit payment via qris with optional transaction reference', function (): void {
    $this->withToken($this->token)
        ->postJson('/api/registrations/me/payment', [
            'payment_proof_file_id' => $this->file->id,
            'payment_method' => 'QRIS',
            'transaction_id' => 'TP-20260825-XYZ',
        ])
        ->assertOk()
        ->assertJsonPath('data.context.registration.status', RegistrationStatus::WAITING_VERIFICATION->value);

    $registration = $this->team->registration()->firstOrFail();
    expect($registration->payment_method)->toBe(PaymentMethod::QRIS)
        ->and($registration->transaction_id)->toBe('TP-20260825-XYZ');
});

test('rejects payment methods outside configured list', function (): void {
    config()->set('registration.payment_methods', ['BANK_TRANSFER']);

    $this->withToken($this->token)
        ->postJson('/api/registrations/me/payment', [
            'payment_proof_file_id' => $this->file->id,
            'payment_method' => 'QRIS',
        ])
        ->assertUnprocessable()
        ->assertJsonStructure(['error' => ['details' => ['payment_method']]]);
});
```

Also update existing assertion at line ~117: `Schema::hasColumn('registrations', 'transaction_id')` → `toBeTrue()`. Add `use App\Models\PaymentMethod;` import.

- [ ] **Step 2: Run RED** — `./vendor/bin/pest tests/Feature/Registration/PaymentTest.php`. Expected: new tests FAIL (column missing / method rejected).

- [ ] **Step 3: Migration**

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('registrations', function (Blueprint $table): void {
            $table->string('transaction_id', 50)->nullable()->after('payment_method');
        });
    }

    public function down(): void
    {
        Schema::table('registrations', function (Blueprint $table): void {
            $table->dropColumn('transaction_id');
        });
    }
};
```

Config: `'payment_methods' => ['BANK_TRANSFER', 'QRIS']` and add:

```php
'qris' => [
    'image_url' => env('REGISTRATION_QR_IMAGE_URL'),
],
```

SubmitPaymentRequest rules add: `'transaction_id' => ['nullable', 'string', 'max:50']`.

Registration model: add `'transaction_id',` to `$fillable` near `'payment_method',`.

Service `submitPayment`: inside registration update array add `'transaction_id' => $data['transaction_id'] ?? null,`. Extend idempotent early-return guard condition to also compare:

```php
&& $registration->payment_method?->value === $data['payment_method']
&& ($registration->transaction_id ?? '') === ($data['transaction_id'] ?? '')
```

- [ ] **Step 4: GREEN** — rerun pest file → all pass.

---

### Task 2: BE resources + admin types/display

**Files:**
- Modify: `app/Http/Resources/PaymentFormResource.php`
- Modify: `app/Http/Resources/AdminPaymentResource.php`
- Modify: `resources/js/features/admin/types/adminTypes.ts` (additive only — user has pending edits)
- Modify: `resources/js/Pages/Admin/Payments/Show.tsx`
- Check: `resources/js/Pages/Admin/Payments.tsx` method filter options include QRIS

- [ ] **Step 1: RED test** in PaymentTest.php:

```php
test('exposes qris image url in payment form data', function (): void {
    config()->set('registration.qris.image_url', '/qris.jpeg');

    $this->withToken($this->token)
        ->getJson('/api/registrations/me/payment')
        ->assertOk()
        ->assertJsonPath('data.qrisImageUrl', '/qris.jpeg');
});
```

- [ ] Step 2: Run RED → fail (missing key).
- [ ] Step 3: PaymentFormResource add `'qrisImageUrl' => config('registration.qris.image_url'),`; AdminPaymentResource payment block add `'transactionId' => $this->transaction_id,`.
- [ ] Step 4: GREEN run.
- [ ] Step 5: FE admin types — find payment detail type in `adminTypes.ts`, add `transactionId?: string | null` next to `method`. In `Show.tsx`, render "No. Referensi" row after Metode when present. Verify Payments list filter has QRIS option; add if hardcoded-out.

---

### Task 3: FE payment form

**Files:**
- Modify: `resources/js/features/registrations/schemas/uploadPayment.ts`
- Modify: `resources/js/features/registrations/types/registrationTypes.ts`
- Modify: `resources/js/features/registrations/components/FormPayment.tsx`
- Modify: `resources/js/Pages/Registration/Payment.tsx`

- [ ] Schema:

```ts
export const uploadPaymentSchema = z.object({
  payment_method: z.enum(['BANK_TRANSFER', 'QRIS']),
  promo_code: z.string().trim().max(50, 'Kode promo maksimal 50 karakter'),
  transaction_id: z.string().trim().max(50).optional(),
  paymentProof: paymentProofSchema.nullable().refine(Boolean, 'Bukti pembayaran wajib diunggah'),
})
```

- [ ] Types: `PaymentFormValues` += `transaction_id?: string`; page data type += `qrisImageUrl: string | null`.
- [ ] FormPayment props += `qrisImageUrl: string | null`. Left column: RadioGroup pill "Saya bayar via" bound to form `payment_method` (Transfer Bank / QRIS); below, bank cards always visible; QRIS panel renders image `<img src={qrisImageUrl}>` + caption when value non-null. Right column adds conditional Input "No. Referensi / ID Transaksi (Opsional)" only when method === 'QRIS'. defaultValues.payment_method = 'BANK_TRANSFER' (first of supported). handleSubmit passes `transaction_id` only when non-empty & QRIS.
- [ ] Page passes `qrisImageUrl={payment.qrisImageUrl}`.
- [ ] Verification: `npx tsc --noEmit` clean; `npm run build` pass.

---

### Task 4: Full verification

- [ ] `./vendor/bin/pest tests/Feature/Registration/PaymentTest.php` all green
- [ ] `./vendor/bin/pest` full suite — classify failures vs known pre-existing (17 verb-mismatch DocumentsTest/SelectionTest/TeamDataTest/Database + Olympiad Show.tsx typecheck)
- [ ] `npx tsc --noEmit` (known pre-existing error Olympiad/Show.tsx allowed)
- [ ] `npm run build`
- [ ] Report evidence; no commit.
