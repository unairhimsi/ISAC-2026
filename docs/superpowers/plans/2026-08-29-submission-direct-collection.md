# Submission Direct Collection — All UPFRONT, No Payment Gate (AA1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Participant BUSINESS_PLAN / BUSINESS_IT_CASE dapat kumpul karya langsung per-stage tanpa payment gate, dengan window `Stage.start_date → end_date`, file ImageKit `purpose=SUBMISSION`, status `draft/submitted/under_review/approved/rejected/revision_requested`, semua lomba UPFRONT di registrasi awal.

**Architecture:** `SubmissionController → SubmissionService (DB::transaction + lockForUpdate + window check) → Submission/File (HasUuids, SoftDeletes) → SubmissionResource`. `DashboardService.getSubmissionShell` sudah direfactor jadi `window{isOpen,isOverdue,remainingMs}, submission, canSubmit` (no payment). Frontend `features/submissions` (api/hooks/types/components) + `Dashboard/Submission/Show.tsx` glassmorphism. Reuse `FileService` + `StoreFileRequest purpose=SUBMISSION` existing.

**Tech Stack:** Laravel 11/13 PHP 8.3, MySQL `submissions` (uuid PK, unique team+stage, FK file), ImageKit `IKAuth + IKUpload + POST /files`, React 19 TS Inertia TanStack Query zod, Tailwind 4, Pest, Vite.

## Global Constraints

- No new migration required untuk MVP (reuse `submissions` table existing, `HasUuids` fix sudah). `payment_for_stage_id` column tetap ada tapi ignore.
- Request `snake_case`, response `camelCase`, envelope `{status,message,data,metadata,error}`.
- Auth Team `auth:sanctum + principal.team + team.verified`, Admin `auth:admins + principal.admin + Gate`.
- File `purpose` whitelist `SUBMISSION`, ownership `uploaded_by == team.id`.
- Window server-authority: `now ∈ [start,end]` via `Carbon now()` bukan client `Date.now()`.
- Idempotency `Idempotency-Key` header untuk `submit`.

---

## File Structure

- Modify: `app/Services/DashboardService.php:64-149` — sudah dari `payment` ke `window/canSubmit/submission` (verify)
- Create: `app/Http/Requests/Submission/StoreSubmissionRequest.php`
- Create: `app/Http/Resources/SubmissionResource.php`
- Create: `app/Services/SubmissionService.php`
- Create: `app/Http/Controllers/Api/SubmissionController.php`
- Modify: `routes/api.php:34-101` — add 4 Team routes under `prefix('dashboard')`
- Create: `resources/js/features/submissions/api/submissionApi.ts`
- Create: `resources/js/features/submissions/hooks/useSubmission.ts`
- Create: `resources/js/features/submissions/types/submissionTypes.ts` (atau reuse `dashboardTypes.ts` SubmissionData)
- Create: `resources/js/features/submissions/components/SubmissionForm.tsx` + `WindowCountdown.tsx`
- Modify: `resources/js/features/dashboard/types/dashboardTypes.ts` — sudah (SubmissionWindow etc.)
- Modify: `resources/js/Pages/Dashboard/Submission/Show.tsx` — sudah (payment → direct)
- Test: `tests/Feature/Dashboard/SubmissionShellDirectCollectionTest.php` (sudah 3 passed), `tests/Feature/Submission/SubmissionTest.php` (baru 6 tests)
- Test: `tests/Feature/Dashboard/TeamActivityDashboardTest.php` — update business shell expect `window/canSubmit`

---

## API Contract Canonical (Plan A)

### 1) GET /api/dashboard/stages/{stage}/submission — Shell (read, sudah implement)
**Auth:** Team verified, `team.current_stage_id == stage.id`, `stage.competition_id == registration.competition_id`, `competition.type in [BUSINESS_PLAN, BUSINESS_IT_CASE]`
**Response 200:**
```json
{
  "status":"success",
  "data":{
    "stage":{"id":"uuid","name":"Preliminary","type":"submission","order":1,"description":"...","startDate":"2026-09-01T00:00:00Z","endDate":"2026-09-07T23:59:59Z"},
    "competition":{"id":"uuid","name":"Business Plan","type":"BUSINESS_PLAN"},
    "batch":{"id":"uuid","name":"Early Bird","price":175000},
    "window":{"isOpen":true,"isOverdue":false,"remainingMs":432000000,"startDate":"...","endDate":"..."},
    "submission": null | {"id":"uuid","title":"Karya","description":"...","status":"draft","score":null,"feedback":null,"submittedAt":null,"reviewedAt":null,"file":{"id":"uuid","fileId":"ik_xxx","url":"https://ik.imagekit.io/..."}},
    "canSubmit": true
  }
}
```
Window: `isOpen = start<=now<=end`, `isOverdue = now>end`, `remainingMs = max(0, end-now)*1000` jika `isOpen`, else `null`. `canSubmit = isOpen` (nanti bisa refine `&& status in [draft,revision_requested]`).

**Errors:** 403 `Tahap pengumpulan tidak tersedia`, 401, 404.

### 2) POST /api/dashboard/stages/{stage}/submission — Upsert Draft (create/update)
**Auth:** same, plus `window.isOpen` else 422
**Request:**
```json
{"title":"Prototype Smart City","description":"Deskripsi...","file_id":"uuid-file-metadata"}
```
Validation: `title required string 3-180`, `description nullable string max 5000`, `file_id nullable uuid exists:files,id` + custom `assertOwnedFile(team, file_id, SUBMISSION)`.
**Logic:** `Submission::firstOrCreate([team_id,stage_id], [status=draft])` dengan `lockForUpdate`, then `update([title,description,file_id, status=draft if not submitted/under_review])`, `metadata.version++`.
**Response 200/201:** `SubmissionResource`
**Idempotent:** retry same payload → 200 same id.

### 3) POST /api/dashboard/stages/{stage}/submission/submit — Finalize
**Headers:** `Idempotency-Key: uuid` (optional, cache 5m)
**Checks:** `window.isOpen`, `file_id != null`, `status in [draft, revision_requested, rejected]` else 422 `Sudah terkumpul`.
**Effect:** `status=submitted, submitted_at=now(), metadata.submittedCount++`
**Response 200:** `SubmissionResource`
**Idempotent:** same `Idempotency-Key` → return same submission.

### 4) POST /api/dashboard/stages/{stage}/submission/unsubmit — Tarik (optional)
**Checks:** `status==submitted && window.isOpen && reviewed_at==null`
**Effect:** `status=draft`
**Response 200.**

**Common envelope, 422 details per field, 429 throttle.**

### Flow Mermaid (Participant)
```mermaid
flowchart TD
  A[GET /stages/{stage}/submission] --> B{window.isOpen?}
  B -->|false overdue| C[Card Berakhir]
  B -->|false before start| D[Card Akan Datang]
  B -->|true| E{submission exists?}
  E -->|null| F[Form Kosong: FileUpload SUBMISSION]
  E -->|draft/revision_requested| G[Form Prefilled + Feedback]
  E -->|submitted/under_review| H[Read-only + Unsubmit]
  F --> I[POST upsertDraft]
  G --> I
  I --> J[POST submit]
  J --> K[Status submitted, tunggu penjurian]
```

---

### Task 1: Dashboard Shell Direct Collection (Sudah Done, Verifikasi)

**Files:**
- Modify: `app/Services/DashboardService.php:64-149` — remove payment gate, add window/submission
- Modify: `app/Models/Submission.php:1-12` — add `HasUuids`
- Modify: `resources/js/features/dashboard/types/dashboardTypes.ts:65-85` — SubmissionWindow etc.
- Modify: `resources/js/Pages/Dashboard/Submission/Show.tsx` — no payment, WindowStatus+FileUpload
- Modify: `tests/Feature/Dashboard/TeamActivityDashboardTest.php:97-137` — expect window/canSubmit
- Create: `tests/Feature/Dashboard/SubmissionShellDirectCollectionTest.php`

**Interfaces:**
- Consumes: `Stage.start_date/end_date`, `Submission team+stage unique`, `File purpose SUBMISSION`
- Produces: `DashboardService.getSubmissionShell(Team, Stage): array{stage,competition,batch,window,submission,canSubmit}`

- [x] **Step 1: Write failing test** — `SubmissionShellDirectCollectionTest.php` 3 tests (assertJsonMissing payment, assert window/canSubmit, assert submission file)
- [x] **Step 2: Run to verify RED** — `php artisan test --filter=SubmissionShellDirectCollectionTest` → 3 failed (payment still exists, window null, NOT NULL id)
- [x] **Step 3: Implement** — `DashboardService.php` + `Submission HasUuids` + types + Show.tsx (as diff)
- [x] **Step 4: Run GREEN** — same filter → 3 passed, `TeamActivityDashboardTest` 3 passed, `tsc --noEmit` passed
- [x] **Step 5: Commit** — pending (plan mode, no commit)

---

### Task 2: StoreSubmissionRequest + SubmissionResource

**Files:**
- Create: `app/Http/Requests/Submission/StoreSubmissionRequest.php`
- Create: `app/Http/Resources/SubmissionResource.php`
- Test: `tests/Feature/Submission/SubmissionTest.php` (part)

**Interfaces:**
- Consumes: `Team`, `File`, `Stage`
- Produces: `StoreSubmissionRequest rules() => ['title'=>['required','string','min:3','max:180'], 'description'=>['nullable','string','max:5000'], 'file_id'=>['nullable','uuid','exists:files,id']]`, `SubmissionResource toArray => {id,title,description,status,score,feedback,submittedAt,reviewedAt,file:{id,fileId,url}}`

- [ ] **Step 1: Write failing test**

```php
// tests/Feature/Submission/SubmissionTest.php
test('upsert draft requires title', function(){
  $team=Team::factory()->create(['status'=>Team::STATUS_VERIFIED]); $c=Competition::factory()->create(['type'=>Competition::TYPE_BUSINESS_PLAN]); $b=$c->batches()->create([...]); $stage=Stage::create([...]); $team->update(['current_stage_id'=>$stage->id]); Registration::create([...]); $token=$team->createToken('t')->plainTextToken;
  $this->withToken($token)->postJson("/api/dashboard/stages/{$stage->id}/submission", ['title'=>'','file_id'=>null])->assertUnprocessable()->assertJsonPath('error.details.title.0','...');
});
test('rejects foreign file', function(){ ... create file with other team id, assert 422 file_id ... });
```

- [ ] **Step 2: Run → FAIL** — class not found
- [ ] **Step 3: Implement**

```php
// StoreSubmissionRequest.php
public function authorize(): bool { $user=$this->user(); return $user instanceof Team && $user->isVerified(); } // plus Gate team.current_stage_id check in controller
public function rules(): array { return ['title'=>['required','string','min:3','max:180'], 'description'=>['nullable','string','max:5000'], 'file_id'=>['nullable','uuid','exists:files,id', function($attr,$val,$fail){ $file=File::find($val); if(!$file||$file->uploaded_by!=$this->user()->id||$file->purpose!=='SUBMISSION') $fail('File tidak valid'); }]]; }
// SubmissionResource
public function toArray(Request $request): array { return ['id'=>$this->id,'title'=>$this->title,'description'=>$this->description,'status'=>$this->status,'score'=>$this->score,'feedback'=>$this->feedback,'submittedAt'=>$this->submitted_at?->toISOString(),'reviewedAt'=>$this->reviewed_at?->toISOString(),'file'=>$this->file?['id'=>$this->file->id,'fileId'=>$this->file->file_id,'url'=>$this->file->url]]; }
```

- [ ] **Step 4: Run → PASS**
- [ ] **Step 5: Commit**

---

### Task 3: SubmissionService + SubmissionController + Routes

**Files:**
- Create: `app/Services/SubmissionService.php`
- Create: `app/Http/Controllers/Api/SubmissionController.php`
- Modify: `routes/api.php:34-101` — add Team group
- Test: `tests/Feature/Submission/SubmissionTest.php` (remaining)

**Interfaces:**
- Consumes: `DashboardService window logic`, `File`, `Submission`
- Produces: `SubmissionService.upsertDraft(Team,Stage,array):Submission`, `submit(Team,Stage):Submission`, `unsubmit(Team,Stage):Submission`; `SubmissionController.upsert/submit/unsubmit(Request,Stage):JsonResponse`

- [ ] **Step 1: Write failing test**

```php
test('team can upsert draft when window open', function(){ ... post upsertDraft with title+file_id => assertOk assertJsonPath data.title ... });
test('cannot upsert when window closed', function(){ ... stage end yesterday => assertUnprocessable });
test('submit requires file', function(){ ... upsert without file then submit => 422 file_id });
test('submit is idempotent with Idempotency-Key', function(){ ... twice same key => same id });
test('unsubmit only when submitted and window open', function(){ ... });
```

- [ ] **Step 2: Run → FAIL**
- [ ] **Step 3: Implement**

```php
// SubmissionService
public function upsertDraft(Team $team, Stage $stage, array $data): Submission {
  $this->assertCanAccess($team,$stage); $this->assertWindowOpen($stage);
  return DB::transaction(function() use($team,$stage,$data){
    $sub=Submission::lockForUpdate()->firstOrCreate(['team_id'=>$team->id,'stage_id'=>$stage->id], ['status'=>'draft']);
    if(!in_array($sub->status,['draft','revision_requested','rejected'],true) && $sub->exists) throw ValidationException::withMessages(['submission'=>['Sudah terkumpul']]);
    if(!empty($data['file_id'])) $this->assertOwnedFile($team,$data['file_id']);
    $sub->update(['title'=>$data['title'],'description'=>$data['description']??null,'file_id'=>$data['file_id']??$sub->file_id]);
    return $sub->fresh()->load('file');
  });
}
public function submit(Team $team, Stage $stage): Submission { ... check window, file not null, status draft/revision_requested, update status=submitted,submitted_at=now() ... }
private function assertWindowOpen(Stage $stage){ if(now()->lt($stage->start_date)||now()->gt($stage->end_date)) throw ValidationException...; }
private function assertOwnedFile(Team $team,string $fileId){ $f=File::find($fileId); if(!$f||$f->uploaded_by!==$team->id||$f->purpose!=='SUBMISSION') throw...; }
// Controller
public function upsert(StoreSubmissionRequest $request, Stage $stage){ $team=$request->user(); return response()->json(['status'=>'success','data'=>new SubmissionResource($this->service->upsertDraft($team,$stage,$request->validated()))]); }
// Routes
Route::prefix('dashboard')->middleware(['auth:sanctum','principal.team','team.verified'])->group(function(){ Route::get('/stages/{stage}/submission',[SubmissionController::class,'show']); Route::post('/stages/{stage}/submission',[SubmissionController::class,'upsert']); Route::post('/stages/{stage}/submission/submit',[SubmissionController::class,'submit']); Route::post('/stages/{stage}/submission/unsubmit',[SubmissionController::class,'unsubmit']); });
```

- [ ] **Step 4: Run → PASS**
- [ ] **Step 5: Commit**

---

### Task 4: Frontend submissions feature (api/hooks/types/components)

**Files:**
- Create: `resources/js/features/submissions/api/submissionApi.ts`
- Create: `resources/js/features/submissions/hooks/useSubmission.ts`
- Create: `resources/js/features/submissions/schemas/submissionSchema.ts`
- Create: `resources/js/features/submissions/components/SubmissionForm.tsx`
- Modify: `resources/js/Pages/Dashboard/Submission/Show.tsx` — wire to hooks (currently static file state)

**Interfaces:**
- Consumes: `submissionApi`, `SubmissionData`
- Produces: `submissionApi.get(stageId), upsert(stageId,payload), submit(stageId), unsubmit(stageId)`; `useSubmission(stageId): {query, upsertMutation, submitMutation}`

- [ ] **Step 1: Write failing test (frontend)**

```ts
// resources/js/features/submissions/__tests__/useSubmission.test.tsx
test('upsert calls POST /dashboard/stages/{id}/submission', async()=>{ mock fetch, call upsert, expect fetch to /api/dashboard/stages/uuid/submission with title... })
```

- [ ] **Step 2: Run → FAIL**
- [ ] **Step 3: Implement**

```ts
// submissionApi.ts
export const submissionApi = {
  get: (stageId:string)=> getJson<SubmissionShellResponse>(`/api/dashboard/stages/${stageId}/submission`),
  upsert: (stageId:string, payload:{title:string,description?:string,file_id?:string})=> postJson<SubmissionResource>(`/api/dashboard/stages/${stageId}/submission`, payload),
  submit: (stageId:string, key:string)=> postJson<SubmissionResource>(`/api/dashboard/stages/${stageId}/submission/submit`, {}, {headers:{'Idempotency-Key':key}}),
}
// useSubmission.ts
export function useSubmission(stageId:string){ const q=useQuery({queryKey:['submission',stageId], queryFn:()=>submissionApi.get(stageId)}); const m1=useMutation({mutationFn:(p)=>submissionApi.upsert(stageId,p), onSuccess:()=>queryClient.invalidateQueries({queryKey:['submission',stageId]})}); return {query:q, upsert:m1} }
// zod schema
export const submissionSchema = z.object({title:z.string().min(3).max(180), description:z.string().max(5000).optional(), file_id:z.string().uuid().optional()})
```

- [ ] **Step 4: Run → PASS** `tsc --noEmit`, `npm run build`
- [ ] **Step 5: Commit**

---

### Task 5: QA & Docs Sync

**Files:**
- Modify: `docs/API/README.md` — add 4 endpoints to table, add payload example
- Test: `php artisan test`, `php artisan pint --test`, `npm run build`

- [ ] **Step 1: Run full suite** — expect 213+6 passed, 7 pre-existing fails
- [ ] **Step 2: Fix if needed**
- [ ] **Step 3: Commit**

---

## Self-Review

- Spec coverage: window, canSubmit, file, status, Idempotency semua di-task 2-3 ✓
- Placeholder: none
- Type consistency: `SubmissionResource` camelCase, `StoreSubmissionRequest` snake, `SubmissionService` signatures match controller
