# Spec: Judging UI — Simple

**Date:** 2026-08-29 (Split)
**Scope:** UI only
**Plan:** `docs/superpowers/plans/2026-08-29-judging-ui.md`

---

## 1. Overview

UI `Admin/Judging.tsx` table + `JudgingDialog` for Simple scoring.

## 2. Goals

- G1: Table `Team | Judul | Status badge | Score | SubmittedAt | Aksi Nilai`, filters `Select status, Input search`.
- G2: `JudgingDialog` `Select action, Input number 0-100, Textarea feedback, file preview link`, `X-Request-ID` auto.
- G3: Badge `approved green, rejected red, revision amber, submitted blue`.

## 3. Architecture

```
Judging.tsx
  → useJudgingList (GET list) → table
  → JudgingDialog (useReviewSubmission) → POST review → invalidateQueries
```

`features/judging/{api, hooks, types, components}` + `Admin/Judging.tsx`.

## 4. Components

- `judgingApi.ts` `list, get, review`
- `hooks/useJudging.ts` `useJudgingList, useReviewSubmission`
- `types/judgingTypes.ts` `JudgingSubmission`
- `components/JudgingDialog.tsx`

## 5. Flow

`GET list` → table → click `Nilai` → `Dialog` prefilled → `Select approved` + `score 85` + `feedback` → `POST review` → toast + invalidate → table refresh → team sees `feedback/score` di `Submission/Show` card.

## 6. Error

`sonner` toast, zod validation, `DashboardError` for list.

## 7. Testing

`judgingApi.test.ts`, `tsc`, `build`.

## 8. Non-Goals

No API, no rubric detail.
