# Submission API — Direct Collection (All UPFRONT)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** API submission per-stage tanpa payment gate, window `Stage.start→end`, file ImageKit `SUBMISSION`, status `draft/submitted`, idempotent.

**Architecture:** `SubmissionController → SubmissionService (transaction+lockForUpdate+window+ownedFile) → Submission/File → SubmissionResource`. `DashboardService.getSubmissionShell` sudah direfactor jadi `window/canSubmit/submission`. Envelope `snake→camel`.

**Tech Stack:** Laravel PHP 8.3, MySQL `submissions` (HasUuids, unique team+stage), ImageKit, Pest.

## Global Constraints

- No migration baru (reuse `submissions`).
- Request `snake_case`, response `camelCase`, envelope `{status,message,data,metadata,error}`.
- Auth `auth:sanctum+team.verified`, `current_stage_id==stage.id`, `competition match`.
- `purpose SUBMISSION`, `uploaded_by==team.id`, window server time, `Idempotency-Key`.

---

## File Structure

- Modify: `app/Services/DashboardService.php:64-149` — window/canSubmit (already)
- Create: `app/Http/Requests/Submission/StoreSubmissionRequest.php`
- Create: `app/Http/Resources/SubmissionResource.php`
- Create: `app/Services/SubmissionService.php`
- Create: `app/Http/Controllers/Api/SubmissionController.php`
- Modify: `routes/api.php` — add Team group `GET shell, POST upsert, POST submit, POST unsubmit`

---

## API Contract

### GET /api/dashboard/stages/{stage}/submission
- 200 `{stage, competition, batch, window{isOpen,isOverdue,remainingMs,startDate,endDate}, submission{...file}|null, canSubmit}`

### POST /api/dashboard/stages/{stage}/submission
- Request `{title 3-180, description max5000, file_id uuid nullable + owned}`
- 200 `SubmissionResource`, 422 window closed / foreign file

### POST /api/dashboard/stages/{stage}/submission/submit
- Header `Idempotency-Key`, checks `window.isOpen, file!=null, status draft`, effect `submitted_at=now`, 200 idempotent

### POST /api/dashboard/stages/{stage}/submission/unsubmit
- Checks `status==submitted && window.isOpen && reviewed_at==null`, effect `status=draft`

---

### Task 1: Dashboard Shell (Done)

**Files:** `DashboardService`, `Submission HasUuids`, `dashboardTypes`, `Show.tsx` (window), `TeamActivityDashboardTest`, `SubmissionShellDirectCollectionTest`
- [x] RED 3 failed → GREEN 3 passed, `tsc` passed

---

### Task 2: StoreSubmissionRequest + SubmissionResource

**Files:**
- Create: `app/Http/Requests/Submission/StoreSubmissionRequest.php`
- Create: `app/Http/Resources/SubmissionResource.php`
- Test: `tests/Feature/Submission/SubmissionApiValidationTest.php`

**Interfaces:**
- Produces: `StoreSubmissionRequest rules()`, `SubmissionResource toArray`

- [ ] **Step 1: Write failing test**

```php
test('upsert requires title', function(){ ... post title '' => 422 });
test('rejects foreign file', function(){ ... file other team => 422 });
```

- [ ] **Step 2: Run → FAIL**
- [ ] **Step 3: Implement**

```php
// StoreSubmissionRequest
public function rules(): array { return ['title'=>['required','string','min:3','max:180'], 'description'=>['nullable','string','max:5000'], 'file_id'=>['nullable','uuid','exists:files,id', fn($a,$v,$f)=> $this->ownedCheck($v,$f)]]; }
private function ownedCheck($v,$fail){ $f=File::find($v); if(!$f||$f->uploaded_by!=$this->user()->id||$f->purpose!=='SUBMISSION') $fail('File tidak valid'); }
// SubmissionResource
public function toArray($req){ return ['id'=>$this->id,'title'=>$this->title,'description'=>$this->description,'status'=>$this->status,'score'=>$this->score,'feedback'=>$this->feedback,'submittedAt'=>$this->submitted_at?->toISOString(),'reviewedAt'=>$this->reviewed_at?->toISOString(),'file'=>$this->file?['id'=>$this->file->id,'fileId'=>$this->file->file_id,'url'=>$this->file->url]]; }
```

- [ ] **Step 4: Run → PASS**
- [ ] **Step 5: Commit**

---

### Task 3: SubmissionService + Controller + Routes

**Files:**
- Create: `app/Services/SubmissionService.php`
- Create: `app/Http/Controllers/Api/SubmissionController.php`
- Modify: `routes/api.php`
- Test: `tests/Feature/Submission/SubmissionTest.php`

**Interfaces:**
- Produces: `SubmissionService.upsertDraft/show/submit/unsubmit`, `SubmissionController.upsert/submit/unsubmit`

- [ ] **Step 1: Write failing test**

```php
test('can upsert draft when window open', function(){ ... assertOk });
test('cannot upsert when window closed', function(){ ... stage end yesterday => 422 });
test('submit requires file', function(){ ... 422 });
test('idempotent submit', function(){ ... same Idempotency-Key => same id });
```

- [ ] **Step 2: Run → FAIL**
- [ ] **Step 3: Implement**

```php
// SubmissionService
public function upsertDraft(Team $team, Stage $stage, array $data): Submission { $this->assertCanAccess($team,$stage); $this->assertWindowOpen($stage); return DB::transaction(fn()=> Submission::lockForUpdate()->firstOrCreate(['team_id'=>$team->id,'stage_id'=>$stage->id],['status'=>'draft'])->tap(fn($s)=> $s->update(['title'=>$data['title'],'description'=>$data['description']??null,'file_id'=>$data['file_id']??$s->file_id]))->fresh()->load('file')); }
public function submit(Team $team, Stage $stage): Submission { ... check window, file, status, update status=submitted, submitted_at=now(); }
private function assertWindowOpen(Stage $s){ if(now()->lt($s->start_date)||now()->gt($s->end_date)) throw ValidationException::withMessages(['window'=>['Periode tidak dibuka']]); }
```

- [ ] **Step 4: Run → PASS**
- [ ] **Step 5: Commit**

---

### Task 4: QA

**Files:** `docs/API/README.md` add 4 endpoints

- [ ] **Step 1: Run** `php artisan test` 213+6 passed, `pint --test`, `tsc`
- [ ] **Step 2: Commit**

---

## Self-Review

- Window server authority, owned file, idempotent, no migration ✓
