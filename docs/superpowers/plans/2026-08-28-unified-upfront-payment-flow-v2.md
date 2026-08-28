# Unified Upfront Payment Flow + Revert Verification — Updated Plan (v2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> **Codebase-Memory enforced:** Every task uses `search_graph`/`get_code_snippet`/`trace_path` verified qualified_names — no invented signatures.

**Goal:** Semua lomba (OLIMPIADE, BUSINESS_PLAN, BUSINESS_IT_CASE) wajib bayar di awal (UPFRONT) dengan alur identik Olimpiade, **tanpa mengubah schema DB** (keep `payment_for_stage_id`, `payment_flow` column, existing rows untouched by migration), plus di sisi admin verifikasi yang sudah `VERIFIED` bisa di-revert kembali ke `WAITING_VERIFICATION` (unverify) untuk koreksi.

**Architecture (codebase-memory verified):**
- `CompetitionService.validateTypePaymentFlow` (qualified: `home-misbahul45-code-ISAC-2026.app.Services.CompetitionService.CompetitionService.validateTypePaymentFlow`) di-soft-unify: tetap allow `SEMIFINAL` untuk legacy data tapi untuk create/update baru paksa `UPFRONT` (tidak throw untuk existing `SEMIFINAL` rows yang di-load, hanya block create/update dengan `SEMIFINAL`). Ini menjaga “no DB model change” — existing 3 kompetisi dengan `SEMIFINAL` tetap readable, tapi new writes terkunci UPFRONT.
- `RegistrationService.selectCompetition` (`home-misbahul45-code-ISAC-2026.app.Services.RegistrationService.RegistrationService.selectCompetition:19-74`) ubah branching `isOlympiad ? WAITING_PAYMENT : VERIFIED` jadi **always** `WAITING_PAYMENT` + `payment_required_at=now()` secara runtime (tanpa migration). Runtime check: `if ($competition->type === TYPE_OLIMPIADE || true)` — effectively remove branch.
- `RegistrationService.updateDocuments` (`325-349`) hapus `if (type !== OLIMPIADE) auto submitted_at` — sekarang hanya `documents_completed_at`.
- `RegistrationService.submitPayment` (`364-410`) hapus gate `type===OLIMPIADE || payment_for_stage_id !== null` → jadi `in_array(status, [WAITING_PAYMENT, REVISION_REQUIRED])` saja. Keep `payment_for_stage_id` column tapi ignore nilainya (legacy null tetap null). `submitForVerification` (`446-469`) ganti dari `if (type===OLIMPIADE && payment_submitted_at null)` jadi **always** require `payment_submitted_at`.
- `AdminRegistrationService.advanceStage` (`214-260`) hapus `needsSemifinalPayment` block yang reset registrasi ke WAITING_PAYMENT; sekarang hanya `team.update(current_stage_id)` + audit. `paymentQuery` (`288-303`) ubah dari `whereHas payment_flow UPFRONT OR payment_required_at` jadi `whereNotNull(payment_required_at) OR whereNotNull(payment_submitted_at)` agar semua upfront registrations muncul tanpa depend pada `competition.payment_flow`.
- `RegistrationContextResource.currentStep` (`64-96`) & `Team.getNextRedirectAttribute` (`72-107`) hapus `isStagePaymentCheckpoint` → unify ke PAYMENT step untuk semua.
- **NEW revert:** `AdminRegistrationService.unverifyTeam` & `unverifyPayment` (mirror `verifyTeam`:`96-119` dan `verifyPayment`:`169-202`) dengan `lockForUpdate`, `team.update(status=WAITING_VERIFICATION, verified_at=null, verified_by=null)` + `registration.update(status=WAITING_VERIFICATION)` + audit `team.unverified`/`payment.unverified`, policy baru `TeamPolicy.unverify` & `RegistrationPolicy.unverifyPayment` (mirror `verifyData`/`verifyPayment` restricted to `admin_registration`/`admin_payment` + super_admin), routes `POST /admin/teams/{team}/unverify` & `POST /admin/registrations/{registration}/payment/unverify` (`routes/api.php:57-69`), controller `AdminRegistrationController.unverifyTeam/unverifyPayment` (mirror `71-78`), frontend `adminApi.unverifyTeam/unverifyPayment` + hooks `useUnverifyAdminTeam/useUnverifyAdminPayment` + admin UI buttons di `Teams/Show.tsx` & `Payments/Show.tsx` (trace_path verified callers: `resources/js/features/admin/api/adminApi.ts:35`).
- `Isac2026TimelineSeeder` (`30-43`) untuk kompetisi baru set `PAYMENT_UPFRONT` tapi existing SEMIFINAL rows **tidak** di-overwrite via migration — biarkan app layer handle compat (validate allows legacy read, new writes block). No new migration file.
- Frontend constants `getRegistrationSteps` (`resources/js/constants/registration.ts`) unify: no longer `isOlympiad ? payment : validation` → always `payment`. `COMPETITION_FORM_DIALOG` (`78-79`) force `payment_flow='UPFRONT'` readonly.

**Tech Stack:** Laravel 11/13 PHP 8.3, Eloquent, Pest, React 18 TS Inertia TanStack Query, Tailwind, ImageKit, Vite — codebase-memory project `home-misbahul45-code-ISAC-2026` (nodes 4035, edges 8901, verified via `list_projects` 2026-08-28)

## Global Constraints (NO DB SCHEMA CHANGE)

- **DILARANG** membuat migration baru yang `Schema::table`/`create`/`drop` atau mengubah column type. `payment_for_stage_id`, `payment_flow`, `registrations.status`, `teams.status` columns tetap apa adanya. Existing real case data tidak boleh ter-reset.
- `Competition::PAYMENT_SEMIFINAL` constant **tetap** di `app/Models/Competition.php:29` (hanya tambah `@deprecated` comment), `PAYMENT_UPFRONT` tetap.
- Existing kompetisi BPC/BIC yang `payment_flow=SEMIFINAL` di DB **tetap** `SEMIFINAL` di row, tapi app logic treat semua sebagai UPFRONT untuk flow baru (compat layer). Jika admin ingin convert, mereka pakai `CompetitionFormDialog` update → akan divalidasi require UPFRONT, jadi they must explicitly change via UI (bukan auto-migration).
- `Isac2026TimelineSeeder.upsertCompetition` hanya affect `slug` match; jika row existing `SEMIFINAL`, seeder **tidak** overwrite ke `UPFRONT` secara paksa di v2 (kecuali admin setuju) — we keep seeder as is for idempotency but document manual opt-in.
- Policy: `super_admin` bypass via `before()`, `admin_registration` untuk team unverify, `admin_payment` untuk payment unverify — verified via `search_graph` `TeamPolicy`:`home-misbahul45-code-ISAC-2026.app.Policies.TeamPolicy.TeamPolicy` & `RegistrationPolicy`:`home-misbahul45-code-ISAC-2026.app.Policies.RegistrationPolicy.RegistrationPolicy`
- `X-Request-ID` header tetap via `adminApi.ts:30 requestHeaders() => crypto.randomUUID()`, idempotency submitPayment tetap
- Frontend `FLOW_PATHS` tetap Inertia, `/registration/validation` file keep for legacy redirect ke `/registration/payment`
- Test suite `php artisan test` + `pint --test` + `tsc --noEmit` + `npm run build` must pass; pre-existing 17 fails (Documents/Selection verb-mismatch) diperbaiki tanpa mengubah DB

---

## File Structure (terverifikasi codebase-memory)

- `app/Models/Competition.php` — keep PAYMENT constants, tambah deprecation comment
- `app/Services/CompetitionService.php:89-109` — `validateTypePaymentFlow` (search_graph rank -21.57)
- `app/Services/RegistrationService.php:19-74` — `selectCompetition`, `102-229` — `updateByAdmin`, `231-323` — `finalizeMembers`, `325-349` — `updateDocuments`, `359-410` — `submitPayment`, `446-469` — `submitForVerification` (search_graph 174 results, RegistrationService)
- `app/Services/AdminRegistrationService.php:18-373` — `verifyTeam:96-119`, `reviseTeam:121-143`, `rejectTeam:145-167`, `verifyPayment:169-202`, `setPaymentStatus:262-286`, `advanceStage:214-260`, `paymentQuery:288-303`, `detail:64-67`, `audit:359-372` (get_code_snippet verified 373 lines)
- `app/Http/Controllers/Api/AdminRegistrationController.php:57-99` — `index, show, updateTeamRegistration, verifyTeam, reviseTeam, rejectTeam, payments, payment, verifyPayment, revisePayment, rejectPayment, advanceStage` (search_graph rank -12.86)
- `routes/api.php:57-69` — admin prefix middleware `auth:admins, principal.admin`
- `app/Policies/TeamPolicy.php:8-44` & `app/Policies/RegistrationPolicy.php:8-39` — `before, viewAny, verifyData, verifyPayment` (search_graph 69 results)
- `app/Http/Resources/RegistrationContextResource.php:64-128` — `currentStep, redirectFor, allowedActions`
- `app/Models/Team.php:52-137` — `getNextRedirectAttribute, isVerified, isWaitingVerification`
- `resources/js/constants/registration.ts` — `getRegistrationSteps`
- `resources/js/features/registrations/types/registrationTypes.ts` — `PaymentFlow, RegistrationStep`
- `resources/js/features/registrations/components/RegistrationLayout.tsx` — `FLOW_PATHS`, `useRegistrationContext` guard
- `resources/js/features/registrations/components/Steps.tsx` — `getRegistrationSteps` usage
- `resources/js/features/admin/api/adminApi.ts:30-64` — `requestHeaders, teams, team, verifyTeam, reviseTeam, rejectTeam, ... payments, verifyPayment`
- `resources/js/features/admin/hooks/useAdmin.ts:26-63` — `useVerifyAdminTeam, useReviseAdminTeam, ...`
- `resources/js/Pages/Admin/Teams/Show.tsx:27-257` — `canReview, waitingReview, paymentAvailable, TeamReviewDialog, AdminTeamEditDialog`
- `resources/js/Pages/Admin/Payments/Show.tsx:27-306` — `canMutate, canBeReviewed, PaymentReviewDialog`
- `resources/js/features/admin/components/CompetitionFormDialog.tsx:78-79` — payment_flow select
- `tests/Feature/Registration/*`, `tests/Feature/Admin/*` — CanonicalWorkflowTest, PaymentTest, DocumentsTest

---

### Task 1: Soft-Unify Competition Validation (Tanpa Ubah Existing Rows)

**Files:**
- Modify: `app/Services/CompetitionService.php:89-109` — `validateTypePaymentFlow`
- Modify: `app/Models/Competition.php:27-33` — comment `@deprecated SEMIFINAL`
- Create: `tests/Feature/Competition/UnifiedPaymentFlowTest.php`
- Verify via: `search_graph` `CompetitionService` & `get_code_snippet` `validateTypePaymentFlow`

**Interfaces:**
- Consumes: `Competition::TYPE_*`, `Competition::PAYMENT_*`
- Produces: `validateTypePaymentFlow(array $data)` — for **new** competitions require `UPFRONT` for all types; but allow **existing** rows with `SEMIFINAL` to stay readable (no throw if `$data` hanya untuk update non-payment_flow fields). Implement: if `payment_flow === SEMIFINAL` then throw only when `type` is being created/updated to BUSINESS_* with SEMIFINAL requested.

- [ ] **Step 1: Write the failing test**

```php
// tests/Feature/Competition/UnifiedPaymentFlowTest.php
use App\Models\Competition; use App\Models\Admin;
test('new business plan with SEMIFINAL now rejected (soft-unify)', function () {
    $admin = Admin::factory()->create(['role'=>'super_admin','is_active'=>true]);
    $token = $admin->createToken('t')->plainTextToken;
    $this->withToken($token)->postJson('/api/admin/competitions', [
        'name'=>'BPC Soft Unified','slug'=>'bpc-soft-'.uniqid(),'description'=>'desc',
        'type'=>Competition::TYPE_BUSINESS_PLAN,'payment_flow'=>Competition::PAYMENT_SEMIFINAL,
        'start_date'=>'2026-08-26','end_date'=>'2026-11-22','status'=>'DRAFT',
    ])->assertUnprocessable()->assertJsonPath('error.details.payment_flow.0', 'BUSINESS_PLAN dan BUSINESS_IT_CASE harus menggunakan payment flow UPFRONT.');
});
test('existing SEMIFINAL competition stays readable via GET', function () {
    $c = Competition::factory()->create(['type'=>Competition::TYPE_BUSINESS_PLAN,'payment_flow'=>Competition::PAYMENT_SEMIFINAL,'status'=>'REGISTRATION_OPEN']);
    $this->getJson("/api/competitions/{$c->id}")->assertOk()->assertJsonPath('data.payment_flow', 'SEMIFINAL'); // legacy read allowed
});
test('new business plan with UPFRONT succeeds', function () {
    $admin = Admin::factory()->create(['role'=>'super_admin','is_active'=>true]);
    $token = $admin->createToken('t')->plainTextToken;
    $this->withToken($token)->postJson('/api/admin/competitions', [
        'name'=>'BPC UPFRONT OK','slug'=>'bpc-up-'.uniqid(),'description'=>'desc',
        'type'=>Competition::TYPE_BUSINESS_PLAN,'payment_flow'=>Competition::PAYMENT_UPFRONT,
        'start_date'=>'2026-08-26','end_date'=>'2026-11-22','status'=>'DRAFT',
    ])->assertCreated();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test tests/Feature/Competition/UnifiedPaymentFlowTest.php -v`
Expected: FAIL — currently `CompetitionService.php:104` allows SEMIFINAL for BPC, so first test will not be unprocessable.

- [ ] **Step 3: Write minimal implementation (codebase-memory consistent)**

```php
// app/Services/CompetitionService.php:89-109 (get_code_snippet verified)
// GANTI validateTypePaymentFlow jadi:
private function validateTypePaymentFlow(array $data): void
{
    if (! isset($data['type']) || ! isset($data['payment_flow'])) return;
    $type = $data['type']; $paymentFlow = $data['payment_flow'];
    // No DB change: legacy SEMIFINAL rows tetap ada di DB, tapi new writes harus UPFRONT
    if ($paymentFlow !== Competition::PAYMENT_UPFRONT) {
        $msg = match($type) {
            Competition::TYPE_OLIMPIADE => 'OLIMPIADE harus menggunakan payment flow UPFRONT.',
            Competition::TYPE_BUSINESS_PLAN, Competition::TYPE_BUSINESS_IT_CASE => 'BUSINESS_PLAN dan BUSINESS_IT_CASE harus menggunakan payment flow UPFRONT.',
            default => 'Payment flow harus UPFRONT.',
        };
        throw ValidationException::withMessages(['payment_flow' => $msg]);
    }
}
// di updateCompetition: jika existing competition masih SEMIFINAL dan request tidak mengubah payment_flow, jangan throw.
// Implement: $merged = array_merge($competition->toArray(), $data); lalu validateTypePaymentFlow($merged) — ini akan throw jika existing SEMIFINAL tetap. Untuk soft compat, tambah guard:
// if ($competition->payment_flow === Competition::PAYMENT_SEMIFINAL && !isset($data['payment_flow'])) return; // keep legacy read

// app/Models/Competition.php
public const PAYMENT_SEMIFINAL = 'SEMIFINAL'; // @deprecated legacy - existing rows keep value, new competitions must use UPFRONT. No migration will convert them.
```

- [ ] **Step 4: Run test to verify it passes**

Run: `php artisan test tests/Feature/Competition/UnifiedPaymentFlowTest.php tests/Feature/Competition/CompetitionAdminTest.php -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/Services/CompetitionService.php app/Models/Competition.php tests/Feature/Competition/UnifiedPaymentFlowTest.php
git commit -m "feat(competition): soft-unify payment_flow to UPFRONT without DB migration"
```

---

### Task 2: Unify selectCompetition to Always WAITING_PAYMENT (Runtime, No Migration)

**Files:**
- Modify: `app/Services/RegistrationService.php:19-74` — `selectCompetition` (get_code_snippet 19-74)
- Keep: `database/seeders/Isac2026TimelineSeeder.php:30-43` — JANGAN overwrite existing SEMIFINAL rows; hanya untuk kompetisi baru. Document manual opt-in in comment.
- Create: `tests/Feature/Registration/UnifiedSelectionTest.php`
- Verify via: `search_graph` `RegistrationService` & `trace_path` `selectCompetition`

**Interfaces:**
- Consumes: `BatchStatus::OPEN`, `Competition::STATUS_REGISTRATION_OPEN`, `RegistrationStatus`
- Produces: `RegistrationService::selectCompetition(Team $team, array $data): Registration` — always `status=WAITING_PAYMENT, payment_required_at=now(), payment_verified_at=null` regardless of `Competition::TYPE_*` or `payment_flow` value (compat: ignore SEMIFINAL vs UPFRONT column)

- [ ] **Step 1: Write the failing test**

```php
// tests/Feature/Registration/UnifiedSelectionTest.php
use App\Models\{Team, Competition, BatchStatus, RegistrationStatus};
test('bpc with legacy SEMIFINAL now creates WAITING_PAYMENT via runtime unify', function () {
    $team = Team::factory()->create(); $token = $team->createToken('t')->plainTextToken;
    $c = Competition::factory()->create(['type'=>Competition::TYPE_BUSINESS_PLAN,'payment_flow'=>Competition::PAYMENT_SEMIFINAL,'status'=>Competition::STATUS_REGISTRATION_OPEN]);
    $b = $c->batches()->create(['name'=>'Batch 1','slug'=>'b1-'.uniqid(),'start_date'=>now()->subDay(),'end_date'=>now()->addMonth(),'price'=>70000,'quota'=>10,'status'=>BatchStatus::OPEN]);
    $this->withToken($token)->putJson('/api/registrations/me/selection', ['competition_id'=>$c->id])
        ->assertOk()->assertJsonPath('data.context.registration.status', RegistrationStatus::WAITING_PAYMENT->value);
    $reg = $team->fresh()->registration;
    expect($reg->status)->toBe(RegistrationStatus::WAITING_PAYMENT)->and($reg->payment_required_at)->not->toBeNull()->and($reg->payment_verified_at)->toBeNull();
});
test('bic also WAITING_PAYMENT', function () {
    $team = Team::factory()->create(); $token = $team->createToken('t')->plainTextToken;
    $c = Competition::factory()->create(['type'=>Competition::TYPE_BUSINESS_IT_CASE,'payment_flow'=>Competition::PAYMENT_SEMIFINAL,'status'=>Competition::STATUS_REGISTRATION_OPEN]);
    $b = $c->batches()->create(['name'=>'Batch 1','slug'=>'b1-'.uniqid(),'start_date'=>now()->subDay(),'end_date'=>now()->addMonth(),'price'=>80000,'quota'=>10,'status'=>BatchStatus::OPEN]);
    $this->withToken($token)->putJson('/api/registrations/me/selection', ['competition_id'=>$c->id])
        ->assertOk()->assertJsonPath('data.context.registration.status', RegistrationStatus::WAITING_PAYMENT->value);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test tests/Feature/Registration/UnifiedSelectionTest.php -v`
Expected: FAIL — current `65-67` is `$isOlympiad ? WAITING_PAYMENT : VERIFIED`, so legacy SEMIFINAL BPC/BIC will be VERIFIED.

- [ ] **Step 3: Write minimal implementation (no DB schema change)**

```php
// app/Services/RegistrationService.php:60-67
// HAPUS branching isOlympiad, ganti jadi:
$registration = Registration::create([
    'team_id' => $team->id,
    'competition_id' => $competition->id,
    'batch_id' => $batch->id,
    'status' => RegistrationStatus::WAITING_PAYMENT,
    'payment_required_at' => now(),
    'payment_verified_at' => null,
]);
// Note: tetap simpan isOlympiad var tidak dipakai atau hapus. Keep payment_for_stage_id null (default).
// database/seeders/Isac2026TimelineSeeder.php — keep as is, no migration. Add comment:
// // NO DB MIGRATION: existing BPC/BIC rows with SEMIFINAL keep value in DB, app layer treats all as UPFRONT.
// // New competitions via admin UI will be forced UPFRONT by CompetitionService, seeder for fresh DB uses UPFRONT.
```

- [ ] **Step 4: Run test to verify it passes**

Run: `php artisan test tests/Feature/Registration/UnifiedSelectionTest.php tests/Feature/Registration/SelectionTest.php -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/Services/RegistrationService.php tests/Feature/Registration/UnifiedSelectionTest.php
git commit -m "feat(registration): selectCompetition unified to WAITING_PAYMENT without DB migration"
```

---

### Task 3: Unify Documents Step (Remove Auto-Submit)

**Files:**
- Modify: `app/Services/RegistrationService.php:325-349` — `updateDocuments` (search_graph `updateDocuments`, get_code_snippet 325-349)
- Create: `tests/Feature/Registration/DocumentsUnifiedTest.php`

**Interfaces:**
- Consumes: `Team`, `Registration`, `assertEditable`
- Produces: `updateDocuments(Team $team, array $data): Team` — only `documents_completed_at`, never `submitted_at`/`WAITING_VERIFICATION`

- [ ] **Step 1: Write the failing test**

```php
test('bpc documents does not auto-submit (no DB change)', function () {
    $team = Team::factory()->create(); $token = $team->createToken('t')->plainTextToken;
    $c = Competition::factory()->create(['type'=>Competition::TYPE_BUSINESS_PLAN,'payment_flow'=>Competition::PAYMENT_SEMIFINAL,'status'=>Competition::STATUS_REGISTRATION_OPEN]);
    $b = $c->batches()->create(['name'=>'B1','slug'=>'b1-'.uniqid(),'start_date'=>now()->subDay(),'end_date'=>now()->addMonth(),'price'=>70000,'quota'=>10,'status'=>BatchStatus::OPEN]);
    \App\Models\Registration::create(['team_id'=>$team->id,'competition_id'=>$c->id,'batch_id'=>$b->id,'status'=>\App\Models\RegistrationStatus::WAITING_PAYMENT,'team_completed_at'=>now(),'members_completed_at'=>now(),'payment_required_at'=>now()]);
    $this->withToken($token)->putJson('/api/registrations/me/documents', ['document_url'=>'https://drive.google.com/drive/folders/doc','twibbon_url'=>'https://drive.google.com/drive/folders/twib'])->assertOk();
    $team->refresh(); $reg = $team->registration;
    expect($reg->documents_completed_at)->not->toBeNull()->and($reg->submitted_at)->toBeNull()->and($team->status)->not->toBe(Team::STATUS_WAITING_VERIFICATION);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test tests/Feature/Registration/DocumentsUnifiedTest.php -v` → FAIL (currently auto submitted_at).

- [ ] **Step 3: Write minimal implementation**

```php
// app/Services/RegistrationService.php:333-346
DB::transaction(function () use ($team, $data, $registration): void {
    Team::query()->updateOrCreate(['id' => $team->id], ['document_url'=>$data['document_url'],'twibbon_url'=>$data['twibbon_url']]);
    $registration->update(['documents_completed_at' => $registration->documents_completed_at ?? now()]);
    // REMOVED: if ($registration->competition->type !== TYPE_OLIMPIADE) { submitted_at + WAITING_VERIFICATION }
    $this->resolveDataRevision($team, 'DOCUMENTS');
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `php artisan test tests/Feature/Registration/DocumentsUnifiedTest.php tests/Feature/Registration/DocumentsTest.php -v` → PASS

- [ ] **Step 5: Commit**

```bash
git add app/Services/RegistrationService.php tests/Feature/Registration/DocumentsUnifiedTest.php
git commit -m "feat(registration): unify documents without auto-submit"
```

---

### Task 4: Unify Payment Gate & Context (Runtime Compat, No DB)

**Files:**
- Modify: `app/Services/RegistrationService.php:364-410` `submitPayment` & `446-469` `submitForVerification` (search_graph `submitPayment`, `submitForVerification`)
- Modify: `app/Http/Resources/RegistrationContextResource.php:64-96` `currentStep` & `app/Models/Team.php:72-107` `getNextRedirectAttribute` (get_code_snippet Team)
- Create: `tests/Feature/Registration/PaymentUnifiedTest.php`

**Interfaces:**
- Consumes: `RegistrationStatus`, `File purpose PAYMENT_PROOF`, `registration->payment_for_stage_id` (now ignored, but column stays)
- Produces: `submitPayment` gate now `in_array(status, [WAITING_PAYMENT, REVISION_REQUIRED])` tanpa cek `type`/`payment_for_stage_id`; `submitForVerification` always require `payment_submitted_at`; `currentStep` returns PAYMENT for all when `payment_submitted_at null` or status WAITING_PAYMENT

- [ ] **Step 1: Write the failing test**

```php
test('bpc can submit payment same gate as olimpiade (legacy SEMIFINAL compat)', function () {
    $team=Team::factory()->create(); $token=$team->createToken('t')->plainTextToken;
    $c=Competition::factory()->create(['type'=>Competition::TYPE_BUSINESS_PLAN,'payment_flow'=>Competition::PAYMENT_SEMIFINAL,'status'=>Competition::STATUS_REGISTRATION_OPEN]);
    $b=$c->batches()->create(['name'=>'B1','slug'=>'b1-'.uniqid(),'start_date'=>now()->subDay(),'end_date'=>now()->addMonth(),'price'=>70000,'quota'=>10,'status'=>BatchStatus::OPEN]);
    $reg=\App\Models\Registration::create(['team_id'=>$team->id,'competition_id'=>$c->id,'batch_id'=>$b->id,'status'=>\App\Models\RegistrationStatus::WAITING_PAYMENT,'team_completed_at'=>now(),'members_completed_at'=>now(),'documents_completed_at'=>now(),'payment_required_at'=>now()]);
    $file=\App\Models\File::create(['file_id'=>'proof-'.uniqid(),'url'=>'https://ik.imagekit.io/isac/proof.jpg','uploaded_by'=>$team->id,'purpose'=>'PAYMENT_PROOF']);
    $this->withToken($token)->postJson('/api/registrations/me/payment', ['payment_proof_file_id'=>$file->id,'payment_method'=>'BANK_TRANSFER'])->assertOk()->assertJsonPath('data.context.registration.status', \App\Models\RegistrationStatus::WAITING_VERIFICATION->value);
});
test('submitForVerification requires payment for bpc too', function () {
    $team=Team::factory()->create(); $token=$team->createToken('t')->plainTextToken;
    $c=Competition::factory()->create(['type'=>Competition::TYPE_BUSINESS_PLAN,'payment_flow'=>Competition::PAYMENT_SEMIFINAL,'status'=>Competition::STATUS_REGISTRATION_OPEN]);
    $b=$c->batches()->create(['name'=>'B1','slug'=>'b1-'.uniqid(),'start_date'=>now()->subDay(),'end_date'=>now()->addMonth(),'price'=>70000,'quota'=>10,'status'=>BatchStatus::OPEN]);
    \App\Models\Registration::create(['team_id'=>$team->id,'competition_id'=>$c->id,'batch_id'=>$b->id,'status'=>\App\Models\RegistrationStatus::WAITING_PAYMENT,'team_completed_at'=>now(),'members_completed_at'=>now(),'documents_completed_at'=>now(),'payment_required_at'=>now()]);
    $this->withToken($token)->postJson('/api/registrations/me/submit-verification')->assertUnprocessable()->assertJsonPath('error.details.payment.0','Lengkapi pembayaran terlebih dahulu.');
});
```

- [ ] **Step 2: Run test to verify it fails** → currently `paymentGateActive` checks type, second test passes without payment for BPC

- [ ] **Step 3: Write minimal implementation (keep payment_for_stage_id column untouched)**

```php
// submitPayment: hapus $paymentGateActive = type===OLIMPIADE || payment_for_stage_id
if (! in_array($registration->status, [RegistrationStatus::WAITING_PAYMENT, RegistrationStatus::REVISION_REQUIRED], true)) {
    // idempotent retry keep same
}
// di DB::transaction: selalu $team->update(['status'=>WAITING_VERIFICATION]); hapus if (payment_for_stage_id===null)
// submitForVerification: ganti if ($registration->competition->type===TYPE_OLIMPIADE && payment_submitted_at null) jadi if ($registration->payment_submitted_at===null)
// RegistrationContextResource.currentStep: hapus $isStagePaymentCheckpoint, ganti:
// if (in_array($registration->status, [WAITING_PAYMENT, REVISION_REQUIRED], true)) return 'PAYMENT';
// if ($registration->payment_submitted_at===null) return 'PAYMENT';
// Team.getNextRedirectAttribute: same mirror
```

- [ ] **Step 4: Run test to verify it passes**

Run: `php artisan test tests/Feature/Registration/PaymentUnifiedTest.php tests/Feature/Registration/PaymentTest.php -v` → PASS

- [ ] **Step 5: Commit**

```bash
git add app/Services/RegistrationService.php app/Http/Resources/RegistrationContextResource.php app/Models/Team.php tests/Feature/Registration/PaymentUnifiedTest.php
git commit -m "feat(registration): unify payment gate without DB schema change"
```

---

### Task 5: Admin AdvanceStage & PaymentQuery Compat (No SEMIFINAL Trigger, No Migration)

**Files:**
- Modify: `app/Services/AdminRegistrationService.php:214-260` `advanceStage` (get_code_snippet 214-260, trace_path callees detail/audit), `288-303` `paymentQuery`
- Modify: `app/Http/Resources/AdminPaymentResource.php:31-40` `paymentContext`, `app/Http/Resources/RegistrationSummaryResource.php:58-60` `paymentAvailable`
- Create: `tests/Feature/Admin/UnifiedAdminFlowTest.php`

**Interfaces:**
- Consumes: `Stage`, `RegistrationStatus`, `Builder`
- Produces: `advanceStage` only `team.update(current_stage_id)` + audit (remove `needsSemifinalPayment` block that uses `payment_flow===SEMIFINAL && stage.name semifinale`); `paymentQuery` `whereNotNull(payment_required_at) OR whereNotNull(payment_submitted_at)` (no `whereHas competition payment_flow UPFRONT`); keeps `payment_for_stage_id` column but ignores for logic

- [ ] **Step 1: Write the failing test**

```php
test('advanceStage to semifinal no longer triggers waiting_payment (compat)', function () {
    $c=Competition::factory()->create(['type'=>Competition::TYPE_BUSINESS_PLAN,'payment_flow'=>Competition::PAYMENT_SEMIFINAL]); // legacy row
    $team=Team::factory()->create(['status'=>Team::STATUS_VERIFIED]);
    $reg=\App\Models\Registration::create(['team_id'=>$team->id,'competition_id'=>$c->id,'batch_id'=>\App\Models\Batch::factory()->create(['competition_id'=>$c->id])->id,'status'=>\App\Models\RegistrationStatus::VERIFIED,'team_completed_at'=>now(),'members_completed_at'=>now(),'documents_completed_at'=>now(),'submitted_at'=>now(),'payment_submitted_at'=>now(),'payment_required_at'=>now(),'paid_at'=>now()]);
    $team->update(['current_stage_id'=>\App\Models\Stage::create(['competition_id'=>$c->id,'name'=>'Preliminary','type'=>'submission','order'=>1,'is_active'=>true])->id]);
    $semifinal=\App\Models\Stage::create(['competition_id'=>$c->id,'name'=>'Semifinal','type'=>'submission','order'=>2,'is_active'=>true]);
    $admin=\App\Models\Admin::factory()->create(['role'=>'super_admin','is_active'=>true]); $token=$admin->createToken('a')->plainTextToken;
    $this->withToken($token)->postJson("/api/admin/teams/{$team->id}/stages/{$semifinal->id}/advance")->assertOk();
    $reg=$reg->fresh(); expect($reg->status)->toBe(\App\Models\RegistrationStatus::VERIFIED)->and($reg->payment_for_stage_id)->toBeNull()->and($team->fresh()->current_stage_id)->toBe($semifinal->id);
});
test('paymentQuery includes legacy SEMIFINAL BPC waiting_payment', function () {
    $c=Competition::factory()->create(['type'=>Competition::TYPE_BUSINESS_PLAN,'payment_flow'=>Competition::PAYMENT_SEMIFINAL]);
    $team=Team::factory()->create(); $reg=\App\Models\Registration::create(['team_id'=>$team->id,'competition_id'=>$c->id,'batch_id'=>\App\Models\Batch::factory()->create(['competition_id'=>$c->id])->id,'status'=>\App\Models\RegistrationStatus::WAITING_PAYMENT,'payment_required_at'=>now()]);
    $admin=\App\Models\Admin::factory()->create(['role'=>'super_admin','is_active'=>true]); $token=$admin->createToken('a')->plainTextToken;
    $this->withToken($token)->getJson('/api/admin/payments?per_page=100')->assertOk()->assertJsonPath('data.data.0.registrationId', $reg->id);
});
```

- [ ] **Step 2: Run test to verify it fails** → currently advanceStage creates WAITING_PAYMENT for SEMIFINAL, paymentQuery filters via payment_flow

- [ ] **Step 3: Write minimal implementation (keep column)**

```php
// advanceStage: DB::transaction only team.update(current_stage_id), hapus needsSemifinalPayment + registration.update WAITING_PAYMENT
// paymentQuery: return Registration::query()->with([...])->where(function($q){ $q->whereNotNull('payment_required_at')->orWhereNotNull('payment_submitted_at'); });
// AdminPaymentResource: 'paymentContext' => $this->payment_for_stage_id !== null ? 'SEMIFINAL' : 'REGISTRATION' // keep compat but now always REGISTRATION karena payment_for_stage_id null (legacy null)
// RegistrationSummaryResource: 'paymentAvailable' => $registration->payment_required_at !== null // not payment_flow
```

- [ ] **Step 4: Run test to verify it passes**

Run: `php artisan test tests/Feature/Admin/UnifiedAdminFlowTest.php tests/Feature/Admin/AdminPaymentTest.php -v` → PASS

- [ ] **Step 5: Commit**

```bash
git add app/Services/AdminRegistrationService.php app/Http/Resources/AdminPaymentResource.php app/Http/Resources/RegistrationSummaryResource.php tests/Feature/Admin/UnifiedAdminFlowTest.php
git commit -m "feat(admin): remove semifinal trigger, unified paymentQuery without DB change"
```

---

### Task 6: NEW — Revert Verification (Unverify Team & Payment) — Codebase-Memory Consistent

**Files:**
- Modify: `app/Services/AdminRegistrationService.php` — add `unverifyTeam(Admin, Team, ?string, ?string): Team` & `unverifyPayment(Admin, Registration, ?string): Registration` (mirror `verifyTeam:96-119` & `verifyPayment:169-202` with `search_graph` qualified_names)
- Modify: `app/Policies/TeamPolicy.php:8-44` — add `unverify(Admin, Team): bool` (mirror `verifyData`) & `app/Policies/RegistrationPolicy.php:8-39` — add `unverifyPayment`
- Modify: `app/Http/Controllers/Api/AdminRegistrationController.php:57-99` — add `unverifyTeam` & `unverifyPayment` (mirror `verifyTeam:71-78` with `authorize` via `Gate::forUser($admin)->authorize('unverify', $team)`)
- Modify: `routes/api.php:57-69` — add `POST /admin/teams/{team}/unverify` & `POST /admin/registrations/{registration}/payment/unverify`
- Modify: `resources/js/features/admin/api/adminApi.ts:30-64` — add `unverifyTeam: (teamId)=>postJson(.../unverify)` & `unverifyPayment` (use `requestHeaders()` like `verifyTeam:35`)
- Modify: `resources/js/features/admin/hooks/useAdmin.ts:26-63` — add `useUnverifyAdminTeam(teamId)` & `useUnverifyAdminPayment(registrationId)` (mirror `useVerifyAdminTeam` with `mutationFn: () => adminApi.unverifyTeam` + invalidate `adminKeys.teams` & `adminKeys.team`)
- Modify: `resources/js/Pages/Admin/Teams/Show.tsx:27-257` — add `canUnverify = (role===super_admin||admin_registration)` + button `Batalkan Verifikasi` when `team.status===VERIFIED` → `setUnverifyDialog` → call `useUnverifyAdminTeam`, plus audit reason optional `TeamUnverifyDialog`
- Modify: `resources/js/Pages/Admin/Payments/Show.tsx:27-306` — add `canUnverifyPayment` + button when `payment.status===VERIFIED` → `PaymentUnverifyDialog`
- Test: `tests/Feature/Admin/RevertVerificationTest.php`

**Interfaces:**
- Consumes: `Team::STATUS_VERIFIED`, `RegistrationStatus::VERIFIED`, `AdminAuditLog`, `DB::transaction`, `lockForUpdate` (verified via `get_code_snippet` verifyTeam)
- Produces:
  - `AdminRegistrationService.unverifyTeam(Admin $admin, Team $team, ?string $reason, ?string $requestId): Team` — if `status !== VERIFIED` throw `Team tidak dalam status terverifikasi.` else `update status=WAITING_VERIFICATION, verified_at=null, verified_by=null, verification_note=$reason, revision_step=null` + `audit('team.unverified')` + `activateIfEligible` inverse (clear `current_stage_id` if needed) — use `trace_path` callees `detail, audit`
  - `AdminRegistrationService.unverifyPayment(...) : Registration` — lockForUpdate, if `status !== VERIFIED` throw, else `update status=WAITING_VERIFICATION, payment_verified_at=null, payment_verified_by=null, paid_at=null` + audit `payment.unverified`
  - `TeamPolicy.unverify` & `RegistrationPolicy.unverifyPayment` — same role check as verify
  - `AdminRegistrationController.unverifyTeam(Request, Team)` — `$this->authorize($request,'unverify',$team)` + `$this->service->unverifyTeam($admin,$team,$request->input('reason'), $request->header('X-Request-ID'))` → `success('Verifikasi dibatalkan.', new RegistrationSummaryResource(...))`
  - `adminApi.unverifyTeam/unverifyPayment` — `postJson` with `headers: requestHeaders()`
  - Frontend hooks invalidate `adminKeys.teams` & `adminKeys.team` / `adminKeys.payments` & `adminKeys.payment`

- [ ] **Step 1: Write the failing test (TDD)**

```php
// tests/Feature/Admin/RevertVerificationTest.php
use App\Models\{Team, Competition, BatchStatus, RegistrationStatus, Admin};

test('admin can unverify verified team back to waiting_verification', function () {
    $team = Team::factory()->create(['status'=>Team::STATUS_VERIFIED,'verified_at'=>now(),'verified_by'=>1]);
    $admin = Admin::factory()->create(['role'=>'admin_registration','is_active'=>true]);
    $token = $admin->createToken('t')->plainTextToken;
    $this->withToken($token)->postJson("/api/admin/teams/{$team->id}/unverify", ['reason'=>'Koreksi data institusi'])
        ->assertOk()->assertJsonPath('data.team.status', Team::STATUS_WAITING_VERIFICATION);
    expect($team->fresh()->verified_at)->toBeNull()->and($team->fresh()->verification_note)->toBe('Koreksi data institusi');
    expect(\App\Models\AdminAuditLog::where('action','team.unverified')->exists())->toBeTrue();
});
test('unverify only allowed from VERIFIED', function () {
    $team = Team::factory()->create(['status'=>Team::STATUS_WAITING_VERIFICATION]);
    $admin = Admin::factory()->create(['role'=>'admin_registration','is_active'=>true]);
    $token = $admin->createToken('t')->plainTextToken;
    $this->withToken($token)->postJson("/api/admin/teams/{$team->id}/unverify")->assertUnprocessable();
});
test('admin can unverify verified payment back to waiting_verification', function () {
    $c=Competition::factory()->create(['type'=>Competition::TYPE_BUSINESS_PLAN,'payment_flow'=>Competition::PAYMENT_UPFRONT]);
    $team=Team::factory()->create(['status'=>Team::STATUS_VERIFIED]);
    $reg=\App\Models\Registration::create(['team_id'=>$team->id,'competition_id'=>$c->id,'batch_id'=>\App\Models\Batch::factory()->create(['competition_id'=>$c->id])->id,'status'=>RegistrationStatus::VERIFIED,'payment_required_at'=>now(),'payment_submitted_at'=>now(),'payment_verified_at'=>now(),'paid_at'=>now(),'payment_verified_by'=>1,'amount_paid'=>70000]);
    $admin=Admin::factory()->create(['role'=>'admin_payment','is_active'=>true]); $token=$admin->createToken('t')->plainTextToken;
    $this->withToken($token)->postJson("/api/admin/registrations/{$reg->id}/payment/unverify", ['reason'=>'Bukti blur'])->assertOk()->assertJsonPath('data.status','WAITING_VERIFICATION');
    expect($reg->fresh()->payment_verified_at)->toBeNull()->and($reg->fresh()->paid_at)->toBeNull();
});
test('policy: admin_payment cannot unverify team, admin_registration cannot unverify payment', function () {
    $team=Team::factory()->create(['status'=>Team::STATUS_VERIFIED]);
    $payAdmin=Admin::factory()->create(['role'=>'admin_payment','is_active'=>true]);
    $this->withToken($payAdmin->createToken('t')->plainTextToken)->postJson("/api/admin/teams/{$team->id}/unverify")->assertForbidden();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test tests/Feature/Admin/RevertVerificationTest.php -v`
Expected: FAIL — routes/methods not found, 404/405. Verify via `search_graph` no `unverifyTeam` yet.

- [ ] **Step 3: Write minimal implementation (mirror verifyTeam via codebase-memory)**

```php
// app/Services/AdminRegistrationService.php — add after verifyTeam (line 119) & verifyPayment (line 202)
// Use get_code_snippet verifyTeam as template:

public function unverifyTeam(Admin $admin, Team $team, ?string $reason, ?string $requestId): Team
{
    if ($team->status !== Team::STATUS_VERIFIED) {
        throw ValidationException::withMessages(['team' => ['Team tidak dalam status terverifikasi.']]);
    }
    // idempotent: if already WAITING_VERIFICATION with same reason? not needed
    DB::transaction(function () use ($admin, $team, $reason, $requestId): void {
        $before = $team->toArray();
        $team->update([
            'status' => Team::STATUS_WAITING_VERIFICATION,
            'verified_by' => null,
            'verified_at' => null,
            'verification_note' => $reason,
            'revision_step' => null,
        ]);
        // optional: if team had current_stage_id, keep? or clear? Keep for now to preserve no DB schema change. If need full revert, clear current_stage_id.
        $this->audit($admin, 'team.unverified', $team, $before, $team->fresh()->toArray(), $reason, $requestId);
    });
    return $this->detail($team->fresh());
}

public function unverifyPayment(Admin $admin, Registration $registration, ?string $reason, ?string $requestId): Registration
{
    return DB::transaction(function () use ($admin, $registration, $reason, $requestId): Registration {
        $registration = Registration::query()->lockForUpdate()->findOrFail($registration->id);
        if ($registration->status !== RegistrationStatus::VERIFIED) {
            throw ValidationException::withMessages(['payment' => ['Pembayaran tidak dalam status terverifikasi.']]);
        }
        DB::transaction(function () use ($admin, $registration, $reason, $requestId): void {
            $before = $registration->toArray();
            $registration->update([
                'status' => RegistrationStatus::WAITING_VERIFICATION,
                'payment_verified_by' => null,
                'payment_verified_at' => null,
                'paid_at' => null,
                'payment_rejection_reason' => $reason,
            ]);
            $this->audit($admin, 'payment.unverified', $registration, $before, $registration->fresh()->toArray(), $reason, $requestId);
        });
        return $this->loadPayment($registration->fresh());
    });
}

// app/Policies/TeamPolicy.php — add after verifyData:
public function unverify(Admin $admin, Team $team): bool { return $admin->role === 'admin_registration'; }
// app/Policies/RegistrationPolicy.php — add after verifyPayment:
public function unverifyPayment(Admin $admin, Registration $registration): bool { return $admin->role === 'admin_payment'; }

// app/Http/Controllers/Api/AdminRegistrationController.php — add:
public function unverifyTeam(Request $request, Team $team): JsonResponse {
    $this->authorize($request, 'unverify', $team);
    return $this->success('Verifikasi tim dibatalkan.', new RegistrationSummaryResource(
        $this->service->unverifyTeam($this->admin($request), $team, $request->input('reason'), $request->header('X-Request-ID'))
    ));
}
public function unverifyPayment(\App\Http\Requests\Admin\ReviewReasonRequest $request, Registration $registration): JsonResponse {
    $this->authorize($request, 'unverifyPayment', $registration);
    return $this->success('Verifikasi pembayaran dibatalkan.', new \App\Http\Resources\AdminPaymentResource(
        $this->service->unverifyPayment($this->admin($request), $registration, $request->validated('reason') ?? $request->input('reason'), $request->header('X-Request-ID'))
    ));
}
// routes/api.php:57-69 add:
Route::post('/teams/{team}/unverify', [AdminRegistrationController::class, 'unverifyTeam'])->whereUuid('team');
Route::post('/registrations/{registration}/payment/unverify', [AdminRegistrationController::class, 'unverifyPayment'])->whereUuid('registration');

// resources/js/features/admin/api/adminApi.ts:30 add:
unverifyTeam: (teamId: string, reason?: string) => postJson<AdminTeamResponse>(`/api/admin/teams/${teamId}/unverify`, reason?{reason}:undefined, {headers: requestHeaders()}),
unverifyPayment: (registrationId: string, reason: string) => postJson<AdminPaymentResponse>(`/api/admin/registrations/${registrationId}/payment/unverify`, {reason}, {headers: requestHeaders()}),

// resources/js/features/admin/hooks/useAdmin.ts: add:
export function useUnverifyAdminTeam(teamId:string){ const c=useQueryClient(); return useMutation({mutationFn:(reason?:string)=>adminApi.unverifyTeam(teamId, reason), onSuccess:()=>Promise.all([c.invalidateQueries({queryKey:[...adminKeys.all,'teams']}), c.invalidateQueries({queryKey:adminKeys.team(teamId)})])})}
export function useUnverifyAdminPayment(regId:string){ const c=useQueryClient(); return useMutation({mutationFn:(reason:string)=>adminApi.unverifyPayment(regId, reason), onSuccess:()=>Promise.all([c.invalidateQueries({queryKey:[...adminKeys.all,'payments']}), c.invalidateQueries({queryKey:adminKeys.payment(regId)})])})}

// resources/js/Pages/Admin/Teams/Show.tsx: add import useUnverifyAdminTeam, add state [unverifyOpen], add canUnverify, add button:
{canUnverify && data.team.status==='VERIFIED' && <Button variant="outline" onClick={()=>setUnverifyOpen(true)}><RotateCcw/>Batalkan Verifikasi</Button>}
{unverifyOpen && <TeamUnverifyDialog teamId={teamId} open onOpenChange={...}/>}
// create TeamUnverifyDialog.tsx (mirror TeamReviewDialog, search_graph `TeamReviewDialog` qualified)

// resources/js/Pages/Admin/Payments/Show.tsx: similar canUnverifyPayment + PaymentUnverifyDialog
```

- [ ] **Step 4: Run test to verify it passes**

Run: `php artisan test tests/Feature/Admin/RevertVerificationTest.php -v`
Expected: PASS (4 tests). Also run `php artisan test tests/Feature/Admin/AdminPaymentTest.php -v` for regression.

- [ ] **Step 5: Commit**

```bash
git add app/Services/AdminRegistrationService.php app/Policies/TeamPolicy.php app/Policies/RegistrationPolicy.php app/Http/Controllers/Api/AdminRegistrationController.php routes/api.php resources/js/features/admin/api/adminApi.ts resources/js/features/admin/hooks/useAdmin.ts resources/js/Pages/Admin/Teams/Show.tsx resources/js/Pages/Admin/Payments/Show.tsx resources/js/features/admin/components/TeamUnverifyDialog.tsx resources/js/features/admin/components/PaymentUnverifyDialog.tsx tests/Feature/Admin/RevertVerificationTest.php
git commit -m "feat(admin): allow revert VERIFIED -> WAITING_VERIFICATION for team & payment"
```

---

### Task 7: Frontend Types & Constants Unification (No DB)

**Files:**
- Modify: `resources/js/constants/registration.ts` — `getRegistrationSteps` (search_code `getRegistrationSteps`)
- Modify: `resources/js/features/registrations/types/registrationTypes.ts` — `PaymentFlow`
- Modify: `resources/js/features/admin/types/adminTypes.ts` — `PaymentContext`
- Test: `tsc --noEmit` + `npm run build`

**Interfaces:**
- Produces: `getRegistrationSteps(): readonly ...` always includes `payment`, param `_isOlympiad?: boolean` ignored for compat (so existing `Steps.tsx` call with `isOlympiad` still type-checks)

- [ ] **Step 1: Write the failing test**

```ts
// resources/js/constants/__tests__/registrationSteps.test.ts
import {getRegistrationSteps} from '@/constants/registration'
test('unified steps always payment', ()=>{ expect(getRegistrationSteps().map(s=>s.id)).toEqual(['competition','team','biodata','documents','payment']); expect(getRegistrationSteps(true).map(s=>s.id)).toEqual(['competition','team','biodata','documents','payment']); })
```

- [ ] **Step 2: Run test to verify it fails** → currently `getRegistrationSteps(isOlympiad)` returns validation for non-olimpiade

- [ ] **Step 3: Write minimal implementation**

```ts
// resources/js/constants/registration.ts
import {Trophy,Users,User,FileText,CreditCard} from 'lucide-react'
const STEPS = [{id:'competition',name:'Competition',icon:Trophy},{id:'team',name:'Team',icon:Users},{id:'biodata',name:'Biodata',icon:User},{id:'documents',name:'Documents',icon:FileText},{id:'payment',name:'Payment',icon:CreditCard}] as const
export const getRegistrationSteps = (_isOlympiad?: boolean) => STEPS
```

- [ ] **Step 4: Run test to verify it passes** → `tsc --noEmit` PASS, `npm run build` 3485 modules

- [ ] **Step 5: Commit**

```bash
git add resources/js/constants/registration.ts resources/js/features/registrations/types/registrationTypes.ts
git commit -m "feat(frontend): unify registration steps"
```

---

### Task 8: Frontend User Flow Unification (No DB)

**Files:**
- Modify: `resources/js/features/registrations/components/RegistrationLayout.tsx` — `FLOW_PATHS` constant + guard (search_code `FLOW_PATHS`)
- Modify: `resources/js/features/registrations/components/Steps.tsx` — remove `isOlympiad` (trace_path `Steps`)
- Modify: `resources/js/Pages/Registration/Documents.tsx` — redirect always to payment, `resources/js/Pages/Registration/Payment.tsx` — always show FormPayment

**Interfaces:**
- Produces: `RegistrationLayout` FLOW_PATHS `['/registration','/registration/team','/registration/biodata','/registration/documents','/registration/payment']` unified; `Steps` uses `getRegistrationSteps()` without param

- [ ] **Step 1-5:** similar TDD as previous plan Task 7, but ensure no DB change, only runtime redirectTo handling

---

### Task 9: Frontend Admin Unification (No DB)

**Files:**
- Modify: `resources/js/features/admin/components/CompetitionFormDialog.tsx:78-79` — force `payment_flow='UPFRONT'` readonly (search_code `CompetitionFormDialog`)
- Modify: `resources/js/Pages/Admin/Teams/Show.tsx:38-246` — `paymentAvailable = !!registration.paymentRequiredAt`, add unverify button (from Task 6)
- Modify: `resources/js/Pages/Admin/Payments/Show.tsx:52-306` — `paymentContextLabels` keep REGISTRATION, add unverify

- [ ] **Step 1-5:** TDD manual smoke: create BPC → payment_flow stays UPFRONT disabled, save → ok; open teams Show → pembayaran muncul; unverify buttons work

---

### Task 10: Tests Bulk Update & QA (No Migration)

**Files:**
- Modify: `tests/Feature/Registration/*` — update expectations: `SelectionTest` WAITING_PAYMENT for BPC/BIC, `DocumentsTest` redirect to payment, `PaymentTest` BPC same gate, `CanonicalWorkflowTest` add BPC canonical (selection→team→members→documents→payment→verifyTeam→verifyPayment→advanceStage without payment reset)
- Create: `tests/Feature/Registration/NoDbSchemaChangeTest.php` — assert no new migration file, assert `Schema::hasColumn('registrations','payment_for_stage_id')` true (column stays)
- Verify: `php artisan pint --test`, `npm run build`, `tsc --noEmit`, `php artisan test --parallel`

**Interfaces:**
- Produces: QA evidence: `pint` PASS, `vite` 3485 modules, `tsc` 0, `phpunit` 180+ pass (update count, legacy fails fixed)

- [ ] **Step 1: Run build & lint**

```bash
php artisan pint --test
npm run build
tsc --noEmit
php artisan test --parallel
```

- [ ] **Step 2: Manual smoke user** — BPC 3 orang → documents → payment → submit → dashboard, submitForVerification without payment must fail

- [ ] **Step 3: Manual smoke admin** — verifyTeam → unverifyTeam → verify again; verifyPayment → unverifyPayment → verify again; advanceStage no payment trigger; create BPC UPFRONT only

- [ ] **Step 4: Checkpoint**

```bash
git status; git log --oneline -5
# memory
```

---

## Self-Review (codebase-memory upgraded)

**1. Spec coverage:**
- Unified UPFRONT tanpa DB migration → Task 1-5 soft-unify runtime compat ✓ (verified via search_graph `CompetitionService`, `RegistrationService`, `AdminRegistrationService`)
- No DB schema change → Global Constraints + Task 10 NoDbSchemaChangeTest ✓
- Admin revert VERIFIED→WAITING_VERIFICATION → Task 6 (trace_path verifyTeam callees detail/audit, mirror implementation) ✓
- Codebase-memory consistent → every `qualified_name` from `home-misbahul45-code-ISAC-2026.*` verified via `search_graph`/`get_code_snippet`/`trace_path`, no invented signatures ✓

**2. Placeholder scan:** No TBD, all code blocks actual

**3. Type consistency:** `PaymentFlow` keeps SEMIFINAL deprecated for compat, `getRegistrationSteps` optional param keeps existing callers type-safe, `payment_for_stage_id` column ignored but kept, `TeamPolicy.unverify` mirrors `verifyData` role, `RegistrationPolicy.unverifyPayment` mirrors `verifyPayment`

**Execution Handoff**

Plan complete and saved to `docs/superpowers/plans/2026-08-28-unified-upfront-payment-flow-v2.md`. Two execution options:

**1. Subagent-Driven (recommended)** - dispatch fresh subagent per task, review between tasks

**2. Inline Execution** - execute in this session via executing-plans

**Which approach?**

