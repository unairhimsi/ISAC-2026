# Spec: Submission UI — Direct Collection

**Date:** 2026-08-29 (Split)
**Scope:** UI only
**Plan:** `docs/superpowers/plans/2026-08-29-submission-ui.md`
**Related:** `Dashboard/Submission/Show.tsx`, `features/submissions`

---

## 1. Overview

UI `Dashboard/Submission/Show.tsx` tanpa payment, dengan `FileUpload SUBMISSION`, countdown, status card, glassmorphism.

## 2. Goals

- G1: Header `stage.name + competition badge + period + Sisa {remainingDisplay}` live tick `setInterval 60s` isolated.
- G2: `WindowStatus` card: Upcoming (`Hourglass`), Open (`UploadCloud` + banner `Tidak ada pembayaran`), Overdue (`CircleAlert`).
- G3: `SubmissionStatusCard` if exists: `title, score, feedback, file link`, badge `draft/submitted/approved` variant.
- G4: `SubmissionForm` if `canSubmit`: `Input title, Textarea description, FileUpload purpose=SUBMISSION folder=/submissions/{stageId} max20mb`, `Simpan Draft` (POST upsert), `Kumpulkan` (POST submit + AlertDialog), `Unsubmit` if submitted.

## 3. Architecture

```
Show.tsx
  → useSubmissionShell (GET shell)
  → WindowStatus (isOpen/isOverdue)
  → SubmissionStatusCard (if submission)
  → SubmissionForm (useSubmission hooks: upsertMutation, submitMutation)
    → FileUpload (IKContext + registerFile)
```

Reuse `DashboardBackdrop, error-portal-card, Card, Badge, Button, FileUpload`, Tailwind.

## 4. Components

- `features/submissions/api/submissionApi.ts` — `get, upsert, submit, unsubmit` via `getJson/postJson`
- `hooks/useSubmission.ts` — `useQuery(['submission',stageId]) + useMutation upsert/submit` with `invalidateQueries`
- `types/submissionTypes.ts` — `SubmissionData, SubmissionWindow`
- `schemas/submissionSchema.ts` — zod `title min3 max180, description max5000, file_id uuid`
- `components/SubmissionForm.tsx`, `WindowCountdown.tsx` (isolated)

## 5. Flow

`GET shell` → `WindowStatus` → `SubmissionStatusCard` → `SubmissionForm` (prefilled from `submission` via `useEffect`) → `FileUpload` → `Simpan Draft` → `Kumpulkan` → `Status submitted`.

## 6. States

- `Upcoming`: `!isOpen && now<start` → `Hourglass`
- `Open`: `isOpen` → `UploadCloud` + `Sisa`
- `Overdue`: `isOverdue` → `CircleAlert`
- Form disabled if `!canSubmit`.

## 7. Error Handling

- `DashboardLoading` if `isLoading`, `DashboardError` if `error`, `retry` via `query.refetch()`, `sonner` toast on mutation error, `zod` validation inline.

## 8. Testing

- `submissionApi.test.ts` mock fetch, `useSubmission.test.tsx`, `tsc --noEmit`, `npm run build`.

## 9. Non-Goals

No API, no rubric, no admin.
