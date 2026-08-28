# Spec: Judging API — Simple Score 0-100

**Date:** 2026-08-29 (Split)
**Scope:** API only
**Plan:** `docs/superpowers/plans/2026-08-29-judging-api.md`

---

## 1. Overview

Juri nilai submission per-stage `score 0-100 + feedback + status` simple, langsung final, audit.

## 2. Goals

- G1: `GET /admin/stages/{stage}/submissions?status&search&page` paginated
- G2: `GET /admin/submissions/{id}` detail
- G3: `POST /admin/submissions/{id}/review {action,score,feedback}` → update `score/feedback/reviewed`

## 3. Data Model

Reuse `submissions` columns `score, feedback, reviewed_by/at, status`. No migration.

## 4. API Contract

### GET List
- Auth `judge/super_admin`, Query `status, search, page, per_page max100`
- Order `submitted:0, under_review:1, revision:2`, 200 `{data:[{id,team:{code,name},title,status,score}], meta}`

### GET Detail
- 200 `JudgingSubmissionResource` `{id,title,description,status,score,feedback, team, stage, file}`

### POST Review
- Request `action in [approved,rejected,revision_requested,under_review], score nullable 0-100 (required_if approved), feedback nullable max2000 (required_if rejected/revision_requested)`
- Transitions: `draft/submitted/revision->under_review, submitted/under_review->approved/rejected/revision, approved->revision (super_admin)`
- Effect `status,score,feedback,reviewed_by,reviewed_at`, audit `judging.review` + `X-Request-ID`
- 200 `JudgingSubmissionResource`, 403/422/409

## 5. Service

`JudgingService.review` with `lockForUpdate`, transition check, audit.

## 6. Security

Gate `judge`, lock, audit.

## 7. Testing

`JudgingApiTest` 6: approve, revision without feedback 422, score out of range, list filter, detail, 403 team.

## 8. Non-Goals

No UI, no rubric detail, no multi-juri.
