# Judging API — Simple Score

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Juri nilai submission `score 0-100 + feedback + status`, audit, list filtered.

**Architecture:** `JudgingController → JudgingService (lockForUpdate) → Submission + Audit → JudgingSubmissionResource`. Reuse `submissions` columns.

**Tech Stack:** Laravel PHP 8.3, MySQL, Pest.

## Global Constraints

- No migration, reuse `score/feedback/reviewed`.
- Request `snake`, response `camel`, envelope.
- Auth `judge/super_admin`, `score 0-100`, `feedback 1-2000` required for rejected/revision.

---

## File Structure

- Create: `app/Http/Requests/Admin/ReviewSubmissionRequest.php`
- Create: `app/Services/JudgingService.php`
- Create: `app/Http/Controllers/Api/JudgingController.php`
- Create: `app/Http/Resources/JudgingSubmissionResource.php`
- Modify: `routes/api.php` — add 3 Admin routes
- Modify: `app/Policies/SubmissionPolicy.php`

---

## API Contract

### GET /admin/stages/{stage}/submissions?status&search&page
- 200 `{data:[{id,team:{code,name},title,status,score}], meta}`

### GET /admin/submissions/{id}
- 200 `JudgingSubmissionResource`

### POST /admin/submissions/{id}/review
- Request `{action in approved/rejected/revision_requested/under_review, score nullable 0-100 required_if approved, feedback nullable max2000 required_if rejected/revision}`
- Effect `status,score,feedback,reviewed_by/at`, audit `judging.review`
- 200 `JudgingSubmissionResource`

---

### Task 1: ReviewSubmissionRequest + JudgingService

**Files:**
- Create: `ReviewSubmissionRequest.php`
- Create: `JudgingService.php`
- Test: `tests/Feature/Judging/JudgingTest.php` (part)

**Interfaces:**
- Produces: `ReviewSubmissionRequest rules()`, `JudgingService.review(Admin,Submission,array):Submission`

- [ ] **Step 1: Write failing test**

```php
test('judge can approve with score', function(){ ... post approved score 85 => assertOk data.status approved data.score 85 });
test('revision without feedback fails', function(){ ... 422 });
```

- [ ] **Step 2: Run → FAIL** 404
- [ ] **Step 3: Implement** (see combined plan B1)
- [ ] **Step 4: Run → PASS**
- [ ] **Step 5: Commit**

---

### Task 2: Controller + Routes + Policy

**Files:**
- Create: `JudgingController.php`
- Modify: `routes/api.php`
- Create: `SubmissionPolicy.php`
- Test: same file

**Interfaces:**
- Produces: `JudgingController.index/show/review`

- [ ] **Step 1: Write failing test** — `GET list`, `GET detail`, `403 team`
- [ ] **Step 2: Run → FAIL**
- [ ] **Step 3: Implement** (see combined)
- [ ] **Step 4: Run → PASS**
- [ ] **Step 5: Commit**

---

### Task 3: QA

**Files:** `docs/API/README.md` add endpoints

- [ ] **Step 1: Run** `php artisan test --filter=Judging` 6 passed
- [ ] **Step 2: Commit**

---

## Self-Review

- Simple 1 score, no rubric, audit ✓
