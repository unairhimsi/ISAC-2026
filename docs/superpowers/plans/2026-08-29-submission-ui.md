# Submission UI — Direct Collection

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** UI `Dashboard/Submission/Show.tsx` tanpa payment, dengan `FileUpload SUBMISSION`, countdown, status card, glassmorphism.

**Architecture:** `Show.tsx → useSubmissionShell (GET shell) → WindowStatus + SubmissionStatusCard + SubmissionForm (useSubmission hooks: upsert/submit) → FileUpload (IKContext)`. Reuse `DashboardBackdrop, Card, Badge, Button`.

**Tech Stack:** React 19 TS Inertia TanStack Query zod, Tailwind 4, ImageKit, Vite.

## Global Constraints

- No payment UI, `canSubmit = isOpen` only.
- `FileUpload purpose=SUBMISSION folder=/submissions/{stageId} max20mb`, `accept pdf/png/jpg`.
- `remainingMs` live tick isolated, not global re-render.

---

## File Structure

- Create: `resources/js/features/submissions/api/submissionApi.ts`
- Create: `resources/js/features/submissions/hooks/useSubmission.ts`
- Create: `resources/js/features/submissions/types/submissionTypes.ts`
- Create: `resources/js/features/submissions/schemas/submissionSchema.ts`
- Create: `resources/js/features/submissions/components/SubmissionForm.tsx`, `WindowCountdown.tsx`
- Modify: `resources/js/Pages/Dashboard/Submission/Show.tsx` — wire to hooks

---

### Task 1: API Client + Hooks + Types

**Files:**
- Create: `api/submissionApi.ts`, `hooks/useSubmission.ts`, `types/submissionTypes.ts`, `schemas/submissionSchema.ts`
- Test: `submissionApi.test.ts`

**Interfaces:**
- Produces: `submissionApi.get/upsert/submit/unsubmit`, `useSubmission(stageId): {query, upsertMutation, submitMutation}`, `submissionSchema zod`

- [ ] **Step 1: Write failing test**

```ts
test('upsert calls POST', async()=>{ mock fetch, await submissionApi.upsert('uuid',{title:'T'}); expect(fetch).toHaveBeenCalledWith('/api/dashboard/stages/uuid/submission', expect.objectContaining({body: JSON.stringify({title:'T'})})) })
```

- [ ] **Step 2: Run → FAIL**
- [ ] **Step 3: Implement**

```ts
// submissionApi.ts
export const submissionApi = { get:(id)=> getJson(`/api/dashboard/stages/${id}/submission`), upsert:(id,p)=> postJson(`/api/dashboard/stages/${id}/submission`, p), submit:(id,k)=> postJson(`/api/dashboard/stages/${id}/submission/submit`, {}, {headers:{'Idempotency-Key':k}})}
// useSubmission.ts
export function useSubmission(id){ const q=useQuery({queryKey:['submission',id], queryFn:()=>submissionApi.get(id)}); const m=useMutation({mutationFn:(p)=>submissionApi.upsert(id,p), onSuccess:()=>qc.invalidateQueries({queryKey:['submission',id]})}); return {query:q, upsert:m} }
// zod
export const submissionSchema = z.object({title:z.string().min(3).max(180), description:z.string().max(5000).optional(), file_id:z.string().uuid().optional()})
```

- [ ] **Step 4: Run → PASS** `tsc`, `build`
- [ ] **Step 5: Commit**

---

### Task 2: Show.tsx Rewrite (Direct Collection)

**Files:**
- Modify: `resources/js/Pages/Dashboard/Submission/Show.tsx`
- Create: `components/SubmissionForm.tsx`, `WindowCountdown.tsx`
- Test: `tsc --noEmit`

**Interfaces:**
- Consumes: `useSubmissionShell`, `useSubmission`

- [ ] **Step 1: Write failing test (visual)** — manual: GET shell → WindowStatus → Form disabled if !canSubmit

- [ ] **Step 2: Run → FAIL** — old payment still renders

- [ ] **Step 3: Implement**

```tsx
// WindowStatus helper
function WindowStatus({isOpen,isOverdue,remainingMs}){ if(isOverdue) return {label:'Berakhir',Icon:CircleAlert}; if(!isOpen) return {label:'Akan Datang',Icon:Hourglass}; return {label:'Dibuka',Icon:UploadCloud} }
// Show.tsx: header stage + competition badge + period + Sisa {formatRemaining(remainingMs)} live tick setInterval 60s isolated
// Card Window: border-accent if isOpen, banner Tidak ada pembayaran
// SubmissionStatusCard if submission: title, score, feedback, file link
// Form if canSubmit: Input title, Textarea description, FileUpload purpose=SUBMISSION folder=/submissions/{stageId} accept pdf/png, Simpan Draft (upsert), Kumpulkan (submit+AlertDialog)
```

- [ ] **Step 4: Run → PASS** `tsc`, `build`, manual smoke
- [ ] **Step 5: Commit**

---

### Task 3: QA

**Files:** `docs/API/README.md` not needed (UI only)

- [ ] **Step 1: Run** `npm run build` 3485 modules, `tsc`
- [ ] **Step 2: Commit**

---

## Self-Review

- No payment, window isolated, FileUpload SUBMISSION ✓
