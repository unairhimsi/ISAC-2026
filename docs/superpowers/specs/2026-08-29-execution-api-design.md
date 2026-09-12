# Spec: Execution API — Olympiad Timed + Cheat Alert-Only

**Date:** 2026-08-29 (Split)
**Scope:** API only
**Plan:** `docs/superpowers/plans/2026-08-29-execution-api.md`

---

## 1. Overview

Team OLIMPIADE timed exam `duration/max_attempts/shuffle`, server authority `end_time`, cheat events alert-only, admin mutable `total_score`.

## 2. Goals

- G1: `POST /dashboard/exams/{exam}/attempts` start (window, stage, max_attempts, shuffle once)
- G2: `GET resume` + `PUT answers` batch (is_correct, score_obtained)
- G3: `POST events` batch 50 → `suspicious_score` + `flagged` alert-only (weights)
- G4: `POST submit` manual + cron auto `end_time<now`
- G5: Admin `GET list?flagged`, `GET detail timeline`, `PATCH score` mutable

## 3. Data Model

Reuse `exam_attempts` (flagged, cheat_count, suspicious_score, device_id, ip, user_agent, metadata, start/end, finished, total_score), `exam_event_logs` (20 types, index), `exam_answers` (time_spent, is_correct, score_obtained), `exams` (duration, shuffle, show_result_immediately).

## 4. API Contract

**Team 7:**

1) `GET /dashboard/exams/{exam}` + `attempt summary, serverTime`
2) `POST /attempts` → 201 `{attempt, questions without correct_answer, serverTime}`, 403/422/409, `end_time=min(now+duration, exam.end_date)`, `max_possible_score=sum correct_score`, `metadata.questionOrder`, event `started`
3) `GET /attempts/{id}` resume + `savedAnswers`
4) `PUT /attempts/{id}/answers` `{answers:[{question_id, selected_options, answer, time_spent}]} max50`, upsert, `is_correct/score_obtained` via `correct/wrong/empty_score`, event `question_answered`, 200 `{saved}`
5) `POST /attempts/{id}/events` `{events:[{type, metadata, clientAt}]} max50`, weights `tab5/window5/fullscreen8/copy10/paste15/right3/devtools25/screenshot12`, `flagged>=50 OR cheat>=5 OR device drift +20`, 200 `{suspiciousScore, flagged}`
6) `POST /attempts/{id}/submit` → `finished, total_score=sum, event submitted`, 200 `{attempt, showResult}`
7) `POST /attempts/{id}/heartbeat` `{clientTime}` → `metadata.heartbeatAt`

**Admin 3:**

8) `GET /admin/exams/{exam}/attempts?flagged&search&page` paginated `ExamAttemptResource` with team
9) `GET /admin/.../{attempt}` detail + `answers + timeline + correct_answer`
10) `PATCH /admin/.../{attempt}/score` `{total_score 0-max, reason 1-2000}` → `reviewed_by`, audit `exam.score_updated`

## 5. Service

`ExamAttemptService` (start/resume/submit/heartbeat), `ExamScoringService` (is_correct), `ExamDetectionService` (accumulate, flagged), `AutoSubmitExpiredAttempts` cron `everyMinute`.

## 6. Security

`current_stage_id==exam.stage_id`, `team.verified`, `attempt ownership`, `lockForUpdate max_attempts`, `serverTime` authority, `shuffle` hide correct_answer, `Gate judge`.

## 7. Testing

`ExamAttemptTest` 8 (start window, max, resume, save correct, essay null, submit total, auto cron), `ExamDetectionTest` 4 (tab, devtools flagged, device drift, paste), `ExamScoreUpdateTest` 3 (admin update, beyond max, list flagged).

## 8. Non-Goals

No auto-penalti, no hard block, no video proctor.
