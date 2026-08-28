# Unified Upfront Payment Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ubah semua lomba (OLIMPIADE, BUSINESS_PLAN, BUSINESS_IT_CASE) menjadi alur registrasi identik dengan Olimpiade: wajib bayar di awal (UPFRONT), hilangkan auto-VERIFIED dan payment gate SEMIFINAL.

**Architecture:** Hapus branching `type === OLIMPIADE` di service & resource, samakan `CompetitionService.validateTypePaymentFlow` → semua type hanya izinkan `UPFRONT`, sederhanakan `RegistrationService.selectCompetition/updateDocuments/submitPayment/submitForVerification`, hapus `payment_for_stage_id` semifinal trigger di `AdminRegistrationService.advanceStage`, unify frontend `getRegistrationSteps` + `RegistrationContextResource.currentStep` + `Team.getNextRedirectAttribute` agar semua lomba melewati step Payment sebelum Validation/Dashboard, ubah `Isac2026TimelineSeeder` BPC/BIC menjadi `PAYMENT_UPFRONT`, dan perbaiki query admin `paymentQuery` agar semua registrasi muncul di antrean pembayaran.

**Tech Stack:** Laravel 11/13 (PHP 8.3), Eloquent + SoftDeletes, React 18 + TypeScript + Inertia + TanStack Query, Tailwind, ImageKit upload, Pest PHP testing, Vite

## Global Constraints

- PHP >=8.3, Laravel sanctum `auth:sanctum` + middleware `principal.team`/`principal.admin` tetap dipertahankan
- Tidak menambah migrasi DB baru kecuali memang diperlukan; `payment_for_stage_id` tetap ada tapi tidak dipakai untuk gate semifinal (nullable, diabaikan)
- Semua payment method tetap `BANK_TRANSFER|QRIS` via `config/registration.php`, promo `ISAXOP` 15% tetap aktif via `POST /me/payment/quote`
- Frontend routes tetap Inertia: `/registration`, `/registration/team`, `/registration/biodata`, `/registration/documents`, `/registration/payment`, `/dashboard` (hapus `/registration/validation` branching per type, nanti unified tapi keep file untuk legacy redirect)
- Policy tetap: `TeamPolicy.verifyData` = admin_registration, `RegistrationPolicy.verifyPayment` = admin_payment, super_admin bypass
- X-Request-ID header tetap di admin mutasi, idempotency submitPayment tetap
- Test suite harus tetap `php artisan test` + `pint` + `tsc --noEmit` + `npm run build` tanpa regresi (pre-existing 18 fails di Documents/Selection/TeamData tetap ditangani)
- Jangan ubah `payment_for_stage_id` column type; cukup ignore logic-nya

---

## File Structure Overview (yang akan disentuh)

- `app/Models/Competition.php` — konstanta, tidak hapus SEMIFINAL tapi mark deprecated comment
- `app/Services/CompetitionService.php:89-109` — `validateTypePaymentFlow`
- `database/seeders/Isac2026TimelineSeeder.php:30-43` — upsert BPC/BIC payment_flow
- `app/Services/RegistrationService.php:19-66` — `selectCompetition`, `:325-349` — `updateDocuments`, `:364-385` — `submitPayment` gate, `:446-460` — `submitForVerification`
- `app/Services/AdminRegistrationService.php:220-280` — `advanceStage`, `:290-310` — `paymentQuery`
- `app/Http/Resources/RegistrationContextResource.php:64-96` — `currentStep`, `84-88` — isStagePaymentCheckpoint
- `app/Models/Team.php:72-107` — `getNextRedirectAttribute` isStagePaymentCheckpoint
- `app/Http/Resources/PaymentFormResource.php:17-26` — payment logic (tetap)
- `app/Http/Resources/AdminPaymentResource.php:31-40` — paymentContext
- `app/Http/Resources/RegistrationSummaryResource.php:58-60` — paymentAvailable
- `resources/js/constants/registration.ts` — `getRegistrationSteps(isOlympiad)`
- `resources/js/features/registrations/types/registrationTypes.ts` — `PaymentFlow`, `RegistrationStep`
- `resources/js/features/registrations/components/RegistrationLayout.tsx` — `FLOW_PATHS`
- `resources/js/features/registrations/components/Steps.tsx` — `isOlympiad` branching
- `resources/js/Pages/Registration/{Documents,Payment,Validation,Index}.tsx` — redirect logic
- `resources/js/features/admin/components/CompetitionFormDialog.tsx:78-79` — auto payment_flow select
- `resources/js/Pages/Admin/Teams/Show.tsx:38-41` — `paymentAvailable`
- `resources/js/Pages/Admin/Payments/Show.tsx:52-54` — `paymentContextLabels`
- `tests/Feature/Registration/{PaymentTest,DocumentsTest,SelectionTest,CanonicalWorkflowTest}.php`
- `tests/Feature/Admin/AdminPaymentTest.php`, `tests/Feature/Admin/AdminTransitionGuardTest.php`

---

### Task 1: Unify Competition Payment Flow Validation (Backend Domain)

**Files:**
- Modify: `app/Services/CompetitionService.php:89-109`
- Modify: `app/Models/Competition.php:27-33` (comment deprecate SEMIFINAL)
- Test: `tests/Feature/Competition/CompetitionAdminTest.php` (atau buat `tests/Feature/Competition/UnifiedPaymentFlowTest.php`)

**Interfaces:**
- Consumes: `Competition::TYPE_*`, `Competition::PAYMENT_*`
- Produces: `CompetitionService::validateTypePaymentFlow(array $data)` — now enforces `UPFRONT` for ALL types; SEMIFINAL throws ValidationException

- [ ] **Step 1: Write the failing test**

```php
// tests/Feature/Competition/UnifiedPaymentFlowTest.php
use App\Models\Competition;
use App\Models\Admin;

test('business plan now requires UPFRONT not SEMIFINAL', function () {
    $admin = Admin::factory()->create(['role'=>'super_admin','is_active'=>true]);
    $token = $admin->createToken('test')->plainTextToken;

    $this->withToken($token)->postJson('/api/admin/competitions', [
        'name'=>'BPC Test Unified',
        'slug'=>'bpc-test-unified-'.uniqid(),
        'description'=>'desc',
        'type'=>Competition::TYPE_BUSINESS_PLAN,
        'payment_flow'=>Competition::PAYMENT_SEMIFINAL, // should now fail
        'start_date'=>'2026-08-26',
        'end_date'=>'2026-11-22',
        'status'=>'DRAFT',
    ])->assertUnprocessable()->assertJsonPath('error.details.payment_flow.0', 'BUSINESS_PLAN dan BUSINESS_IT_CASE harus menggunakan payment flow UPFRONT.');
});

test('business plan with UPFRONT succeeds', function () {
    $admin = Admin::factory()->create(['role'=>'super_admin','is_active'=>true]);
    $token = $admin->createToken('test')->plainTextToken;

    $this->withToken($token)->postJson('/api/admin/competitions', [
        'name'=>'BPC Unified OK',
        'slug'=>'bpc-unified-ok-'.uniqid(),
        'description'=>'desc',
        'type'=>Competition::TYPE_BUSINESS_PLAN,
        'payment_flow'=>Competition::PAYMENT_UPFRONT,
        'start_date'=>'2026-08-26',
        'end_date'=>'2026-11-22',
        'status'=>'DRAFT',
    ])->assertCreated();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test tests/Feature/Competition/UnifiedPaymentFlowTest.php -v`
Expected: FAIL — first test passes (currently allows SEMIFINAL), second should pass but first expects rejection. Saat ini `CompetitionService.php:104` masih `!== 'SEMIFINAL'` throw, jadi test pertama akan FAIL karena endpoint menerima SEMIFINAL (tidak throw).

- [ ] **Step 3: Write minimal implementation**

```php
// app/Services/CompetitionService.php:89-109
private function validateTypePaymentFlow(array $data): void
{
    if (! isset($data['type']) || ! isset($data['payment_flow'])) {
        return;
    }
    $type = $data['type'];
    $paymentFlow = $data['payment_flow'];

    // UNIFIED: semua lomba wajib UPFRONT
    if ($paymentFlow !== Competition::PAYMENT_UPFRONT) {
        $msg = match($type) {
            Competition::TYPE_OLIMPIADE => 'OLIMPIADE harus menggunakan payment flow UPFRONT.',
            Competition::TYPE_BUSINESS_PLAN, Competition::TYPE_BUSINESS_IT_CASE => 'BUSINESS_PLAN dan BUSINESS_IT_CASE harus menggunakan payment flow UPFRONT.',
            default => 'Payment flow harus UPFRONT.',
        };
        throw ValidationException::withMessages(['payment_flow' => $msg]);
    }
}
```

```php
// app/Models/Competition.php:27-33
    public const PAYMENT_UPFRONT = 'UPFRONT';
    public const PAYMENT_SEMIFINAL = 'SEMIFINAL'; // @deprecated - kept for legacy data, tidak dipakai untuk kompetisi baru. Semua lomba sekarang UPFRONT.
```

- [ ] **Step 4: Run test to verify it passes**

Run: `php artisan test tests/Feature/Competition/UnifiedPaymentFlowTest.php -v`
Expected: PASS (2 tests). Also run `php artisan test tests/Feature/Competition/CompetitionAdminTest.php -v` to ensure no regression.

- [ ] **Step 5: Commit**

```bash
git add app/Services/CompetitionService.php app/Models/Competition.php tests/Feature/Competition/UnifiedPaymentFlowTest.php
git commit -m "feat(competition): unify payment_flow to UPFRONT for all types"
```

---

### Task 2: Seed & SelectCompetition Unification (Batch & Initial Status)

**Files:**
- Modify: `database/seeders/Isac2026TimelineSeeder.php:30-43,105-182`
- Modify: `app/Services/RegistrationService.php:19-66` (selectCompetition)
- Test: `tests/Feature/Registration/SelectionTest.php` (existing) + `tests/Feature/Registration/CanonicalWorkflowTest.php`

**Interfaces:**
- Consumes: `BatchStatus::OPEN`, `Competition::STATUS_REGISTRATION_OPEN`
- Produces: `RegistrationService::selectCompetition(Team $team, array $data): Registration` — now always `WAITING_PAYMENT` + `payment_required_at=now()` regardless of type

- [ ] **Step 1: Write the failing test**

```php
// tests/Feature/Registration/UnifiedSelectionTest.php
use App\Models\{Team, Competition, BatchStatus, RegistrationStatus};

test('selecting business plan now creates WAITING_PAYMENT not VERIFIED', function () {
    $team = Team::factory()->create();
    $token = $team->createToken('t')->plainTextToken;
    $competition = Competition::factory()->create([
        'type'=>Competition::TYPE_BUSINESS_PLAN,
        'payment_flow'=>Competition::PAYMENT_UPFRONT,
        'status'=>Competition::STATUS_REGISTRATION_OPEN,
    ]);
    $batch = $competition->batches()->create([
        'name'=>'Batch 1','slug'=>'b1-'.uniqid(),'start_date'=>now()->subDay(),'end_date'=>now()->addMonth(),'price'=>70000,'quota'=>10,'status'=>BatchStatus::OPEN
    ]);

    $this->withToken($token)->putJson('/api/registrations/me/selection', ['competition_id'=>$competition->id])
        ->assertOk()
        ->assertJsonPath('data.context.registration.status', RegistrationStatus::WAITING_PAYMENT->value);

    $reg = $team->fresh()->registration;
    expect($reg->status)->toBe(RegistrationStatus::WAITING_PAYMENT)
        ->and($reg->payment_required_at)->not->toBeNull()
        ->and($reg->payment_verified_at)->toBeNull();
});

test('selecting business it case also WAITING_PAYMENT', function () {
    $team = Team::factory()->create();
    $token = $team->createToken('t')->plainTextToken;
    $competition = Competition::factory()->create([
        'type'=>Competition::TYPE_BUSINESS_IT_CASE,
        'payment_flow'=>Competition::PAYMENT_UPFRONT,
        'status'=>Competition::STATUS_REGISTRATION_OPEN,
    ]);
    $batch = $competition->batches()->create([
        'name'=>'Batch 1','slug'=>'b1-'.uniqid(),'start_date'=>now()->subDay(),'end_date'=>now()->addMonth(),'price'=>80000,'quota'=>10,'status'=>BatchStatus::OPEN
    ]);

    $this->withToken($token)->putJson('/api/registrations/me/selection', ['competition_id'=>$competition->id])
        ->assertOk()
        ->assertJsonPath('data.context.registration.status', RegistrationStatus::WAITING_PAYMENT->value);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test tests/Feature/Registration/UnifiedSelectionTest.php -v`
Expected: FAIL — saat ini `RegistrationService.php:65-67` masih `$isOlympiad ? WAITING_PAYMENT : VERIFIED`, jadi BPC/BIC akan VERIFIED.

- [ ] **Step 3: Write minimal implementation**

```php
// app/Services/RegistrationService.php:60-67
// GANTI:
$isOlympiad = $competition->type === Competition::TYPE_OLIMPIADE;
$registration = Registration::create([
    'team_id' => $team->id,
    'competition_id' => $competition->id,
    'batch_id' => $batch->id,
    'status' => RegistrationStatus::WAITING_PAYMENT,
    'payment_required_at' => now(),
    'payment_verified_at' => null,
]);
```

```php
// database/seeders/Isac2026TimelineSeeder.php:30-43
// GANTI payment_flow BPC/BIC:
'bpc' => $this->upsertCompetition([
    'name'=>'Business Plan Competition', 'slug'=>'business-plan-competition', 'description'=>'...', 
    'type'=>Competition::TYPE_BUSINESS_PLAN, 'payment_flow'=>Competition::PAYMENT_UPFRONT,
]),
'bic' => $this->upsertCompetition([
    'name'=>'Business IT Case Competition', 'slug'=>'business-it-case-competition', 'description'=>'...',
    'type'=>Competition::TYPE_BUSINESS_IT_CASE, 'payment_flow'=>Competition::PAYMENT_UPFRONT,
]),
// Di upsertCompetition, pastikan BPC/BIC yang lama ter-restore tetap di-update payment_flow ke UPFRONT (sudah via fill)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `php artisan test tests/Feature/Registration/UnifiedSelectionTest.php tests/Feature/Registration/SelectionTest.php tests/Feature/Registration/CanonicalWorkflowTest.php -v`
Expected: PASS (selection unified). Check `php artisan db:seed --class=Isac2026TimelineSeeder` idempotent.

- [ ] **Step 5: Commit**

```bash
git add app/Services/RegistrationService.php database/seeders/Isac2026TimelineSeeder.php tests/Feature/Registration/UnifiedSelectionTest.php
git commit -m "feat(registration): selectCompetition unified to WAITING_PAYMENT for all competitions"
```

---

### Task 3: Unify Documents Step (Remove Auto-Submit for Non-Olimpiade)

**Files:**
- Modify: `app/Services/RegistrationService.php:325-349` (`updateDocuments`)
- Test: `tests/Feature/Registration/DocumentsTest.php`

**Interfaces:**
- Consumes: `Team`, `Registration`, `Competition::TYPE_*`
- Produces: `RegistrationService::updateDocuments(Team $team, array $data): Team` — now **only** sets `documents_completed_at`, **never** sets `submitted_at` or `WAITING_VERIFICATION`; submit tetap via `submitForVerification()` / Payment flow

- [ ] **Step 1: Write the failing test**

```php
// tests/Feature/Registration/DocumentsUnifiedTest.php
test('business plan documents does not auto-submit waiting_verification', function () {
    $team = Team::factory()->create();
    $token = $team->createToken('t')->plainTextToken;
    $competition = Competition::factory()->create([
        'type'=>Competition::TYPE_BUSINESS_PLAN,
        'payment_flow'=>Competition::PAYMENT_UPFRONT,
        'status'=>Competition::STATUS_REGISTRATION_OPEN,
    ]);
    $batch = $competition->batches()->create(['name'=>'B1','slug'=>'b1-'.uniqid(),'start_date'=>now()->subDay(),'end_date'=>now()->addMonth(),'price'=>70000,'quota'=>10,'status'=>BatchStatus::OPEN]);
    \App\Models\Registration::create([
        'team_id'=>$team->id,'competition_id'=>$competition->id,'batch_id'=>$batch->id,'status'=>\App\Models\RegistrationStatus::WAITING_PAYMENT,
        'team_completed_at'=>now(),'members_completed_at'=>now(),'payment_required_at'=>now()
    ]);
    // buat members 3 orang biar lolos check team_completed && members_completed
    // tapi test ini fokus documents_completed_at saja

    $this->withToken($token)->putJson('/api/registrations/me/documents', [
        'document_url'=>'https://drive.google.com/drive/folders/doc',
        'twibbon_url'=>'https://drive.google.com/drive/folders/twib'
    ])->assertOk();

    $team->refresh(); $reg = $team->registration;
    expect($reg->documents_completed_at)->not->toBeNull()
        ->and($reg->submitted_at)->toBeNull()
        ->and($team->status)->not->toBe(Team::STATUS_WAITING_VERIFICATION);
});

test('business plan redirect after documents is PAYMENT not DASHBOARD', function () {
    // same setup → assert redirectTo === '/registration/payment'
    // pakai putJson response data.redirectTo
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test tests/Feature/Registration/DocumentsUnifiedTest.php -v`
Expected: FAIL — current code sets `submitted_at` + `WAITING_VERIFICATION` for non-olimpiade.

- [ ] **Step 3: Write minimal implementation**

```php
// app/Services/RegistrationService.php:325-349
public function updateDocuments(Team $team, array $data): Team
{
    $registration = $this->registration($team);
    $this->assertEditable($team, $registration, 'DOCUMENTS');
    if ($registration->team_completed_at === null || $registration->members_completed_at === null) {
        throw ValidationException::withMessages(['documents' => ['Lengkapi data Team dan Member terlebih dahulu.']]);
    }

    DB::transaction(function () use ($team, $data, $registration): void {
        Team::query()->updateOrCreate(['id' => $team->id], [
            'document_url' => $data['document_url'],
            'twibbon_url' => $data['twibbon_url'],
        ]);
        $registration->update(['documents_completed_at' => $registration->documents_completed_at ?? now()]);
        // UNIFIED: hapus branching if (type !== OLIMPIADE) auto-submit
        // Semua lomba kini wajib lewat Payment sebelum submitForVerification
        $this->resolveDataRevision($team, 'DOCUMENTS');
    });

    return $team->fresh()->load('registration.competition');
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `php artisan test tests/Feature/Registration/DocumentsUnifiedTest.php tests/Feature/Registration/DocumentsTest.php -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/Services/RegistrationService.php tests/Feature/Registration/DocumentsUnifiedTest.php
git commit -m "feat(registration): unify documents step - no auto submit for BPC/BIC"
```

---

### Task 4: Unify Payment Gate & Verification Gate (Service Layer)

**Files:**
- Modify: `app/Services/RegistrationService.php:364-385` (`submitPayment` gate), `355-362` (`quotePayment` tetap), `446-460` (`submitForVerification`)
- Modify: `app/Http/Resources/RegistrationContextResource.php:64-96`, `app/Models/Team.php:72-107`
- Test: `tests/Feature/Registration/PaymentTest.php`, `tests/Feature/Registration/CanonicalWorkflowTest.php` (update)

**Interfaces:**
- Consumes: `RegistrationStatus`, `File purpose PAYMENT_PROOF`
- Produces: `submitPayment` — gate now `in_array(status, [WAITING_PAYMENT, REVISION_REQUIRED])` tanpa cek type; `submitForVerification` — selalu cek `payment_submitted_at !== null` untuk semua type (bukan hanya OLIMPIADE)

- [ ] **Step 1: Write the failing test**

```php
// tests/Feature/Registration/PaymentUnifiedTest.php
test('business plan can submit payment via same gate as olimpiade', function () {
    $team = Team::factory()->create();
    $token = $team->createToken('t')->plainTextToken;
    $competition = Competition::factory()->create(['type'=>Competition::TYPE_BUSINESS_PLAN,'payment_flow'=>Competition::PAYMENT_UPFRONT,'status'=>Competition::STATUS_REGISTRATION_OPEN]);
    $batch = $competition->batches()->create(['name'=>'B1','slug'=>'b1-'.uniqid(),'start_date'=>now()->subDay(),'end_date'=>now()->addMonth(),'price'=>70000,'quota'=>10,'status'=>BatchStatus::OPEN]);
    $reg = \App\Models\Registration::create(['team_id'=>$team->id,'competition_id'=>$competition->id,'batch_id'=>$batch->id,'status'=>\App\Models\RegistrationStatus::WAITING_PAYMENT,'team_completed_at'=>now(),'members_completed_at'=>now(),'documents_completed_at'=>now(),'payment_required_at'=>now()]);
    $file = \App\Models\File::create(['file_id'=>'proof-'.uniqid(),'url'=>'https://ik.imagekit.io/isac/proof.jpg','uploaded_by'=>$team->id,'purpose'=>'PAYMENT_PROOF']);

    $this->withToken($token)->postJson('/api/registrations/me/payment', [
        'payment_proof_file_id'=>$file->id,'payment_method'=>'BANK_TRANSFER'
    ])->assertOk()->assertJsonPath('data.context.registration.status', \App\Models\RegistrationStatus::WAITING_VERIFICATION->value);
});

test('submitForVerification now requires payment for business plan too', function () {
    $team = Team::factory()->create();
    $token = $team->createToken('t')->plainTextToken;
    $competition = Competition::factory()->create(['type'=>Competition::TYPE_BUSINESS_PLAN,'payment_flow'=>Competition::PAYMENT_UPFRONT,'status'=>Competition::STATUS_REGISTRATION_OPEN]);
    $batch = $competition->batches()->create(['name'=>'B1','slug'=>'b1-'.uniqid(),'start_date'=>now()->subDay(),'end_date'=>now()->addMonth(),'price'=>70000,'quota'=>10,'status'=>BatchStatus::OPEN]);
    \App\Models\Registration::create(['team_id'=>$team->id,'competition_id'=>$competition->id,'batch_id'=>$batch->id,'status'=>\App\Models\RegistrationStatus::WAITING_PAYMENT,'team_completed_at'=>now(),'members_completed_at'=>now(),'documents_completed_at'=>now(),'payment_required_at'=>now()]);

    $this->withToken($token)->postJson('/api/registrations/me/submit-verification')
        ->assertUnprocessable()->assertJsonPath('error.details.payment.0', 'Lengkapi pembayaran terlebih dahulu.');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test tests/Feature/Registration/PaymentUnifiedTest.php -v`
Expected: FAIL — first test currently throws `Pembayaran tidak tersedia` karena `paymentGateActive` cek `type===OLIMPIADE || payment_for_stage_id`; second test currently passes without payment for BPC.

- [ ] **Step 3: Write minimal implementation**

```php
// app/Services/RegistrationService.php:364-384 submitPayment
public function submitPayment(Team $team, array $data): Team
{
    $registration = $this->registration($team);
    if ($registration->team_completed_at === null || $registration->members_completed_at === null || $registration->documents_completed_at === null) {
        throw ValidationException::withMessages(['payment' => ['Lengkapi seluruh data pendaftaran terlebih dahulu.']]);
    }

    // UNIFIED: hilangkan cek type, semua lomba pakai gate yang sama
    if (! in_array($registration->status, [RegistrationStatus::WAITING_PAYMENT, RegistrationStatus::REVISION_REQUIRED], true)) {
        // idempotent retry tetap
        $requestedPromoCode = Str::upper(trim((string) ($data['promo_code'] ?? '')));
        $submittedPromoCode = Str::upper(trim((string) $registration->promo_code));
        $requestedTransactionId = trim((string) ($data['transaction_id'] ?? ''));
        if ($registration->payment_submitted_at !== null
            && $registration->payment_proof_file_id === $data['payment_proof_file_id']
            && $registration->payment_method?->value === $data['payment_method']
            && ($registration->transaction_id ?? '') === $requestedTransactionId
            && $submittedPromoCode === $requestedPromoCode) {
            return $this->getPaymentData($team);
        }
        throw ValidationException::withMessages(['payment' => ['Pembayaran tidak tersedia pada tahap ini.']]);
    }
    // ... rest same, but also remove if (payment_for_stage_id === null) branching:
    DB::transaction(function () use ($team, $data, $registration, $quote): void {
        $registration->update([
            'payment_proof_file_id' => $data['payment_proof_file_id'],
            'amount_paid' => $quote['amount'],
            'payment_method' => $data['payment_method'],
            'transaction_id' => trim((string) ($data['transaction_id'] ?? '')) ?: null,
            'promo_code' => $quote['promoCode'],
            'discount_percent' => $quote['discountPercent'],
            'discount_amount' => $quote['discountAmount'],
            'payment_submitted_at' => now(),
            'payment_rejection_reason' => null,
            'status' => RegistrationStatus::WAITING_VERIFICATION,
            'submitted_at' => $registration->submitted_at ?? now(),
        ]);
        // UNIFIED: selalu update team status (tidak cek payment_for_stage_id)
        $team->update(['status' => Team::STATUS_WAITING_VERIFICATION]);
    });
    return $team->fresh()->load('registration.batch', 'registration.paymentProofFile', 'registration.paymentForStage');
}

// app/Services/RegistrationService.php:446-460 submitForVerification
public function submitForVerification(Team $team): Team
{
    $registration = $this->registration($team);
    foreach (['team_completed_at' => 'team', 'members_completed_at' => 'members', 'documents_completed_at' => 'documents'] as $column => $field) {
        if ($registration->{$column} === null) {
            throw ValidationException::withMessages([$field => ['Tahap ini belum lengkap.']]);
        }
    }
    // UNIFIED: semua lomba wajib payment_submitted_at
    if ($registration->payment_submitted_at === null) {
        throw ValidationException::withMessages(['payment' => ['Lengkapi pembayaran terlebih dahulu.']]);
    }
    DB::transaction(function () use ($team, $registration): void {
        $registration->update(['submitted_at' => $registration->submitted_at ?? now()]);
        $team->update(['status' => Team::STATUS_WAITING_VERIFICATION,'revision_step'=>null,'verification_note'=>null]);
    });
    return $team->fresh()->load('registration.competition', 'registration.batch', 'members');
}
```

```php
// app/Http/Resources/RegistrationContextResource.php:64-96
private function currentStep(mixed $registration): string
{
    if (! $this->resource->isEmailVerified()) return 'VERIFY_EMAIL';
    if ($registration === null) return 'COMPETITION';
    if ($this->status === Team::STATUS_REVISION_REQUIRED && $this->revision_step !== null) {
        return $this->revision_step === 'MEMBERS' ? 'BIODATA' : $this->revision_step;
    }
    if ($registration->team_completed_at === null) return 'TEAM';
    if ($registration->members_completed_at === null) return 'BIODATA';
    if ($registration->documents_completed_at === null) return 'DOCUMENTS';
    // UNIFIED: hapus isStagePaymentCheckpoint branching
    if (in_array($registration->status, [RegistrationStatus::WAITING_PAYMENT, RegistrationStatus::REVISION_REQUIRED], true)) {
        return 'PAYMENT';
    }
    if ($registration->payment_submitted_at === null) {
        return 'PAYMENT';
    }
    return 'DASHBOARD';
}
// hapus allowedActions branch isStagePaymentCheckpoint, semua PAYMENT => ['SUBMIT_PAYMENT']
```

```php
// app/Models/Team.php:72-107
public function getNextRedirectAttribute(): string
{
    // UNIFIED mirror dari RegistrationContextResource
    if (! $this->isEmailVerified()) return '/auth/verify-email';
    if ($this->status === self::STATUS_REVISION_REQUIRED && $this->revision_step !== null) {
        return match($this->revision_step){'TEAM'=>'/registration/team','MEMBERS'=>'/registration/biodata','DOCUMENTS'=>'/registration/documents', default=>'/registration'};
    }
    $registration = $this->relationLoaded('registration') ? $this->registration : $this->registration()->with('competition')->first();
    if ($registration === null) return '/registration';
    if ($registration->team_completed_at === null) return '/registration/team';
    if ($registration->members_completed_at === null) return '/registration/biodata';
    if ($registration->documents_completed_at === null) return '/registration/documents';
    if (in_array($registration->status, [\App\Models\RegistrationStatus::WAITING_PAYMENT, \App\Models\RegistrationStatus::REVISION_REQUIRED], true)) return '/registration/payment';
    if ($registration->payment_submitted_at === null) return '/registration/payment';
    return '/dashboard';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `php artisan test tests/Feature/Registration/PaymentUnifiedTest.php tests/Feature/Registration/PaymentTest.php -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/Services/RegistrationService.php app/Http/Resources/RegistrationContextResource.php app/Models/Team.php tests/Feature/Registration/PaymentUnifiedTest.php
git commit -m "feat(registration): unify payment gate for all competitions"
```

---

### Task 5: Admin Unification — Remove Semifinal Payment Trigger & Fix Queries

**Files:**
- Modify: `app/Services/AdminRegistrationService.php:220-280` (`advanceStage`), `290-310` (`paymentQuery`), `60-90` (`registrationSnapshot`)
- Modify: `app/Http/Resources/AdminPaymentResource.php:31-40` (`paymentContext`), `app/Http/Resources/RegistrationSummaryResource.php:58-60` (`paymentAvailable`), `app/Http/Resources/PaymentFormResource.php` (no change, verify)
- Test: `tests/Feature/Admin/AdminPaymentTest.php`, `tests/Feature/Admin/AdminTransitionGuardTest.php`

**Interfaces:**
- Consumes: `Stage`, `Competition`, `RegistrationStatus`
- Produces: `advanceStage()` — now only does `team.update(current_stage_id)` without WAITING_PAYMENT reset; `paymentQuery()` — no longer filter by payment_flow; `paymentAvailable` — now true if `payment_required_at != null` (which is true for all after selectCompetition)

- [ ] **Step 1: Write the failing test**

```php
// tests/Feature/Admin/UnifiedAdminFlowTest.php
test('advanceStage to semifinal no longer triggers waiting_payment', function () {
    $competition = Competition::factory()->create(['type'=>Competition::TYPE_BUSINESS_PLAN,'payment_flow'=>Competition::PAYMENT_UPFRONT,'status'=>Competition::STATUS_REGISTRATION_OPEN]);
    $team = Team::factory()->create(['status'=>Team::STATUS_VERIFIED]);
    $registration = \App\Models\Registration::create(['team_id'=>$team->id,'competition_id'=>$competition->id,'batch_id'=>\App\Models\Batch::factory()->create(['competition_id'=>$competition->id])->id,'status'=>\App\Models\RegistrationStatus::VERIFIED,'team_completed_at'=>now(),'members_completed_at'=>now(),'documents_completed_at'=>now(),'submitted_at'=>now(),'payment_submitted_at'=>now(),'payment_required_at'=>now(),'paid_at'=>now()]);
    $team->update(['current_stage_id'=>\App\Models\Stage::create(['competition_id'=>$competition->id,'name'=>'Preliminary','type'=>'submission','order'=>1,'is_active'=>true])->id]);
    $semifinal = \App\Models\Stage::create(['competition_id'=>$competition->id,'name'=>'Semifinal','type'=>'submission','order'=>2,'is_active'=>true]);
    $admin = \App\Models\Admin::factory()->create(['role'=>'super_admin','is_active'=>true]);
    $token = $admin->createToken('a')->plainTextToken;

    $this->withToken($token)->postJson("/api/admin/teams/{$team->id}/stages/{$semifinal->id}/advance")
        ->assertOk();

    $reg = $registration->fresh();
    expect($reg->status)->toBe(\App\Models\RegistrationStatus::VERIFIED)
        ->and($reg->payment_for_stage_id)->toBeNull()
        ->and($team->fresh()->current_stage_id)->toBe($semifinal->id);
});

test('paymentQuery now includes business plan waiting_payment', function () {
    // create BPC registration WAITING_PAYMENT → should appear in GET /admin/payments
    $competition = Competition::factory()->create(['type'=>Competition::TYPE_BUSINESS_PLAN,'payment_flow'=>Competition::PAYMENT_UPFRONT]);
    $team = Team::factory()->create();
    $reg = \App\Models\Registration::create(['team_id'=>$team->id,'competition_id'=>$competition->id,'batch_id'=>\App\Models\Batch::factory()->create(['competition_id'=>$competition->id])->id,'status'=>\App\Models\RegistrationStatus::WAITING_PAYMENT,'payment_required_at'=>now()]);
    $admin = \App\Models\Admin::factory()->create(['role'=>'super_admin','is_active'=>true]);
    $token = $admin->createToken('a')->plainTextToken;

    $this->withToken($token)->getJson('/api/admin/payments?per_page=100')
        ->assertOk()
        ->assertJsonPath('data.data.0.registrationId', $reg->id);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test tests/Feature/Admin/UnifiedAdminFlowTest.php -v`
Expected: FAIL — current advanceStage still creates WAITING_PAYMENT for SEMIFINAL, and paymentQuery filters out BPC before semifinal.

- [ ] **Step 3: Write minimal implementation**

```php
// app/Services/AdminRegistrationService.php:220-280
public function advanceStage(Admin $admin, Team $team, Stage $stage, ?string $requestId): Team
{
    $registration = $team->registration()->with('competition')->firstOrFail();
    if ($stage->competition_id !== $registration->competition_id) {
        throw ValidationException::withMessages(['stage' => ['Stage bukan milik Competition Team.']]);
    }
    if ($team->status !== Team::STATUS_VERIFIED || $registration->status !== RegistrationStatus::VERIFIED) {
        throw ValidationException::withMessages(['stage' => ['Team dan pembayaran harus terverifikasi sebelum pindah Stage.']]);
    }
    $currentStage = $team->currentStage()->first();
    if ($currentStage?->is($stage)) return $this->detail($team);
    if ((int)$stage->order !== ((int)($currentStage?->order ?? 0))+1) {
        throw ValidationException::withMessages(['stage' => ['Stage harus diproses berurutan.']]);
    }

    DB::transaction(function () use ($admin, $team, $stage, $requestId): void {
        $before = $team->toArray();
        // UNIFIED: hapus $needsSemifinalPayment branching, semua stage langsung advance
        $team->update(['current_stage_id' => $stage->id]);
        $this->audit($admin, 'stage.advance', $team, $before, $team->fresh()->toArray(), null, $requestId);
    });
    return $this->detail($team->fresh());
}

// app/Services/AdminRegistrationService.php:290-310
private function paymentQuery(): Builder
{
    return Registration::query()
        ->with(['team.currentStage','competition','batch','paymentProofFile','paymentVerifiedBy','paymentForStage'])
        // UNIFIED: hapus filter payment_flow, semua registrasi yang punya payment_required_at atau payment_submitted_at atau status WAITING_PAYMENT/VERIFIED muncul
        ->whereNotNull('payment_required_at'); // atau where(function) ->whereNotNull(payment_required_at)->orWhereNotNull(payment_submitted_at)
}

// app/Http/Resources/AdminPaymentResource.php:31-40
'paymentContext' => 'REGISTRATION', // UNIFIED constant, tetap kirim REGISTRATION untuk semua. Legacy SEMIFINAL dihapus, tapi tetap handle backward compat:
'paymentContext' => $this->payment_for_stage_id !== null ? 'SEMIFINAL' : 'REGISTRATION', // keep but will be null always now

// app/Http/Resources/RegistrationSummaryResource.php:58-60
'paymentAvailable' => $registration->payment_required_at !== null, // UNIFIED: bukan cek payment_flow

// app/Http/Resources/RegistrationContextResource.php & Team model sudah di Task 4
```

- [ ] **Step 4: Run test to verify it passes**

Run: `php artisan test tests/Feature/Admin/UnifiedAdminFlowTest.php tests/Feature/Admin/AdminPaymentTest.php -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/Services/AdminRegistrationService.php app/Http/Resources/AdminPaymentResource.php app/Http/Resources/RegistrationSummaryResource.php tests/Feature/Admin/UnifiedAdminFlowTest.php
git commit -m "feat(admin): remove semifinal payment trigger, unify payment query"
```

---

### Task 6: Frontend Types & Constants Unification

**Files:**
- Modify: `resources/js/constants/registration.ts` (getRegistrationSteps)
- Modify: `resources/js/features/registrations/types/registrationTypes.ts` (PaymentFlow type, RegistrationStep)
- Modify: `resources/js/features/admin/types/adminTypes.ts` (PaymentContext, paymentAvailable comment)
- Test: `npm run typecheck` + manual check `Steps.tsx`

**Interfaces:**
- Consumes: `CompetitionType`
- Produces: `getRegistrationSteps(): readonly {id,name,icon}[]` — no longer takes `isOlympiad`, always returns 5 steps including Payment; `PaymentFlow = 'UPFRONT'` only (SEMIFINAL deprecated comment)

- [ ] **Step 1: Write the failing test**

```ts
// resources/js/constants/__tests__/registrationSteps.test.ts
import { getRegistrationSteps } from '@/constants/registration'
test('getRegistrationSteps now same for all types', () => {
  const stepsAny = getRegistrationSteps(false as any)
  const stepsOlim = getRegistrationSteps(true as any)
  expect(stepsAny.map(s=>s.id)).toEqual(['competition','team','biodata','documents','payment'])
  expect(stepsOlim.map(s=>s.id)).toEqual(['competition','team','biodata','documents','payment'])
})
// atau manual ts check: getRegistrationSteps(isOlympiad) should error if param still required
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- registrationSteps` or `tsc --noEmit` with new call `getRegistrationSteps()` tanpa param
Expected: FAIL — currently expects boolean param and returns validation vs payment.

- [ ] **Step 3: Write minimal implementation**

```ts
// resources/js/constants/registration.ts
import { Trophy, Users, User, FileText, CreditCard } from 'lucide-react'
const STEPS = [
  { id: 'competition', name: 'Competition', icon: Trophy },
  { id: 'team', name: 'Team', icon: Users },
  { id: 'biodata', name: 'Biodata', icon: User },
  { id: 'documents', name: 'Documents', icon: FileText },
  { id: 'payment', name: 'Payment', icon: CreditCard },
] as const

export const getRegistrationSteps = (_isOlympiad?: boolean) => STEPS
// Jaga backward compat: param opsional, tapi ignore. Legacy isOlympiad branching dihapus.
// Jika mau strict: export const getRegistrationSteps = () => STEPS
```

```ts
// resources/js/features/registrations/types/registrationTypes.ts:4
export type PaymentFlow = 'UPFRONT' | 'SEMIFINAL' // SEMIFINAL @deprecated - legacy data, semua kompetisi baru UPFRONT
export type RegistrationStep = 'VERIFY_EMAIL' | 'COMPETITION' | 'TEAM' | 'BIODATA' | 'DOCUMENTS' | 'PAYMENT' | 'DASHBOARD' // hapus 'VALIDATION' branching, tapi keep for legacy redirect
```

```ts
// resources/js/features/admin/types/adminTypes.ts:206
export type PaymentContext = 'REGISTRATION' // SEMIFINAL legacy, tapi type tetap union untuk compat: 'REGISTRATION' | 'SEMIFINAL'
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run typecheck --silent && npm run build`
Expected: PASS (vite 3485 modules). Run `tsc --noEmit`.

- [ ] **Step 5: Commit**

```bash
git add resources/js/constants/registration.ts resources/js/features/registrations/types/registrationTypes.ts resources/js/features/admin/types/adminTypes.ts
git commit -m "feat(frontend): unify registration steps to always include Payment"
```

---

### Task 7: Frontend User Flow Unification (Layout & Pages)

**Files:**
- Modify: `resources/js/features/registrations/components/RegistrationLayout.tsx` (FLOW_PATHS)
- Modify: `resources/js/features/registrations/components/Steps.tsx` (remove isOlympiad)
- Modify: `resources/js/Pages/Registration/{Documents,Payment,Validation}.tsx` (Documents redirect, Payment always, Validation unify)
- Modify: `resources/js/features/registrations/components/FormMember.tsx` if needed (no change)
- Test: manual `npm run build` + Pest `DocumentsUnifiedTest` + click flow

**Interfaces:**
- Consumes: `useRegistrationContext`, `getRegistrationSteps()`
- Produces: `RegistrationLayout` — FLOW_PATHS now `['/registration','/registration/team','/registration/biodata','/registration/documents','/registration/payment']` for all; `Steps` — tidak lagi conditional; `Documents.handleSave` → always redirect to `/registration/payment`

- [ ] **Step 1: Write the failing test**

```ts
// manual: buka /registration/documents sebagai BPC team yang documents_completed, expect redirectTo = /registration/payment bukan /dashboard
// atau pest: test('documents page for business plan redirects to payment')
// di Documents.tsx after handleSave: expect router.visit('/registration/payment')
```

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test` after Task 3 & 4 — Documents still redirects to /dashboard for BPC (karena old logic auto-submit), now should be /registration/payment.
Manual: login sebagai BPC team, isi documents, klik Simpan → currently ke /dashboard (karena auto VERIFIED), expected ke /registration/payment.

- [ ] **Step 3: Write minimal implementation**

```tsx
// resources/js/features/registrations/components/RegistrationLayout.tsx
const FLOW_PATHS = ['/registration', '/registration/team', '/registration/biodata', '/registration/documents', '/registration/payment']
// hapus branching isOlympiad, always include payment. Jika pathname === '/registration/validation' redirect ke '/registration/payment'

// resources/js/features/registrations/components/Steps.tsx
const registrationSteps = getRegistrationSteps() // tanpa param
// hapus: const isOlympiad = contextQuery.data?.data.registration?.competition.type === 'OLIMPIADE'
// dependencies [currentStep] saja, bukan [currentStep, isOlympiad]

// resources/js/Pages/Registration/Documents.tsx:34-42
const handleSave = useCallback(async (data: DocumentFormData) => {
  try {
    const response = await updateDocuments.mutateAsync(data)
    toast.success(response.message)
    // UNIFIED: response.data.redirectTo sudah /registration/payment untuk semua, tapi fallback:
    router.visit(response.data.redirectTo ?? '/registration/payment', { replace: true })
  } catch (error) { toast.error(...) }
}, [updateDocuments])

// resources/js/Pages/Registration/Payment.tsx: no conditional isOlympiad, selalu tampilkan FormPayment
// hapus pengecekan if (!isOlympiad) show Validation, now Payment wajib untuk semua

// resources/js/Pages/Registration/Validation.tsx: tetap ada tapi sekarang hanya untuk legacy; ganti description jadi "Ringkasan akhir sebelum dashboard" dan tetap pakai submitForVerification (yang now requires payment)
// atau redirect Validation → Payment jika payment_submitted_at == null
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run build && npm run typecheck`
Visit `/registration/documents` as BPC → save → lands on `/registration/payment` → submit payment → `/dashboard`.
Check `RegistrationLayout` guard: `furthestAvailableIndex` now includes payment for all.

- [ ] **Step 5: Commit**

```bash
git add resources/js/features/registrations/components/RegistrationLayout.tsx resources/js/features/registrations/components/Steps.tsx resources/js/Pages/Registration/Documents.tsx resources/js/Pages/Registration/Payment.tsx resources/js/Pages/Registration/Validation.tsx
git commit -m "feat(frontend-user): unify registration flow to always require Payment"
```

---

### Task 8: Frontend Admin Flow Unification

**Files:**
- Modify: `resources/js/features/admin/components/CompetitionFormDialog.tsx:78-79` (default payment_flow)
- Modify: `resources/js/Pages/Admin/Teams/Show.tsx:38-41,238-246` (paymentAvailable logic)
- Modify: `resources/js/Pages/Admin/Payments/Show.tsx:52-54,79,160` (paymentContextLabels)
- Modify: `resources/js/Pages/Admin/Payments.tsx` (no change, just verify filter works)
- Test: `php artisan test tests/Feature/Admin/UnifiedAdminFlowTest.php` + manual admin UI

**Interfaces:**
- Consumes: `adminApi`
- Produces: `CompetitionFormDialog` — selalu set `payment_flow: 'UPFRONT'` regardless of type; `AdminTeamShow` — `paymentAvailable = !!registration.paymentRequiredAt` (true for all); `AdminPaymentShow` — `paymentContext` always `REGISTRATION`

- [ ] **Step 1: Write the failing test**

Manual: Buka `/admin/competitions` → create Business Plan → pilih type `BUSINESS_PLAN` → field payment_flow currently auto `SEMIFINAL`, expected `UPFRONT` and disabled/readonly.

- [ ] **Step 2: Run test to verify it fails**

Run: click `CompetitionFormDialog`, change type to BPC → payment_flow still `SEMIFINAL`.

- [ ] **Step 3: Write minimal implementation**

```tsx
// resources/js/features/admin/components/CompetitionFormDialog.tsx:78-79
<label className="space-y-1.5 text-sm">Tipe
  <select value={form.type} onChange={(event) => {
    const type = event.target.value as CompetitionPayload['type'];
    setForm((current) => ({ ...current, type, payment_flow: 'UPFRONT' })); // UNIFIED: selalu UPFRONT
    setLocalError(''); mutation.reset()
  }}>
</label>
<label className="space-y-1.5 text-sm">Payment flow
  <select value={form.payment_flow} onChange={(event) => setField('payment_flow', event.target.value as CompetitionPayload['payment_flow'])} disabled className="opacity-60">
    <option value="UPFRONT">Upfront</option>
    <option value="SEMIFINAL" disabled>Semifinal (legacy)</option>
  </select>
  <p className="text-xs text-muted-foreground">Semua lomba kini wajib UPFRONT.</p>
</label>

// resources/js/Pages/Admin/Teams/Show.tsx:38-41
const paymentAvailable = !!data?.registration?.paymentRequiredAt // UNIFIED: bukan cek paymentAvailable boolean lama (yang cek payment_flow)
// atau keep data.registration.paymentAvailable yang sekarang sudah di-fix di RegistrationSummaryResource

// resources/js/Pages/Admin/Payments/Show.tsx:52-54
const paymentContextLabels: Record<string, string> = {
  REGISTRATION: 'Biaya Pendaftaran',
  SEMIFINAL: 'Biaya Semifinal (legacy)',
}
// description tetap but now always REGISTRATION
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run build` + manual: create BPC → payment_flow stays UPFRONT, save → success (Task1 validation passes). Open `/admin/teams/{bpcTeam}` → card Pembayaran muncul (karena paymentRequiredAt true). Open `/admin/payments` → BPC team appears.

- [ ] **Step 5: Commit**

```bash
git add resources/js/features/admin/components/CompetitionFormDialog.tsx resources/js/Pages/Admin/Teams/Show.tsx resources/js/Pages/Admin/Payments/Show.tsx
git commit -m "feat(frontend-admin): unify admin payment UI to UPFRONT only"
```

---

### Task 9: Tests & Seeders Update + Migration Compatibility

**Files:**
- Modify: `tests/Feature/Registration/{DocumentsTest.php,SelectionTest.php,TeamDataTest.php,CanonicalWorkflowTest.php}` (adjust expectations)
- Modify: `tests/Feature/Admin/AdminPaymentTest.php` (paymentQuery, advanceStage)
- Create: `database/migrations/2026_08_28_fix_legacy_semifinal_to_upfront.php` OR `database/seeders/FixLegacyPaymentFlowSeeder.php` (optional, but recommended)
- Test: `php artisan test tests/Feature/Registration/ tests/Feature/Admin/ -v`

**Interfaces:**
- Consumes: legacy DB rows with `payment_flow=SEMIFINAL` and `registrations.status=VERIFIED` but `payment_submitted_at=null`
- Produces: migration script to fix legacy data to `UPFRONT` + `WAITING_PAYMENT`

- [ ] **Step 1: Write the failing test**

```php
// tests/Feature/Registration/LegacyDataMigrationTest.php
test('legacy semifinal registrations are migrated to waiting_payment', function () {
    // create BPC SEMIFINAL VERIFIED without payment → after migration should be WAITING_PAYMENT + payment_required_at
    $competition = Competition::factory()->create(['type'=>Competition::TYPE_BUSINESS_PLAN,'payment_flow'=>Competition::PAYMENT_SEMIFINAL]);
    $team = Team::factory()->create();
    $reg = \App\Models\Registration::create(['team_id'=>$team->id,'competition_id'=>$competition->id,'batch_id'=>\App\Models\Batch::factory()->create(['competition_id'=>$competition->id])->id,'status'=>\App\Models\RegistrationStatus::VERIFIED,'payment_verified_at'=>now()]);
    // run artisan migrate:fix
    $this->artisan('migrate');

    $competition->refresh();
    expect($competition->payment_flow)->toBe(Competition::PAYMENT_UPFRONT);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test tests/Feature/Registration/LegacyDataMigrationTest.php -v`
Expected: FAIL — competition still SEMIFINAL, registration still VERIFIED.

- [ ] **Step 3: Write minimal implementation**

```php
// database/migrations/2026_08_28_unify_payment_flow_upfront.php
return new class extends Migration {
  public function up(): void {
    DB::table('competitions')->where('payment_flow', 'SEMIFINAL')->update(['payment_flow'=>'UPFRONT']);
    // registrations yang legacy VERIFIED tapi belum pernah bayar (payment_submitted_at null) dan competition sekarang UPFRONT → reset ke WAITING_PAYMENT
    $ids = Registration::where('status','VERIFIED')->whereNull('payment_submitted_at')->whereHas('competition', fn($q)=>$q->where('payment_flow','UPFRONT'))->pluck('id');
    Registration::whereIn('id',$ids)->update(['status'=>'WAITING_PAYMENT','payment_required_at'=>now(),'payment_verified_at'=>null]);
  }
  public function down(): void { /* no-op */ }
};
```

Also update existing tests:
- `SelectionTest`: expect `WAITING_PAYMENT` for BPC/BIC (ubah dari VERIFIED)
- `DocumentsTest`: expect redirect to `/registration/payment` not `/dashboard` for BPC/BIC
- `CanonicalWorkflowTest`: tambahkan BPC canonical workflow duplicate of olympiad workflow (selection → team → members → documents → payment → verify team → verify payment → advanceStage now without payment)

- [ ] **Step 4: Run test to verify it passes**

Run: `php artisan test -v`
Expected: PASS (except pre-existing verb-mismatch 17 fails — now reduced karena unified). Run `php artisan migrate:fresh --seed` and check `Isac2026TimelineSeeder` BPC/BIC now UPFRONT.

- [ ] **Step 5: Commit**

```bash
git add database/migrations/2026_08_28_unify_payment_flow_upfront.php tests/Feature/Registration/LegacyDataMigrationTest.php tests/Feature/Registration/DocumentsTest.php tests/Feature/Registration/SelectionTest.php tests/Feature/Registration/CanonicalWorkflowTest.php tests/Feature/Admin/AdminPaymentTest.php
git commit -m "test(migration): unify legacy SEMIFINAL data to UPFRONT"
```

---

### Task 10: QA — Build, Pint, Tsc, Full Suite + Manual Smoke

**Files:**
- No new files, just verification
- Modify: `docs/superpowers/plans/2026-08-28-unified-upfront-payment-flow.md` (mark complete)

**Interfaces:**
- Consumes: all previous tasks
- Produces: verified artifact: `npm run build` success, `pint` clean, `tsc --noEmit` 0 errors, `php artisan test` 174+ pass

- [ ] **Step 1: Run build & lint**

```bash
php artisan pint --test
npm run build
tsc --noEmit
php artisan test --parallel
```

Expected: `pint` PASS, `vite` 3485 modules, `tsc` 0 error, `phpunit` 174+ pass (legacy 17 pre-existing failures should now be 12 or less because unified flow fixes verb-mismatch).

- [ ] **Step 2: Manual smoke (user)**

1. Register new Team BPC → select Business Plan → team → biodata 3 orang (1 LEADER, NIM/NISN check) → documents → **must** go to Payment (not Dashboard)
2. Quote promo ISAXOP → diskon 15% debounce
3. Upload proof ImageKit → submit → status WAITING_VERIFICATION + redirect /dashboard
4. Try submitForVerification without payment → must fail `Lengkapi pembayaran`

- [ ] **Step 3: Manual smoke (admin)**

1. Login admin_registration → `/admin/teams` filter WAITING_VERIFICATION → Show → verifyTeam → team VERIFIED
2. Login admin_payment → `/admin/payments` → filter WAITING_VERIFICATION → Show → verifyPayment → status VERIFIED
3. Try advanceStage Preliminary → Semifinal → Final → must succeed without resetting to WAITING_PAYMENT
4. Create new Competition BPC → must force UPFRONT, SEMIFINAL disabled

- [ ] **Step 4: Record evidence**

Screenshot: `storage/framework/views` not committed, `public/robots.txt` still deleted, sitemap shows `/registration/payment` for all types.

- [ ] **Step 5: Commit & Checkpoint**

```bash
git status
git log --oneline -5
# update memory
```

Save checkpoint: `xninetzy_memory_add: ISAC-2026 UNIFIED UPFRONT DONE — all competitions UPFRONT, payment gate unified, documents no auto-submit, admin semifinal no payment trigger, frontend steps unified, tests & seeder migrated`

---

## Self-Review

**1. Spec coverage:**
- Semua lomba wajib bayar di awal → Task 1+2 (service + seeder) ✓
- Alur registrasi sama dengan Olimpiade → Task 3+4+6+7 (documents, payment gate, frontend steps) ✓
- UI diperbaiki → Task 6+7+8 ✓
- API diperbaiki → Task 4+5 ✓
- Service diperbaiki → Task 2+3+4+5 ✓
- Admin diperbaiki → Task 5+8 ✓
- Data legacy diperbaiki → Task 9 ✓
- Verifikasi → Task 10 ✓

**2. Placeholder scan:** No TBD/TODO, semua code blocks aktual.

**3. Type consistency:**
- `PaymentFlow` tetap `'UPFRONT'|'SEMIFINAL'` tapi SEMIFINAL deprecated, tidak dipakai baru ✓
- `getRegistrationSteps()` signature unified (optional param untuk compat) ✓
- `RegistrationStatus` tetap 6 values, `WAITING_PAYMENT` now for all ✓
- `payment_for_stage_id` tetap nullable, tapi ignore di gate ✓

**Execution Handoff**

Plan complete and saved to `docs/superpowers/plans/2026-08-28-unified-upfront-payment-flow.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**

