# Execution API — Olympiad Timed + Cheat Alert-Only

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Timed exam `duration/max_attempts/shuffle`, server authority `end_time`, cheat `suspicious_score` alert-only, admin mutable `total_score`.

**Architecture:** `ExamAttemptService + ExamDetectionService + ExamScoringService → ExamAttempt/ExamAnswer/ExamEventLog` + cron `AutoSubmit`.

**Tech Stack:** Laravel PHP 8.3, MySQL `exam_*`, Pest.

## Global Constraints

- No migration, reuse `flagged, cheat_count, suspicious_score, device_id, ip, user_agent, metadata, total_score`, `exam_event_logs 20 types`, `time_spent`.
- Request `snake`, response `camel`, envelope.
- Auth Team `team.verified + current_stage_id==exam.stage_id` + window, Admin `judge`.
- Server time authority, shuffle once, alert-only, `PATCH score` audit.

---

## File Structure

- Create: `app/Http/Requests/Exam/StartExamRequest.php`, `SaveAnswersRequest.php`, `StoreEventsRequest.php`, `UpdateScoreRequest.php`
- Create: `app/Services/ExamAttemptService.php`, `ExamDetectionService.php`, `ExamScoringService.php`
- Create: `app/Http/Controllers/Api/ExamAttemptController.php`
- Create: `app/Http/Controllers/Api/AdminExamAttemptController.php`
- Modify: `routes/api.php` — 7 Team + 3 Admin routes
- Create: `app/Http/Resources/ExamAttemptResource.php`, `ExamQuestionResource.php`
- Test: `tests/Feature/Exam/ExamAttemptTest.php` (8), `ExamDetectionTest.php` (4), `Admin/ExamScoreUpdateTest.php` (3)

---

## API Contract

**Team 7:**

1) `GET /dashboard/exams/{exam}` + `attempt summary, serverTime`
2) `POST /attempts` → 201 `{attempt, questions without correct_answer, serverTime}`, 403/422/409, `end_time=min(now+duration, exam.end_date)`, `max_possible_score`, `metadata.questionOrder`, event `started`
3) `GET /attempts/{id}` resume + `savedAnswers`
4) `PUT /attempts/{id}/answers` `{answers:[{question_id, selected_options, answer, time_spent}]} max50`, upsert, `is_correct/score_obtained`, 200 `{saved}`
5) `POST /attempts/{id}/events` `{events:[{type, metadata, clientAt}]} max50`, weights `tab5/window5/fullscreen8/copy10/paste15/right3/devtools25`, `flagged>=50`, 200 `{suspiciousScore, flagged}`
6) `POST /attempts/{id}/submit` → `finished, total_score`, 200
7) `POST /attempts/{id}/heartbeat` → `metadata.heartbeatAt`

**Admin 3:**

8) `GET /admin/exams/{exam}/attempts?flagged&search&page` paginated
9) `GET /admin/.../{attempt}` detail + `answers + timeline`
10) `PATCH /admin/.../{attempt}/score` `{total_score 0-max, reason 1-2000}` → `reviewed_by`, audit

---

### Task 1: Start & Resume

**Files:**
- Create: `ExamAttemptService.php`, `ExamAttemptController` (start,resume), `ExamAttemptResource.php`
- Test: `ExamAttemptTest` (start)

**Interfaces:**
- Produces: `ExamAttemptService.start(Team,Exam,Request):array`, `resume(Team,Exam,Attempt):array`

- [ ] **Step 1: Write failing test** — `can start when window open`, `cannot outside window`, `cannot exceed max`, `resume saved`

- [ ] **Step 2: Run → FAIL** 404
- [ ] **Step 3: Implement** (see combined C1 Task1)
- [ ] **Step 4: Run → PASS**
- [ ] **Step 5: Commit**

---

### Task 2: Save Answers + Scoring

**Files:**
- Create: `SaveAnswersRequest.php`, `ExamScoringService.php`
- Test: `ExamAttemptTest` continue

**Interfaces:**
- Produces: `SaveAnswersRequest rules()`, `ExamScoringService.score(Question,array):array`

- [ ] **Step 1: Write failing test** — `save correct/incorrect, essay null`

- [ ] **Step 2: Run → FAIL**
- [ ] **Step 3: Implement** (see combined)
- [ ] **Step 4: Run → PASS**
- [ ] **Step 5: Commit**

---

### Task 3: Cheat Events + Detection

**Files:**
- Create: `ExamDetectionService.php`, `StoreEventsRequest.php`
- Test: `ExamDetectionTest.php`

**Interfaces:**
- Produces: `ExamDetectionService.accumulate(Attempt, events):array`, `StoreEventsRequest`

- [ ] **Step 1: Write failing test** — `tab increments, devtools flagged, device drift`

- [ ] **Step 2: Run → FAIL**
- [ ] **Step 3: Implement** (weights, flagged, insert batch)
- [ ] **Step 4: Run → PASS**
- [ ] **Step 5: Commit**

---

### Task 4: Submit & Heartbeat + Cron

**Files:**
- Modify: `ExamAttemptService` add `submit, heartbeat`
- Create: `AutoSubmitExpiredAttempts` cron
- Test: `ExamAttemptTest` submit

**Interfaces:**
- Produces: `submit(Team,Exam,Attempt):Attempt`, `heartbeat(Attempt)`

- [ ] **Step 1: Write failing test** — `manual submit total, auto cron`

- [ ] **Step 2: Run → FAIL**
- [ ] **Step 3: Implement** (see combined)
- [ ] **Step 4: Run → PASS**
- [ ] **Step 5: Commit**

---

### Task 5: Admin Mutable Score + Filter Flagged

**Files:**
- Create: `AdminExamAttemptController.php`, `UpdateScoreRequest.php`
- Test: `ExamScoreUpdateTest.php`

**Interfaces:**
- Produces: `AdminExamAttemptController.index/show/updateScore`

- [ ] **Step 1: Write failing test** — `admin can update, beyond max fails, list flagged`

- [ ] **Step 2: Run → FAIL**
- [ ] **Step 3: Implement** (see combined)
- [ ] **Step 4: Run → PASS**
- [ ] **Step 5: Commit**

---

### Task 6: QA

**Files:** `docs/API/README.md` add 10 endpoints

- [ ] **Step 1: Run** `php artisan test --filter=Exam` 15 passed
- [ ] **Step 2: Commit**

---

## Self-Review

- Alert-only, mutable, server authority, no migration ✓
