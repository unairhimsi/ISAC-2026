# Pengerjaan Olimpiade — Timed Exam + Cheat Detection Alert-Only + Admin Mutable Score (C1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Team OLIMPIADE dapat mengerjakan ujian timed per-stage (`duration, max_attempts, shuffle, window`) dengan autosave, auto-submit, cheat detection **alert-only** (tidak auto-diskualifikasi, hanya `flagged+suspicious_score` badge untuk juri), dan admin dapat **update manual `total_score`** (re-grade). Semua lomba sudah UPFRONT, jadi exam tidak ada payment gate.

**Architecture:** `ExamAttemptService (start/resume/saveAnswer/submit/heartbeat) + ExamDetectionService (batch events → suspicious_score) + ExamScoringService (is_correct, score_obtained) → ExamAttempt/ExamAnswer/ExamEventLog`. `ExamAttempt` server-authority `end_time = min(now+duration, exam.end_date)`, `remainingMs = end_time - serverNow`. Frontend `features/exam` (api/hooks/workspace) + `Pages/Dashboard/Olympiad/ExamWorkspace.tsx` (timer isolated, visibility listeners → sendBeacon batch). Admin `ExamJudgingService` + `PATCH /admin/.../score`. Reuse existing DB columns, no migration.

**Tech Stack:** Laravel PHP 8.3, MySQL `exams/exam_questions/exam_attempts/exam_answers/exam_event_logs` (uuid, softDeletes, indexes), React 19 TS TanStack Query, Tailwind, Pest, Cron `schedule:run` for auto-submit.

## Global Constraints

- No new migration, reuse `flagged, cheat_count, suspicious_score, device_id, ip_address, user_agent, metadata, total_score, max_possible_score, start_time, end_time, finished` + `exam_event_logs type enum 20` + `exam_answers time_spent`.
- Request `snake_case`, response `camelCase`, envelope.
- Auth Team `auth:sanctum + team.verified + current_stage_id==exam.stage_id`, Admin `auth:admins`.
- Server time authority, client only display.
- Shuffle once at attempt creation, store `metadata.questionOrder`.
- Alert-only: `flagged` tidak block submit, hanya filter di judging.
- Admin mutable score via `PATCH .../score` with audit.

---

## File Structure

- Create: `app/Http/Requests/Exam/StartExamRequest.php` (empty, authorize via policy), `SaveAnswersRequest.php`, `StoreEventsRequest.php`, `UpdateScoreRequest.php`
- Create: `app/Services/ExamAttemptService.php`, `ExamDetectionService.php`, `ExamScoringService.php`
- Create: `app/Http/Controllers/Api/ExamAttemptController.php`
- Create: `app/Http/Controllers/Api/AdminExamAttemptController.php`
- Modify: `routes/api.php:34-101` — add 7 Team routes under `dashboard/exams`, 3 Admin routes
- Modify: `app/Http/Resources/ExamAttemptResource.php` (create), `ExamQuestionResource.php` (strip correct_answer)
- Create: `resources/js/features/exam/api/examApi.ts`
- Create: `resources/js/features/exam/hooks/useExamAttempt.ts`
- Create: `resources/js/features/exam/types/examTypes.ts`
- Create: `resources/js/features/exam/components/ExamWorkspace.tsx`, `TimerBadge.tsx`, `QuestionCard.tsx`, `QuestionNav.tsx`
- Modify: `resources/js/Pages/Dashboard/Olympiad/Show.tsx` — add “Mulai Ujian” CTA → workspace
- Create: `resources/js/Pages/Dashboard/Olympiad/ExamWorkspacePage.tsx` (Inertia page)
- Modify: `routes/web.php:125-130` — add `Route::get('/dashboard/olimpiade/{exam}/workspace', ...)`
- Test: `tests/Feature/Exam/ExamAttemptTest.php` (8 tests), `tests/Feature/Exam/ExamDetectionTest.php` (4 tests), `tests/Feature/Admin/ExamScoreUpdateTest.php` (3 tests)

---

## API Contract Canonical

### Team — Pengerjaan

#### 1) GET /api/dashboard/exams/{exam} — Exam Shell (existing, tambah attempt summary)
**Existing:** `exam, stage, competition, batch` + **tambah** `attempt:{id, status, remainingMs, finished, attemptCount, maxAttempts}` dan `serverTime` di `metadata`. Jika belum ada attempt, `attempt=null`.

#### 2) POST /api/dashboard/exams/{exam}/attempts — Start Attempt
**Checks:** `now ∈ [exam.start_date, exam.end_date]`, `team.current_stage_id==exam.stage_id`, `exam.stage.competition.type==OLIMPIADE`, `attempts.count < max_attempts`, `no unfinished attempt` (kecuali allow resume).
**Effect:** `ExamAttempt::create{team_id, exam_id, start_time=now, end_time=min(now+duration*60, exam.end_date), max_possible_score=sum(correct_score where is_active), device_id=header, ip=userIp, user_agent}` + `eventLogs create type=started`.
**Shuffle:** Jika `shuffle_questions` true, `order = shuffle(questionIds)`, simpan `metadata.questionOrder`, `metadata.optionOrder` per question jika `shuffle_options`.
**Response 201:**
```json
{"status":"success","data":{"attempt":{"id":"uuid","startTime":"...","endTime":"...","remainingMs":3600000,"finished":false,"flagged":false,"attemptNumber":1},"questions":[{"id":"uuid","question":"<p>HTML</p>","type":"multiple_choice","options":[{"id":"opt1","content":"A"}],"order":1}],"serverTime":"2026-08-29T01:00:00Z"}}
```
**Errors:** 403 not eligible, 422 max_attempts reached / outside window, 409 already has unfinished (resume instead).

#### 3) GET /api/dashboard/exams/{exam}/attempts/{attempt} — Resume / Poll
**Checks:** `attempt.team_id==team.id`, `attempt.exam_id==exam.id`
**Response 200:** same as start but `questions` include `savedAnswer:{selected_options, answer, time_spent}` + `eventLogs` not included.
**Use:** polling `remainingMs` every 30s + on focus.

#### 4) PUT /api/dashboard/exams/{exam}/attempts/{attempt}/answers — Save Answers (batch)
**Request:**
```json
{"answers":[{"question_id":"uuid","selected_options":["opt1"],"answer":"esai teks","time_spent":45}]}
```
Validation: `answers array max 50`, `question_id exists in exam`, `selected_options array`, `answer nullable string max 5000`, `time_spent 0-3600`.
**Logic:** For each `question_id`, `is_correct = (selected_options == correct_answer)` or for essay `null`, `score_obtained = is_correct ? correct_score : (selected_options empty ? empty_score : wrong_score)`, `upsert ExamAnswer(attempt_id,question_id)`, `eventLogs question_answered/changed`. Update `attempt.metadata.lastHeartbeat=now`.
**Response 200:** `{saved:3, total_score_preview: 10 (only if show_result_immediately else null)}`

#### 5) POST /api/dashboard/exams/{exam}/attempts/{attempt}/events — Cheat Events Batch
**Request:**
```json
{"events":[{"type":"tab_switched","metadata":{"visibilityState":"hidden","elapsedMs":120},"clientAt":"2026-08-29T01:01:00Z"}]}
```
Validation: `events array max 50`, `type in enum 20`, `metadata json max 2k`, `clientAt iso`.
**Logic:** `ExamEventLog::insert batch`, `ExamDetectionService.accumulate(attempt, events)` → increment `cheat_count` + `suspicious_score` via weights, set `flagged` if `score>=50` or `cheat_count>=5` or `device drift`. No auto-submit.
**Response 200:** `{ingested:5, suspiciousScore:15, flagged:false}`

**Weights (alert-only):**
```
tab_switched=5, window_blurred=5, window_focused=-1, fullscreen_exited=8,
copy_attempted=10, paste_attempted=15, right_click_attempted=3,
devtools_opened=25, screenshot_attempted=12, suspicious_activity=20,
disconnected=2, reconnected=-2
flagged = suspicious_score>=50 OR cheat_count>=5 OR device_id mismatch + ip drift
```

#### 6) POST /api/dashboard/exams/{exam}/attempts/{attempt}/submit — Manual Submit
**Checks:** `attempt.team_id==team.id`, `!finished`, `now <= end_time + grace 60s` (allow late submit within grace, else auto flag)
**Effect:** `finished=true, end_time=now, total_score=sum(score_obtained), eventLogs submitted`, recalc `flagged` final.
**Response 200:** `{attempt:{finished:true,totalScore:75,flagged:false}, showResult: exam.show_result_immediately ? {score, maxScore} : {hidden:true}}`

#### 7) POST /api/dashboard/exams/{exam}/attempts/{attempt}/heartbeat — Optional keepalive
**Body:** `{clientTime:"..."}`
**Effect:** `metadata.heartbeatAt=now`, detect `disconnected` if gap >60s.

### Admin — Mutable Score + Flagged Review

#### 8) GET /api/admin/exams/{exam}/attempts — List dengan filter flagged
**Query:** `?flagged=true&finished=true&search=teamCode & page`
**Response:** paginated `ExamAttemptResource` with `team, totalScore, flagged, suspiciousScore, cheatCount`.

#### 9) GET /api/admin/exams/{exam}/attempts/{attempt} — Detail + timeline
**Include:** `answers, eventLogs timeline, question correct_answer (admin only)`.

#### 10) PATCH /api/admin/exams/{exam}/attempts/{attempt}/score — Update Manual
**Request:** `{"total_score":80,"reason":"Koreksi manual juri"}`
Validation: `total_score integer 0-max_possible_score`, `reason 1-2000`.
**Effect:** `total_score = input, reviewed_by=admin.id, audit payment.unverified style`.
**Response 200:** `ExamAttemptResource`

### Flow Mermaid (Team)

```mermaid
flowchart TD
  A[GET /dashboard/exams/{exam}] --> B{eligible? window + stage + attempts < max}
  B -->|no| C[Card UPCOMING/ENDED]
  B -->|yes| D[POST /attempts → start]
  D --> E[GET questions shuffled]
  E --> F[Workspace: TimerBadge serverNow + remainingMs]
  F --> G[Answer → PUT /answers debounce 800ms]
  F --> H[Visibility/copy/paste → POST /events batch]
  H --> I[ExamDetectionService → suspicious_score/flagged alert-only]
  G --> J[POST /submit manual]
  J --> K{Cron end_time<now?}
  K -->|auto| L[auto_submitted]
  K -->|manual| M[finished, total_score]
  M --> N[Admin GET /admin/.../attempts?flagged → PATCH /score mutable]
```

---

### Task 1: ExamAttemptService — Start & Resume

**Files:**
- Create: `app/Services/ExamAttemptService.php`
- Create: `app/Http/Controllers/Api/ExamAttemptController.php` (start, resume)
- Create: `app/Http/Resources/ExamAttemptResource.php`
- Test: `tests/Feature/Exam/ExamAttemptTest.php` (start tests)

**Interfaces:**
- Consumes: `Exam, Stage, Team, ExamAttempt`
- Produces: `ExamAttemptService.start(Team,Exam,Request):ExamAttempt`, `resume(Team,Exam,Attempt):array`, `ExamAttemptResource`

- [ ] **Step 1: Write failing test**

```php
test('team can start attempt when window open', function(){
  $team=Team::factory()->create(['status'=>Team::STATUS_VERIFIED]); $c=Competition::factory()->create(['type'=>Competition::TYPE_OLIMPIADE]); $stage=Stage::create(['competition_id'=>$c->id,'name'=>'Elimination','order'=>1]); $exam=Exam::create(['stage_id'=>$stage->id,'title'=>'Ujian','start_date'=>now()->subHour(),'end_date'=>now()->addHour(),'duration'=>60,'max_attempts'=>2]); $team->update(['current_stage_id'=>$stage->id]); Registration::create([...]); $token=$team->createToken('t')->plainTextToken;
  $this->withToken($token)->postJson("/api/dashboard/exams/{$exam->id}/attempts")->assertCreated()->assertJsonPath('data.attempt.finished',false)->assertJsonPath('data.questions.0.id', $exam->questions()->first()->id);
});
test('cannot start outside window', function(){ ... exam start tomorrow => 422 });
test('cannot exceed max_attempts', function(){ ... create 2 attempts finished => 422 });
test('resume returns saved answers', function(){ ... start, PUT answers, GET resume => assert saved });
```

- [ ] **Step 2: Run → FAIL** — 404 routes not found
- [ ] **Step 3: Implement**

```php
// ExamAttemptService
public function start(Team $team, Exam $exam, Request $req): array {
  $this->assertEligible($team,$exam); // window, stage, attempts count
  return DB::transaction(function() use($team,$exam,$req){
    $maxScore = $exam->questions()->where('is_active',true)->sum('correct_score');
    $attempt = ExamAttempt::create(['id'=>Str::uuid(),'team_id'=>$team->id,'exam_id'=>$exam->id,'start_time'=>now(),'end_time'=>now()->addMinutes($exam->duration)->min($exam->end_date),'max_possible_score'=>$maxScore,'device_id'=>$req->header('X-Device-Id'),'ip_address'=>$req->ip(),'user_agent'=>$req->userAgent(),'metadata'=>['questionOrder'=>$this->shuffleOrder($exam)] ]);
    $attempt->eventLogs()->create(['type'=>'started','metadata'=>['ip'=>$req->ip()]]);
    return ['attempt'=>new ExamAttemptResource($attempt), 'questions'=>$this->questionsForAttempt($attempt), 'serverTime'=>now()->toISOString()];
  });
}
private function assertEligible(Team $team, Exam $exam){ if($team->current_stage_id!==$exam->stage_id) throw ValidationException; if(now()->lt($exam->start_date)||now()->gt($exam->end_date)) throw ValidationException; if($exam->attempts()->where('team_id',$team->id)->count() >= $exam->max_attempts) throw ValidationException; }
```

- [ ] **Step 4: Run → PASS**
- [ ] **Step 5: Commit**

---

### Task 2: Save Answers + Scoring

**Files:**
- Create: `app/Http/Requests/Exam/SaveAnswersRequest.php`
- Modify: `app/Services/ExamScoringService.php` (or inside AttemptService)
- Test: `ExamAttemptTest` continue

**Interfaces:**
- Produces: `SaveAnswersRequest rules()`, `ExamScoringService.score(Question, array $selected): array{is_correct, score_obtained}`

- [ ] **Step 1: Write failing test**

```php
test('save answer calculates is_correct and score', function(){ ... create question correct_answer opt1 correct_score 10, post answers selected opt1 => assert is_correct true score 10 });
test('essay returns is_correct null', function(){ ... });
```

- [ ] **Step 2: Run → FAIL**
- [ ] **Step 3: Implement**

```php
// SaveAnswersRequest rules: 'answers'=>['required','array','max:50'], 'answers.*.question_id'=>['required','uuid','exists:exam_questions,id'], 'answers.*.selected_options'=>['nullable','array'], 'answers.*.answer'=>['nullable','string','max:5000'], 'answers.*.time_spent'=>['nullable','integer','min:0','max:3600']
// ExamScoringService
public function score(ExamQuestion $q, array $payload): array {
  if(in_array($q->type,['multiple_choice','true_false'],true)){ $correct = $q->correct_answer; $selected = $payload['selected_options']??[]; $isCorrect = $selected===[$correct] || $selected=== $correct /* handle single */; $score = empty($selected) ? $q->empty_score : ($isCorrect ? $q->correct_score : $q->wrong_score); return ['is_correct'=>$isCorrect,'score_obtained'=>$score]; }
  return ['is_correct'=>null,'score_obtained'=>0];
}
// Controller save
public function saveAnswers(SaveAnswersRequest $req, Exam $exam, ExamAttempt $attempt){ $this->authorizeAttempt($attempt); foreach($req->validated('answers') as $ans){ $q=ExamQuestion::find($ans['question_id']); $scored=$this->scoring->score($q,$ans); ExamAnswer::updateOrCreate(['attempt_id'=>$attempt->id,'question_id'=>$q->id], ['selected_options'=>$ans['selected_options']??null,'answer'=>$ans['answer']??null,'time_spent'=>$ans['time_spent']??null,'is_correct'=>$scored['is_correct'],'score_obtained'=>$scored['score_obtained'],'answered_at'=>now()]); $attempt->eventLogs()->create(['type'=>'question_answered','metadata'=>['question_id'=>$q->id]]); } return response()->json(['status'=>'success','data'=>['saved'=>count($req->answers)]]); }
```

- [ ] **Step 4: Run → PASS**
- [ ] **Step 5: Commit**

---

### Task 3: Cheat Events Ingestion + Detection (Alert-only)

**Files:**
- Create: `app/Services/ExamDetectionService.php`
- Create: `app/Http/Requests/Exam/StoreEventsRequest.php`
- Test: `tests/Feature/Exam/ExamDetectionTest.php`

**Interfaces:**
- Produces: `ExamDetectionService.accumulate(ExamAttempt, array $events): array{suspiciousScore, flagged}`, `StoreEventsRequest rules()`

- [ ] **Step 1: Write failing test**

```php
test('tab_switched increments suspicious_score', function(){ $attempt=ExamAttempt::factory()->create(['suspicious_score'=>0,'cheat_count'=>0]); $this->withToken(teamToken)->postJson("/api/dashboard/exams/{$exam->id}/attempts/{$attempt->id}/events", ['events'=>[['type'=>'tab_switched'],['type'=>'tab_switched']]])->assertOk()->assertJsonPath('data.suspiciousScore',10); expect($attempt->fresh()->cheat_count)->toBe(2); });
test('devtools triggers flagged when threshold 50', function(){ ... 3 devtools = 75 => flagged true });
test('device drift adds score', function(){ ... different device_id => +20 });
```

- [ ] **Step 2: Run → FAIL**
- [ ] **Step 3: Implement**

```php
// StoreEventsRequest: 'events'=>['required','array','max:50'], 'events.*.type'=>['required',Rule::in(['tab_switched',...])], 'events.*.metadata'=>['nullable','array'], 'events.*.clientAt'=>['nullable','date']
// ExamDetectionService
const WEIGHTS = ['tab_switched'=>5,'window_blurred'=>5,'window_focused'=>-1,'fullscreen_exited'=>8,'copy_attempted'=>10,'paste_attempted'=>15,'right_click_attempted'=>3,'devtools_opened'=>25,'screenshot_attempted'=>12,'suspicious_activity'=>20];
public function accumulate(ExamAttempt $attempt, array $events): array {
  $score=0; $count=0; foreach($events as $e){ $score+= self::WEIGHTS[$e['type']]??0; if(in_array($e['type'],['tab_switched','copy_attempted','paste_attempted','devtools_opened'],true)) $count++; }
  // device drift
  $lastDevice=$attempt->device_id; $newDevice=request()->header('X-Device-Id'); if($newDevice && $lastDevice && $newDevice!==$lastDevice) $score+=20;
  $attempt->increment('suspicious_score',$score); $attempt->increment('cheat_count',$count);
  $flagged = $attempt->fresh()->suspicious_score>=50 || $attempt->fresh()->cheat_count>=5;
  if($flagged && !$attempt->flagged) $attempt->update(['flagged'=>true]);
  ExamEventLog::insert(collect($events)->map(fn($e)=>['id'=>Str::uuid(),'attempt_id'=>$attempt->id,'type'=>$e['type'],'metadata'=>json_encode($e['metadata']??[]),'created_at'=>now(),'updated_at'=>now()])->toArray());
  return ['suspiciousScore'=>$attempt->fresh()->suspicious_score,'flagged'=>$attempt->fresh()->flagged];
}
```

- [ ] **Step 4: Run → PASS**
- [ ] **Step 5: Commit**

---

### Task 4: Submit & Heartbeat + Auto-submit Cron

**Files:**
- Modify: `ExamAttemptService` add `submit()`, `heartbeat()`
- Create: `app/Console/Commands/AutoSubmitExpiredAttempts.php`
- Test: `ExamAttemptTest` submit tests

**Interfaces:**
- Produces: `submit(Team,Exam,Attempt):ExamAttempt`, `heartbeat(Attempt):void`

- [ ] **Step 1: Write failing test**

```php
test('manual submit calculates total_score', function(){ ... start, save 2 answers 10 each, post submit => assert total_score 20 finished true });
test('auto-submit cron finishes expired', function(){ ... create attempt end_time yesterday finished false, run command => assert finished true event auto_submitted });
```

- [ ] **Step 2: Run → FAIL**
- [ ] **Step 3: Implement**

```php
public function submit(Team $team, Exam $exam, ExamAttempt $attempt){ $this->authorizeAttempt($team,$attempt); if($attempt->finished) return $attempt; $total=ExamAnswer::where('attempt_id',$attempt->id)->sum('score_obtained'); $attempt->update(['finished'=>true,'end_time'=>now(),'total_score'=>$total]); $attempt->eventLogs()->create(['type'=>'submitted']); return $attempt->fresh(); }
// Cron
public function handle(){ ExamAttempt::where('finished',false)->where('end_time','<',now())->chunk(100, fn($attempts)=> $attempts->each(fn($a)=>{ $a->update(['finished'=>true]); $a->eventLogs()->create(['type'=>'auto_submitted']); })); }
```

- [ ] **Step 4: Run → PASS**
- [ ] **Step 5: Commit**

---

### Task 5: Admin Mutable Score + Filter Flagged

**Files:**
- Create: `app/Http/Controllers/Api/AdminExamAttemptController.php`
- Create: `app/Http/Requests/Admin/UpdateScoreRequest.php`
- Test: `tests/Feature/Admin/ExamScoreUpdateTest.php`

**Interfaces:**
- Produces: `AdminExamAttemptController.index(Exam, Request), show(Exam,Attempt), updateScore(UpdateScoreRequest,Attempt):JsonResponse`

- [ ] **Step 1: Write failing test**

```php
test('admin can update total_score', function(){ $admin=Admin::factory()->create(['role'=>'super_admin']); $attempt=ExamAttempt::factory()->create(['total_score'=>50,'max_possible_score'=>100]); $token=$admin->createToken('t')->plainTextToken; $this->withToken($token)->patchJson("/api/admin/exams/{$exam->id}/attempts/{$attempt->id}/score", ['total_score'=>80,'reason'=>'Koreksi'])->assertOk()->assertJsonPath('data.totalScore',80); expect($attempt->fresh()->reviewed_by)->toBe($admin->id); });
test('score beyond max fails', function(){ ... 101 => 422 });
test('judge can list flagged', function(){ ... create flagged true, get ?flagged=true => contains });
```

- [ ] **Step 2: Run → FAIL**
- [ ] **Step 3: Implement**

```php
// UpdateScoreRequest: 'total_score'=>['required','integer','min:0','max:'.$attempt->max_possible_score], 'reason'=>['required','string','min:3','max:2000']
// Controller
public function updateScore(UpdateScoreRequest $req, Exam $exam, ExamAttempt $attempt){ Gate::authorize('judge', Exam::class); $attempt->update(['total_score'=>$req->total_score,'reviewed_by'=>$req->user()->id]); $this->audit($req->user(),'exam.score_updated',$attempt,['total_score'=>$attempt->getOriginal('total_score')],['total_score'=>$req->total_score],$req->reason,$req->header('X-Request-ID')); return response()->json(['status'=>'success','data'=>new ExamAttemptResource($attempt->fresh())]); }
public function index(Request $req, Exam $exam){ Gate::authorize('judge', Exam::class); $q=ExamAttempt::where('exam_id',$exam->id)->when($req->flagged, fn($qq)=>$qq->where('flagged',true))->paginate(); return ExamAttemptResource::collection($q); }
```

- [ ] **Step 4: Run → PASS**
- [ ] **Step 5: Commit**

---

### Task 6: Frontend Workspace (Timer isolated, listeners, sendBeacon)

**Files:**
- Create: `resources/js/features/exam/api/examApi.ts` — `start, resume, saveAnswers, postEvents, submit, heartbeat`
- Create: `hooks/useExamAttempt.ts` — `useStartAttempt, useResume, useSaveAnswers (debounce 800ms), useEvents (batch), useSubmit`
- Create: `components/TimerBadge.tsx` — isolated `useEffect setInterval 1s` from `remainingMs` derived from `serverTime` drift, not global re-render
- Create: `components/ExamWorkspace.tsx` — layout `QuestionNav (1/4) + QuestionCard (2/4) + Timer/Info (1/4)`, `visibilitychange → tab_switched`, `copy/paste/contextmenu → prevent`, `fullscreenchange → fullscreen_exited`, queue `events` batch via `sendBeacon` fallback
- Modify: `Pages/Dashboard/Olympiad/Show.tsx` — add “Mulai Ujian” CTA, “Lanjutkan” if unfinished

**Interfaces:**
- Produces: `examApi.start(examId) => Promise<AttemptShell>`, `TimerBadge({remainingMs, serverTime})`

- [ ] **Step 1: Write failing test** — `examApi.test.ts` mock fetch
- [ ] **Step 2: Run → FAIL**
- [ ] **Step 3: Implement** (as above, debounce, beacon)
- [ ] **Step 4: Run → PASS** `tsc --noEmit`, `npm run build`
- [ ] **Step 5: Commit**

---

### Task 7: QA & Docs

**Files:**
- Modify: `docs/API/README.md` — add 10 exam endpoints table
- Test: `php artisan test --filter=Exam`, `php artisan schedule:run --dry-run` for cron

- [ ] **Step 1: Run full** — `php artisan test` 213+15 passed
- [ ] **Step 2: Manual** — start → answer → tab switch → check admin flagged list → admin update score
- [ ] **Step 3: Commit**

---

## Self-Review

- Alert-only flagged, not auto block ✓
- Admin mutable score with audit ✓
- Server authority remainingMs, shuffle once ✓
- No migration, reuse existing columns ✓
- Weights consistent front/back ✓
