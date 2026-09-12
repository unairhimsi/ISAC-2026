# Spec: Submission API — Direct Collection (All UPFRONT)

**Date:** 2026-08-29 (Split from `submission-direct-collection-design.md`)
**Scope:** API only (tidak ada UI)
**Plan:** `docs/superpowers/plans/2026-08-29-submission-api.md`
**Related Code:** `Submission`, `Stage`, `File SUBMISSION`, `DashboardService`, `SubmissionService`

---

## 1. Overview

API submission per-stage untuk `BUSINESS_PLAN/BUSINESS_IT_CASE`. Semua lomba `PAYMENT_UPFRONT`, jadi tidak ada `payment_for_stage_id`. Window `Stage.start→end`, unique `team+stage`, file ImageKit.

## 2. Goals (API)

- G1: `GET /dashboard/stages/{stage}/submission` → `window, submission, canSubmit`
- G2: `POST /dashboard/stages/{stage}/submission` upsert draft
- G3: `POST .../submit` finalize idempotent
- G4: `POST .../unsubmit` tarik

## 3. Data Model

`submissions` existing (HasUuids, SoftDeletes, unique team+stage, FK file, status enum, score/feedback/reviewed). No migration.

## 4. API Contract

### GET Shell
- Auth `team.verified`, `current_stage_id==stage.id`, `competition match`, `type BUSINESS_*`
- 200 `{stage,competition,batch,window{isOpen,isOverdue,remainingMs,startDate,endDate},submission{...file}|null,canSubmit}`
- 403/401
- Window: `isOpen = start<=now<=end`, `remainingMs = end-now` if isOpen

### POST Upsert Draft
- Request `title 3-180, description max5000, file_id nullable uuid exists + owned SUBMISSION`
- 422 window closed / foreign file / status not draft
- 200 `SubmissionResource`

### POST Submit
- Header `Idempotency-Key` optional
- Checks `window.isOpen`, `file_id != null`, `status draft/revision_requested/rejected`
- Effect `status=submitted, submitted_at=now`
- 200 idempotent

### POST Unsubmit
- Checks `status==submitted && window.isOpen && reviewed_at==null`
- Effect `status=draft`

Envelope `snake→camel`, 429 throttle.

## 5. Service

`SubmissionService` with `DB::transaction + lockForUpdate`, `assertWindowOpen`, `assertOwnedFile`, `assertCanAccess`. No audit needed (Team).

## 6. Security

`team.verified`, `stage.competition check`, `file.owned`, `window server time`, `Idempotency-Key`.

## 7. Testing

`SubmissionShellDirectCollectionTest` (3) + `SubmissionApiTest` (6: upsert, window closed, foreign file, submit requires file, idempotent, unsubmit).

## 8. Non-Goals

No UI, no rubric, no version table.
