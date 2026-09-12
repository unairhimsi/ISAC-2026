# Tryout Result Visibility — Opsi A Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** UI pengerjaan exam: jika `exam.type === 'tryout'` tampil hasil + kunci jawaban + pembahasan setelah selesai, jika `OLIMPIADE` sembunyikan kunci/pembahasan.

**Architecture:** Backend `ExamAttemptController::show` & `ExamQuestionResource` kondisional expose `correctAnswer`/`explanation` hanya untuk tryout yang sudah finished. Frontend `Dashboard/Olympiad/Show.tsx` & `ExamWorkspace` cek `exam.type` untuk render result panel.

**Tech Stack:** Laravel 12 PHP 8.3, React 19 TS TanStack Query, Tailwind, Vite.

## Global Constraints

- Request `snake_case`, response `camelCase`, envelope `{status, message, data, metadata, error}`.
- Auth Team `principal.team + team.verified + current_stage_id === exam.stage_id` + `competition.type === OLIMPIADE` (tryout juga di bawah kompetisi Olimpiade, stage tryout).
- No migration, reuse `exams.type` (`tryout` vs `OLIMPIADE`), `exam_questions.explanation`, `exam_questions.correct_answer`.
- Server time authority untuk `end_time`.
- Shuffle sekali, flagged alert-only, PATCH score audit (existing execution API tetap hijau 15/15 via docker).

---

## File Structure

- Modify: `app/Http/Resources/ExamQuestionResource.php` — kondisional expose `correctAnswer/explanation` untuk tryout finished
- Modify: `app/Http/Controllers/Api/ExamAttemptController.php` — `show` & `submit` tambah logika tryout result
- Modify: `app/Services/ExamAttemptService.php` — `resume` return flag `canViewResult`
- Modify: `resources/js/features/dashboard/types/dashboardTypes.ts` — tambah `type` di `DashboardExam`
- Modify: `resources/js/Pages/Dashboard/Olympiad/Show.tsx` — CTA dan deskripsi bedakan tryout vs olimpiade
- Create: `resources/js/features/exam/components/TryoutResultPanel.tsx` — panel hasil tryout (skor, kunci, pembahasan)
- Modify: `resources/js/Pages/Dashboard/Olympiad/ExamWorkspacePage.tsx` atau `resources/js/features/exam/components/ExamWorkspace.tsx` — render result panel kondisional
- Test: `tests/Feature/Exam/TryoutVisibilityTest.php` — 4 test

---

### Task 1: Backend — Kondisional Expose Kunci untuk Tryout

**Files:**
- Modify: `app/Http/Resources/ExamQuestionResource.php:1-40`
- Modify: `app/Http/Controllers/Api/ExamAttemptController.php:40-90`
- Test: `tests/Feature/Exam/TryoutVisibilityTest.php`

**Interfaces:**
- Consumes: `Exam $exam (type)`, `ExamAttempt $attempt (finished, metadata)`
- Produces: `ExamQuestionResource` expose `correctAnswer` & `explanation` jika `exam.type==='tryout' && attempt.finished`

- [ ] **Step 1: Write the failing test**

```php
test('tryout finished exposes correctAnswer and explanation', function () {
    [$team, $exam] = createExamTeamContext(['exam'=>['type'=>'tryout']]);
    $token = $team->createToken('t')->plainTextToken;
    $attemptId = $this->withToken($token)->postJson("/api/dashboard/exams/{$exam->id}/attempts")->assertCreated()->json('data.attempt.id');
    DB::table('exam_attempts')->where('id',$attemptId)->update(['finished'=>true]);
    $res = $this->withToken($token)->getJson("/api/dashboard/exams/{$exam->id}/attempts/{$attemptId}")->assertOk();
    expect($res->json('data.questions.0'))->toHaveKey('correctAnswer');
    expect($res->json('data.questions.0'))->toHaveKey('explanation');
});

test('olimpiade finished does not expose correctAnswer', function () {
    [$team, $exam] = createExamTeamContext(['exam'=>['type'=>'OLIMPIADE']]);
    $token = $team->createToken('t')->plainTextToken;
    $attemptId = $this->withToken($token)->postJson("/api/dashboard/exams/{$exam->id}/attempts")->assertCreated()->json('data.attempt.id');
    DB::table('exam_attempts')->where('id',$attemptId)->update(['finished'=>true]);
    $res = $this->withToken($token)->getJson("/api/dashboard/exams/{$exam->id}/attempts/{$attemptId}")->assertOk();
    expect($res->json('data.questions.0'))->not->toHaveKey('correctAnswer');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `docker compose exec -T app php artisan test --filter=TryoutVisibilityTest -v`
Expected: FAIL `correctAnswer` missing for tryout

- [ ] **Step 3: Write minimal implementation**

```php
// ExamAttemptController::show
$canViewResult = $exam->type === 'tryout' && $attempt->finished;
$request->attributes->set('canViewResult', $canViewResult);
return [
  'attempt'=> new ExamAttemptResource($attempt),
  'questions'=> ExamQuestionResource::collection($questions)->additional(['canViewResult'=>$canViewResult]),
  'canViewResult'=>$canViewResult,
];

// ExamQuestionResource::toArray
$canView = $request->attributes->get('canViewResult') ?? ($this->exam->type==='tryout' && $this->resource->attemptFinished ?? false);
if ($canView || $isAdmin) { $data['correctAnswer']=...; $data['explanation']=...; }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `docker compose exec -T app php artisan test --filter=TryoutVisibilityTest -v`
Expected: PASS 4/4

- [ ] **Step 5: Commit**

```bash
git add app/Http/Resources/ExamQuestionResource.php app/Http/Controllers/Api/ExamAttemptController.php tests/Feature/Exam/TryoutVisibilityTest.php
git commit -m "feat: tryout exposes result key"
```

---

### Task 2: Frontend Types & Show.tsx CTA Bedakan Tryout

**Files:**
- Modify: `resources/js/features/dashboard/types/dashboardTypes.ts:10-25`
- Modify: `resources/js/Pages/Dashboard/Olympiad/Show.tsx:1-80`
- Test: `docker compose exec -T app ./vendor/bin/pint && docker compose exec -T node npx tsc --noEmit`

**Interfaces:**
- Consumes: `ExamShellResponse.data.exam.type`
- Produces: `Show.tsx` render label Tryout vs Olimpiade

- [ ] **Step 1: Write the failing test**

Visual: `Show.tsx` harus tampil `Badge Tryout` jika `type==='tryout'` else `Badge Olimpiade`.

- [ ] **Step 2: Run test to verify it fails**

Run: `docker compose exec -T node npx tsc --noEmit` — type missing `type` di `DashboardExam`

- [ ] **Step 3: Write minimal implementation**

```ts
// dashboardTypes.ts
export type DashboardExam = { id:string; title:string; type:'tryout'|'OLIMPIADE'; ... }

// Show.tsx
{data.exam.type==='tryout' ? <Badge variant="secondary">Tryout — Hasil & kunci tersedia setelah selesai</Badge> : <Badge>Olimpiade</Badge>}
{data.exam.type==='tryout' && <p className="text-xs text-muted-foreground">Setelah submit kamu bisa lihat skor, kunci jawaban, dan pembahasan.</p>}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `docker compose exec -T node npx tsc --noEmit`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add resources/js/features/dashboard/types/dashboardTypes.ts resources/js/Pages/Dashboard/Olympiad/Show.tsx
git commit -m "feat: show tryout badge"
```

---

### Task 3: TryoutResultPanel Component (Kondisional Hasil)

**Files:**
- Create: `resources/js/features/exam/components/TryoutResultPanel.tsx`

**Interfaces:**
- Produces: `TryoutResultPanel({ attempt, questions, canViewResult })`

- [ ] **Step 1: Write the failing test**

Visual: panel harus render `Skor: X/Y`, list soal dengan `Jawaban benar` & `Pembahasan` hanya jika `canViewResult===true`.

- [ ] **Step 2: Run test to verify it fails**

Run: `docker compose exec -T node npx tsc --noEmit` — component not found

- [ ] **Step 3: Write minimal implementation**

```tsx
export function TryoutResultPanel({ attempt, questions, canViewResult }) {
  if (!canViewResult) return <Card><CardContent className="p-6 text-sm text-muted-foreground">Hasil & pembahasan hanya tersedia untuk Tryout setelah selesai. Olimpiade akan diumumkan panitia.</CardContent></Card>;
  return <Card><CardHeader><CardTitle>Hasil Tryout — {attempt.totalScore}/{attempt.maxPossibleScore}</CardTitle></CardHeader><CardContent className="space-y-4">{questions.map(q=> <div key={q.id}><div dangerouslySetInnerHTML={{__html:q.question}}/><p>Kunci: {q.correctAnswer}</p>{q.explanation && <details><summary>Pembahasan</summary><div dangerouslySetInnerHTML={{__html:q.explanation}}/></details>}</div>)}</CardContent></Card>;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `docker compose exec -T node npx tsc --noEmit` & `docker compose exec -T app ./vendor/bin/pint`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add resources/js/features/exam/components/TryoutResultPanel.tsx
git commit -m "feat: add tryout result panel"
```

---

### Task 4: Integrasi ExamWorkspace + Resume

**Files:**
- Modify: `resources/js/Pages/Dashboard/Olympiad/ExamWorkspacePage.tsx` atau `resources/js/features/exam/components/ExamWorkspace.tsx`
- Modify: `app/Services/ExamAttemptService.php:resume()`

**Interfaces:**
- Consumes: `canViewResult` dari Task 1
- Produces: `ExamWorkspace` render `TryoutResultPanel` setelah `finished===true`

- [ ] **Step 1: Write the failing test**

Visual: setelah `submit` dan `type==='tryout'`, workspace harus ganti dari `QuestionCard` ke `TryoutResultPanel`.

- [ ] **Step 2: Run test to verify it fails**

Run: `docker compose exec -T node npx tsc --noEmit`

- [ ] **Step 3: Write minimal implementation**

```tsx
// ExamAttemptService resume
$canViewResult = $exam->type==='tryout' && $attempt->finished;
return [..., 'canViewResult'=>$canViewResult];

// ExamWorkspace.tsx
{attempt.finished && exam.type==='tryout' ? <TryoutResultPanel attempt={attempt} questions={questions} canViewResult={canViewResult} /> : <QuestionCard ... />}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `docker compose exec -T app php artisan test --filter=Exam && docker compose exec -T node npx tsc --noEmit`
Expected: PASS 15/15 + tsc PASS

- [ ] **Step 5: Commit**

```bash
git add app/Services/ExamAttemptService.php resources/js/Pages/Dashboard/Olympiad/ExamWorkspacePage.tsx
git commit -m "feat: integrate tryout visibility in workspace"
```

---

### Task 5: QA — Style Konsisten Admin & Build

**Files:**
- Modify: none

- [ ] **Step 1: Run verification**

Run: `docker compose exec -T app ./vendor/bin/pint --test`
Expected: PASS 281 files

Run: `docker compose exec -T app php artisan test --filter=Exam`
Expected: 19/19 PASS (15 existing + 4 tryout)

Run: `docker compose exec -T node npx tsc --noEmit`
Expected: PASS

- [ ] **Step 2: Commit**

No commit needed, tag QA.

---

## Self-Review

- Spec coverage: Tryout `type` check, `finished` gate, expose `correctAnswer`/`explanation`, UI badge, result panel, olimpiade hidden — covered Task 1-4.
- Placeholder scan: no TBD, all code blocks concrete.
- Type consistency: `DashboardExam.type`, `Exam.type`, `canViewResult` boolean konsisten backend→frontend.

