# Judging UI — Simple

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** UI `Admin/Judging.tsx` table + `JudgingDialog` for Simple scoring.

**Architecture:** `Judging.tsx → useJudgingList → table + filters → JudgingDialog → useReviewSubmission → POST review → invalidate`.

**Tech Stack:** React 19 TS TanStack Query, Tailwind, Vite.

## Global Constraints

- No rubric detail, Simple only.
- `score 0-100` Input number, `feedback` Textarea, `action` Select.
- `X-Request-ID` auto via `adminApi.requestHeaders()`.

---

## File Structure

- Create: `resources/js/features/judging/api/judgingApi.ts`
- Create: `resources/js/features/judging/hooks/useJudging.ts`
- Create: `resources/js/features/judging/types/judgingTypes.ts`
- Create: `resources/js/features/judging/components/JudgingDialog.tsx`
- Modify: `resources/js/Pages/Admin/Judging.tsx`

---

### Task 1: API Client + Hooks + Types

**Files:**
- Create: `api/judgingApi.ts`, `hooks/useJudging.ts`, `types/judgingTypes.ts`
- Test: `judgingApi.test.ts`

**Interfaces:**
- Produces: `judgingApi.list(stageId,params), get(id), review(id,payload)`, `useJudgingList, useReviewSubmission`

- [ ] **Step 1: Write failing test** — mock fetch
- [ ] **Step 2: Run → FAIL**
- [ ] **Step 3: Implement** (see combined)
- [ ] **Step 4: Run → PASS** `tsc`, `build`
- [ ] **Step 5: Commit**

---

### Task 2: JudgingDialog + Page

**Files:**
- Create: `components/JudgingDialog.tsx`
- Modify: `Pages/Admin/Judging.tsx`
- Test: `tsc`

**Interfaces:**
- Consumes: `useReviewSubmission`

- [ ] **Step 1: Write failing test** — visual

- [ ] **Step 2: Run → FAIL**

- [ ] **Step 3: Implement**

```tsx
// JudgingDialog
<Dialog> <Select action> <Input score 0-100> <Textarea feedback> <a href={submission.file.url}>Preview</a> <Button onClick={()=>review({action,score,feedback})}>Simpan</Button> </Dialog>
// Judging.tsx table Team | Judul | Status badge | Score | Aksi Nilai → open Dialog
```

- [ ] **Step 4: Run → PASS**
- [ ] **Step 5: Commit**

---

### Task 3: QA

**Files:** not needed

- [ ] **Step 1: Run** `npm run build`, `tsc`
- [ ] **Step 2: Commit**

---

## Self-Review

- Simple UI, no rubric ✓
