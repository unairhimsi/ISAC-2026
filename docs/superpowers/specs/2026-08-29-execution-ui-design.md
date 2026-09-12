# Spec: Execution UI — Olympiad Workspace

**Date:** 2026-08-29 (Split)
**Scope:** UI only
**Plan:** `docs/superpowers/plans/2026-08-29-execution-ui.md`

---

## 1. Overview

UI `ExamWorkspace.tsx` timed exam dengan `TimerBadge` isolated, `QuestionNav` + `QuestionCard`, cheat listeners + `sendBeacon`, admin flagged list + `PATCH score`.

## 2. Goals

- G1: `Show.tsx` CTA `Mulai/Lanjutkan/Lihat Hasil` berdasarkan `attemptCount<max && window open` vs `unfinished`.
- G2: `ExamWorkspace` layout `Nav 1/4 + Card 2/4 + Timer 1/4`, `RichText` sanitized.
- G3: `TimerBadge` isolated `setInterval 1s` from `remainingMs` + `serverTime` drift, no global re-render.
- G4: Listeners `visibilitychange→tab_switched, blur→window_blurred, copy/paste/contextmenu, fullscreenchange→fullscreen_exited, key F12`, queue batch `POST /events` via `fetch` + `sendBeacon` fallback, `localStorage` offline sync.
- G5: `PUT answers` debounce 800ms, `POST submit` + `AlertDialog`.
- G6: Admin `Attempts/Index` table `Team | Score | Flagged badge red | Time | Aksi`, `Detail` timeline `ExamEventLog`, `PATCH score` dialog.

## 3. Architecture

```
Show.tsx → useExamShell → CTA
  → ExamWorkspacePage.tsx → ExamWorkspace.tsx
    → TimerBadge ({remainingMs, serverTime})
    → QuestionNav (order, saved status)
    → QuestionCard (RichText, options, essay)
    → useSaveAnswers, useEvents, useSubmit
Admin: Attempts/Index.tsx → useAdminAttempts + useUpdateScore
```

`features/exam/{api, hooks, types, components}` + `Pages/Dashboard/Olympiad`.

## 4. Components

- `examApi.ts` `start, resume, saveAnswers, postEvents, submit, heartbeat`
- `hooks/useExamAttempt.ts` `useStart, useResume, useSaveAnswers (debounce), useEvents (batch), useSubmit`
- `types/examTypes.ts` `AttemptShell, Question, Answer`
- `components/TimerBadge.tsx`, `QuestionCard.tsx`, `QuestionNav.tsx`
- `Pages/Dashboard/Olympiad/ExamWorkspacePage.tsx` (Inertia)

## 5. Flow

`GET shell` → `POST start` → `GET questions` → `Workspace` timer → `PUT answers` debounce → `POST events` batch → `POST submit` → `Admin list flagged` → `PATCH score`.

## 6. Error

`sonner` toast, `DashboardError`, `zod` validation, offline `localStorage`.

## 7. Testing

`examApi.test.ts`, `tsc`, `build`.

## 8. Non-Goals

No API, no auto-penalti, no video.
