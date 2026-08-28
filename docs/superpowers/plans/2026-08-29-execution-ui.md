# Execution UI — Olympiad Workspace

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** UI `ExamWorkspace.tsx` timed exam `TimerBadge` isolated, `QuestionNav+Card`, cheat listeners + `sendBeacon`, admin flagged list + `PATCH score`.

**Architecture:** `Show.tsx CTA → ExamWorkspacePage → ExamWorkspace (TimerBadge + QuestionNav + QuestionCard + hooks)`. Admin `Attempts/Index` table.

**Tech Stack:** React 19 TS TanStack Query, Tailwind, Vite.

## Global Constraints

- `remainingMs` from `serverTime` drift, not client `Date.now()`.
- `TimerBadge` isolated, no global re-render.
- Listeners `visibilitychange→tab, blur→window, copy/paste/contextmenu, fullscreenchange, F12`, queue batch `POST /events` via `fetch` + `sendBeacon` fallback.

---

## File Structure

- Create: `resources/js/features/exam/api/examApi.ts`
- Create: `resources/js/features/exam/hooks/useExamAttempt.ts`
- Create: `resources/js/features/exam/types/examTypes.ts`
- Create: `resources/js/features/exam/components/TimerBadge.tsx`, `QuestionCard.tsx`, `QuestionNav.tsx`, `ExamWorkspace.tsx`
- Modify: `resources/js/Pages/Dashboard/Olympiad/Show.tsx` — CTA `Mulai/Lanjutkan`
- Create: `resources/js/Pages/Dashboard/Olympiad/ExamWorkspacePage.tsx`
- Modify: `routes/web.php` — add `Route::get('/dashboard/olimpiade/{exam}/workspace')`

---

### Task 1: API Client + Hooks + Types

**Files:**
- Create: `api/examApi.ts`, `hooks/useExamAttempt.ts`, `types/examTypes.ts`
- Test: `examApi.test.ts`

**Interfaces:**
- Produces: `examApi.start, resume, saveAnswers, postEvents, submit, heartbeat`, `useStart, useResume, useSaveAnswers (debounce 800ms), useEvents (batch), useSubmit`

- [ ] **Step 1: Write failing test** — mock fetch

- [ ] **Step 2: Run → FAIL**
- [ ] **Step 3: Implement** (see combined C1 Task6)
- [ ] **Step 4: Run → PASS** `tsc`, `build`
- [ ] **Step 5: Commit**

---

### Task 2: Show.tsx CTA + Workspace Page

**Files:**
- Modify: `Show.tsx` — add `Mulai Ujian` CTA, `Lanjutkan` if unfinished
- Create: `ExamWorkspacePage.tsx`
- Modify: `web.php` — add route
- Test: `tsc`

**Interfaces:**
- Consumes: `useExamShell`

- [ ] **Step 1: Write failing test** — visual

- [ ] **Step 2: Run → FAIL**

- [ ] **Step 3: Implement**

```tsx
// Show.tsx CTA
{examStatus==='AVAILABLE' && attemptCount<maxAttempts && <Link href={`/dashboard/olimpiade/${examId}/workspace`} className={buttonVariants()}>Mulai Ujian</Link>}
// ExamWorkspacePage.tsx <ExamWorkspace examId={examId} />
// web.php Route::get('/dashboard/olimpiade/{exam}/workspace', fn($exam)=> Inertia::render('Dashboard/Olympiad/ExamWorkspacePage', ['examId'=>$exam]))
```

- [ ] **Step 4: Run → PASS**
- [ ] **Step 5: Commit**

---

### Task 3: TimerBadge Isolated

**Files:**
- Create: `components/TimerBadge.tsx`
- Test: manual

**Interfaces:**
- Produces: `TimerBadge({remainingMs, serverTime})`

- [ ] **Step 1: Write failing test** — `remainingMs 3600000 → 60:00`

- [ ] **Step 2: Run → FAIL**
- [ ] **Step 3: Implement**

```tsx
export function TimerBadge({remainingMs, serverTime}){ const [ms, setMs]=useState(remainingMs - (Date.now() - new Date(serverTime).getTime())); useEffect(()=>{ const id=setInterval(()=> setMs(m=> m-1000),1000); return()=>clearInterval(id)},[]); return <Badge>{formatMs(ms)}</Badge> }
```

- [ ] **Step 4: Run → PASS**
- [ ] **Step 5: Commit**

---

### Task 4: QuestionNav + QuestionCard + Listeners

**Files:**
- Create: `components/QuestionNav.tsx`, `QuestionCard.tsx`, `ExamWorkspace.tsx`
- Test: manual

**Interfaces:**
- Consumes: `useSaveAnswers, useEvents`

- [ ] **Step 1: Write failing test** — visual

- [ ] **Step 2: Run → FAIL**

- [ ] **Step 3: Implement**

```tsx
// ExamWorkspace
const [answers, setAnswers]=useState({}); const qEnterAt=useRef(Date.now());
useEffect(()=>{ const h=(e)=> queueEvent('tab_switched'); document.addEventListener('visibilitychange',h); return()=>remove...},[]);
useEffect(()=>{ const id=setInterval(()=> flushEvents(), 5000); return()=>clearInterval(id)},[]);
// QuestionCard <RichText content={question.question} /> + Radio/Checkbox + Textarea essay
// QuestionNav map questions → button variant saved/current
```

- [ ] **Step 4: Run → PASS**
- [ ] **Step 5: Commit**

---

### Task 5: Admin Flagged List + PATCH Score UI

**Files:**
- Create: `resources/js/Pages/Admin/Exams/Attempts/Index.tsx`, `Detail.tsx`
- Create: `features/exam/components/ScoreUpdateDialog.tsx`
- Test: `tsc`

**Interfaces:**
- Consumes: `useAdminAttempts`

- [ ] **Step 1: Write failing test**

- [ ] **Step 2: Run → FAIL**

- [ ] **Step 3: Implement**

```tsx
// Index.tsx table Team | Score | Flagged badge red | Time | Aksi → Detail
// Detail timeline ExamEventLog, PATCH dialog total_score Input + reason Textarea
```

- [ ] **Step 4: Run → PASS**
- [ ] **Step 5: Commit**

---

### Task 6: QA

**Files:** not needed

- [ ] **Step 1: Run** `npm run build`, `tsc`
- [ ] **Step 2: Commit**

---

## Self-Review

- Timer isolated, listeners batch, sendBeacon, no migration ✓
