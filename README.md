# ISAC-2026

**Indonesia Science Advancement Competition 2026** — Platform pendaftaran kompetisi sains & bisnis untuk siswa/mahasiswa Indonesia.

Laravel 13 + React/Inertia + TanStack Query + Vite + MySQL + Nginx + Docker Compose Watch.

---

## Table of Contents

- [Overview](#overview)
- [End-to-End Business Flow](#end-to-end-business-flow)
- [Stage 1: Authentication](#stage-1-authentication)
- [Stage 2: Competition Selection](#stage-2-competition-selection)
- [Stage 3: Team Data](#stage-3-team-data)
- [Stage 4: Member Biodata](#stage-4-member-biodata)
- [Stage 5: Document Upload](#stage-5-document-upload)
- [Stage 6: Payment](#stage-6-payment)
- [Stage 7: Admin Verification](#stage-7-admin-verification)
- [Stage 8: Dashboard & Post-Registration](#stage-8-dashboard--post-registration)
- [Status Machine Reference](#status-machine-reference)
- [Promo & Discount System](#promo--discount-system)
- [Admin Roles & Permissions](#admin-roles--permissions)
- [API Endpoints Reference](#api-endpoints-reference)
- [Tech Stack](#tech-stack)
- [Development Setup](#development-setup)

---

## Overview

ISAC-2026 is a competition registration platform that supports three competition types with different payment flows:

| Competition Type | Label | Payment Flow | Description |
|---|---|---|---|
| `OLIMPIADE` | Olimpiade Sains | **UPFRONT** | Bayar saat pendaftaran |
| `BUSINESS_PLAN` | Business Plan | **SEMIFINAL** | Bayar saat masuk semifinal |
| `BUSINESS_IT_CASE` | Business IT Case | **SEMIFINAL** | Bayar saat masuk semifinal |

Each competition has multiple **batches** (Early Bird, Reguler, Late) with different prices and quotas. A team can only register when a batch is `OPEN`.

---

## End-to-End Business Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                        USER REGISTRATION FLOW                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────┐    ┌──────────────┐    ┌──────────────────────────┐  │
│  │ Register │───▶│ Email Verify │───▶│ Select Competition       │  │
│  │ (email + │    │ (code sent   │    │ (OLIMPIADE / BUSINESS_   │  │
│  │ password)│    │  to email)   │    │  PLAN / BUSINESS_IT_CASE)│  │
│  └──────────┘    └──────────────┘    └──────────┬───────────────┘  │
│                                                  │                  │
│                                                  ▼                  │
│                                    ┌──────────────────────────┐    │
│                                    │ Team Data                │    │
│                                    │ (name, email, phone,     │    │
│                                    │  institution, address)   │    │
│                                    └──────────┬───────────────┘    │
│                                                  │                  │
│                                                  ▼                  │
│                                    ┌──────────────────────────┐    │
│                                    │ Member Biodata           │    │
│                                    │ (leader + members,       │    │
│                                    │  NISN/NIM, major, etc)  │    │
│                                    └──────────┬───────────────┘    │
│                                                  │                  │
│                                                  ▼                  │
│                                    ┌──────────────────────────┐    │
│                                    │ Documents                │    │
│                                    │ (Google Drive folder     │    │
│                                    │  links + twibbon)        │    │
│                                    └──────────┬───────────────┘    │
│                                                  │                  │
│                                    ┌─────────────┴─────────────┐   │
│                                    │                           │   │
│                                    ▼                           ▼   │
│                       ┌────────────────────┐  ┌─────────────────┐ │
│                       │ UPFRONT Payment    │  │ SEMIFINAL       │ │
│                       │ (OLIMPIADE)        │  │ (no payment     │ │
│                       │ Pay now + upload   │  │  yet — goes to  │ │
│                       │ proof              │  │  dashboard)     │ │
│                       └────────┬───────────┘  └────────┬────────┘ │
│                                │                       │           │
│                                ▼                       ▼           │
│                       ┌──────────────────────────────────────┐    │
│                       │      WAITING_VERIFICATION            │    │
│                       │      (admin reviews team data)       │    │
│                       └──────────────┬───────────────────────┘    │
│                                      │                            │
│                          ┌───────────┼───────────┐                │
│                          ▼           ▼           ▼                │
│                    ┌──────────┐ ┌──────────┐ ┌──────────┐        │
│                    │ VERIFIED │ │ REVISION │ │ REJECTED │        │
│                    │          │ │ REQUIRED │ │          │        │
│                    └──────────┘ └────┬─────┘ └──────────┘        │
│                                      │                            │
│                                      ▼                            │
│                            (user fixes & resubmits)               │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Stage 1: Authentication

### Registration
- User registers with **email + password**
- Email verification required before any registration action
- Redirected to `/auth/verify-email` until verified

### Login
- Email + password authentication via Laravel Sanctum
- Two principal types: `TEAM` (regular user) and `ADMIN` (admin user)
- Token stored in localStorage via `useAuthSession` hook

### Password Reset
- Forgot password flow with verification code sent to email
- Two-step: verify code → set new password

---

## Stage 2: Competition Selection

After email verification, user selects one competition:

**Page:** `/registration` → `Registration/Index.tsx`

- Lists all **open** competitions with available batches
- Each competition shows: name, type, batch (Early Bird / Reguler / Late), price, quota
- User picks one competition — this creates a `Registration` record
- `team_selection_completed_at` is set immediately

**Backend:** `RegistrationService::selectCompetition()`
- Validates competition is `REGISTRATION_OPEN`
- Validates batch is `OPEN` and has quota
- Auto-creates batch if it doesn't exist yet (first-come-first-served)
- Locks batch row to prevent race conditions (`lockForUpdate`)
- Creates `Registration` with `WAITING_PAYMENT` status

---

## Stage 3: Team Data

**Page:** `/registration/team` → `Registration/Team.tsx`

User fills in:
| Field | Required | Notes |
|---|---|---|
| Team Name | Yes | Unique per competition |
| Email | Yes | Team contact email |
| Phone | Yes | Team contact phone |
| Institution Name | Yes | School/university name |
| Institution Address | Yes | Street, city, province, postal code, country |

**Backend:** `RegistrationService::updateTeamData()`
- If team is `INCOMPLETE` → auto-upgrades to `WAITING_VERIFICATION`
- Sets `team_completed_at` timestamp
- Stores `revision_step` = `"TEAM"` if revising

---

## Stage 4: Member Biodata

**Page:** `/registration/biodata` → `Registration/Biodata.tsx`

Each team member fills in:

| Field | Leader | Members |
|---|---|---|
| Full Name | Yes | Yes |
| Email | Yes | Yes |
| NISN / NIM | Yes | Yes |
| Gender | Yes | Yes |
| Birth Place & Date | Yes | Yes |
| Phone | Yes | Yes |
| Address | Yes | Yes |
| Religion | Yes | Yes |
| Institution Name | Yes | Yes |
| Major / Program Studi | Yes | Yes |
| Faculty | No | Optional |
| Instagram | No | Optional |
| T-shirt Size | Yes | Yes |
| Emergency Contact Name | Yes | Yes |
| Emergency Contact Phone | Yes | Yes |
| Emergency Contact Relation | Yes | Yes |

**Validation Rules:**
- **OLIMPIADE**: Exactly 1 leader + 2 members (3 total)
- **BUSINESS_PLAN / BUSINESS_IT_CASE**: Exactly 1 leader + 1–2 members (2–3 total)
- Email must be unique across all members and the team
- NISN/NIM must be unique per institution

**Backend:** `RegistrationService::finalizeMembers()`
- Validates member count by competition type
- Creates `Member` records with roles (`LEADER` / `MEMBER`)
- Sets `members_completed_at`

---

## Stage 5: Document Upload

**Page:** `/registration/documents` → `Registration/Documents.tsx`

User provides:

| Field | Description |
|---|---|
| Document Folder URL | Google Drive link containing required documents |
| Twibbon Folder URL | Google Drive link with twibbon screenshot |

**Backend:** `RegistrationService::updateDocuments()`
- Stores both URLs
- Sets `documents_completed_at`

---

## Stage 6: Payment

### UPFRONT Payment (OLIMPIADE)

**Page:** `/registration/payment` → `Registration/Payment.tsx`

1. User selects payment method: `BANK_TRANSFER` or `QRIS`
2. Optional: enter promo code → `POST /registrations/me/payment/quote` → see discounted price
3. User uploads proof of payment (image) → uploaded to ImageKit
4. `POST /registrations/me/payment` → submission complete

**Backend:** `RegistrationService::submitPayment()`
- Validates promo code (config-based, single code from env)
- Calculates discount
- Sets `payment_submitted_at`, `status` → `WAITING_VERIFICATION`
- Sets `submitted_at` (final submission timestamp)

### SEMIFINAL Payment (BUSINESS_PLAN / BUSINESS_IT_CASE)

- **No payment during registration** — registration completes without payment
- `status` stays at `WAITING_VERIFICATION` after team submission
- Payment is triggered later when the team advances to the **Semifinal stage**
- Admin advances team to semifinal stage → `payment_for_stage_id` is set → user sees payment page
- Same payment flow as UPFRONT from that point

### Promo Code System

Config-based single promo code via environment variables:

```env
PROMO_CODE=ISAXOP
PROMO_DISCOUNT_PERCENT=15
PROMO_DISCOUNT_AMOUNT=0
```

- Applied at quote time (preview) and submission time (locked in)
- Stored on `Registration` record: `promo_code`, `discount_percent`, `discount_amount`
- Cannot be changed after payment is submitted

---

## Stage 7: Admin Verification

### Team Verification

**Admin Page:** `/admin/teams/{teamId}` → `Admin/Teams/Show.tsx`

Admin (role: `super_admin` or `admin_registration`) can:

| Action | Effect |
|---|---|
| **Verifikasi Tim** | Team → `VERIFIED` |
| **Minta Revisi** | Team → `REVISION_REQUIRED` + `revision_step` set to specific step |
| **Tolak Tim** | Team → `REJECTED` |

**Revision flow:**
- Admin specifies which step needs revision (`TEAM`, `MEMBERS`, `DOCUMENTS`)
- User is redirected to that specific step
- User fixes and resubmits
- Status goes back to `WAITING_VERIFICATION`

### Payment Verification

**Admin Page:** `/admin/payments/{registrationId}` → `Admin/Payments/Show.tsx`

Admin (role: `super_admin` or `admin_payment`) can:

| Action | Effect |
|---|---|
| **Verifikasi Pembayaran** | Registration → `VERIFIED` |
| **Minta Revisi** | Registration → `REVISION_REQUIRED` |
| **Tolak Pembayaran** | Registration → `REJECTED` |

Admin sees:
- Team identity (name, email, phone, institution)
- Competition & batch info
- Payment breakdown (original amount, promo code, discount, final amount)
- Proof of payment image (preview + link to original)
- Timeline (required → submitted → reviewed → paid)

### Stage Advancement (Semifinal)

For SEMIFINAL competitions, admin can advance a team to the next stage:

```
POST /admin/teams/{teamId}/stages/{stageId}/advance
```

This triggers payment requirement for that stage.

---

## Stage 8: Dashboard & Post-Registration

**Page:** `/dashboard` → `Dashboard/Index.tsx`

After verification, user sees:
- Team profile
- Competition & batch info
- Registration status
- Current stage (for competition progression)
- Exams and submissions (when available)

### Dashboard API

```
GET /api/dashboard/summary
```

Returns team info, registration, stages, and available exams.

---

## Status Machine Reference

### Team Status

```
INCOMPLETE ──────▶ WAITING_VERIFICATION ──────▶ VERIFIED
                         │    ▲                     │
                         │    │                     │
                         ▼    │                     │
                   REVISION_REQUIRED ──────────────┘
                         │         (resubmit)
                         │
                         ▼
                      REJECTED
```

| Status | Meaning |
|---|---|
| `INCOMPLETE` | Team data not yet submitted |
| `WAITING_VERIFICATION` | Submitted, awaiting admin review |
| `VERIFIED` | Approved by admin |
| `REVISION_REQUIRED` | Admin requested changes |
| `REJECTED` | Admin rejected the team |

### Registration Status

```
WAITING_PAYMENT ──────▶ WAITING_VERIFICATION ──────▶ VERIFIED
                              │    ▲                      │
                              │    │                      │
                              ▼    │                      │
                        REVISION_REQUIRED ───────────────┘
                              │         (resubmit)        │
                              │                           │
                              ▼                           │
                           REJECTED                       │
                              │                           │
                              ▼                           │
                           CANCELLED ◀────────────────────┘
```

| Status | Meaning |
|---|---|
| `WAITING_PAYMENT` | Awaiting payment (UPFRONT) or initial state |
| `WAITING_VERIFICATION` | Payment submitted or team submitted (SEMIFINAL) |
| `VERIFIED` | Payment approved |
| `REVISION_REQUIRED` | Admin requested payment revision |
| `REJECTED` | Payment rejected |
| `CANCELLED` | Registration cancelled |

---

## Promo & Discount System

- **Single promo code** stored in `.env` config
- Default code: `ISAXOP`, 15% discount
- Config in `config/registration.php`:
  ```php
  'promo_code' => env('PROMO_CODE', 'ISAXOP'),
  'promo_discount_percent' => (int) env('PROMO_DISCOUNT_PERCENT', 15),
  'promo_discount_amount' => (int) env('PROMO_DISCOUNT_AMOUNT', 0),
  ```
- User enters promo code on payment page
- `POST /registrations/me/payment/quote` → returns discounted price breakdown
- Discount is locked in when payment is submitted
- Stored on `Registration`: `promo_code`, `discount_percent`, `discount_amount`

---

## Admin Roles & Permissions

| Role | Can Do |
|---|---|
| `super_admin` | Everything — team review, payment review, competition/batch management, stage advancement |
| `admin_registration` | Review & verify/reject team data |
| `admin_payment` | Review & verify/reject payment |

### Admin Routes

```
GET    /admin/teams                              — List all teams
GET    /admin/teams/{team}                       — Team detail
POST   /admin/teams/{team}/verify                — Verify team
POST   /admin/teams/{team}/revision              — Request revision
POST   /admin/teams/{team}/reject                — Reject team
POST   /admin/teams/{team}/stages/{stage}/advance — Advance stage

GET    /admin/payments                           — List pending payments
GET    /admin/payments/{registration}            — Payment detail
POST   /admin/registrations/{registration}/payment/verify  — Verify payment
POST   /admin/registrations/{registration}/payment/revision — Request revision
POST   /admin/registrations/{registration}/payment/reject   — Reject payment
```

---

## API Endpoints Reference

### Public

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/system/status` | Health check |
| `GET` | `/api/competitions` | List competitions |
| `GET` | `/api/competitions/open` | List open competitions |
| `GET` | `/api/competitions/{id}` | Competition detail |

### Auth

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/auth/register` | Register new account |
| `POST` | `/api/auth/login` | Login |
| `POST` | `/api/auth/logout` | Logout |
| `GET` | `/api/auth/me` | Current user |
| `POST` | `/api/auth/verify-email` | Verify email with code |
| `POST` | `/api/auth/verify-email/resend` | Resend verification code |
| `POST` | `/api/auth/forgot-password` | Request password reset |
| `POST` | `/api/auth/reset-password/verify` | Verify reset code |
| `POST` | `/api/auth/reset-password` | Set new password |

### Registration (Team authenticated)

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/registrations/me/context` | Full registration context (step, progress, redirect) |
| `PUT` | `/api/registrations/me/selection` | Select competition |
| `GET` | `/api/registrations/me/team` | Get team data |
| `PUT` | `/api/registrations/me/team` | Update team data |
| `GET` | `/api/registrations/me/members` | Get member list |
| `PUT` | `/api/registrations/me/members` | Update members |
| `GET` | `/api/registrations/me/documents` | Get documents |
| `PUT` | `/api/registrations/me/documents` | Update documents |
| `GET` | `/api/registrations/me/payment` | Get payment info |
| `POST` | `/api/registrations/me/payment/quote` | Get payment quote (with promo) |
| `POST` | `/api/registrations/me/payment` | Submit payment |
| `GET` | `/api/registrations/me/summary` | Registration summary |
| `POST` | `/api/registrations/me/submit-verification` | Submit for verification |

### Dashboard (Team verified)

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/dashboard/summary` | Dashboard summary |
| `GET` | `/api/teams/me` | Team profile |
| `PATCH` | `/api/teams/me` | Update team profile |

---

## Tech Stack

- **Backend:** Laravel 13 (PHP)
- **Frontend:** React TypeScript + Inertia.js
- **State:** TanStack Query
- **Styling:** Tailwind CSS
- **Database:** MySQL 8.4
- **Auth:** Laravel Sanctum
- **File Upload:** ImageKit (via signed upload auth)
- **Server:** Nginx + PHP-FPM
- **Infra:** Docker Compose Watch

---

## Development Setup

### Prerequisites

- Docker & Docker Compose

### Quick Start

```bash
cp .env.example .env
docker compose down --remove-orphans
docker compose up --build --watch
```

After containers are running:

```bash
docker compose exec app php artisan key:generate
docker compose exec app php artisan migrate
```

### URLs

| Service | URL |
|---|---|
| App | `http://localhost:8080` |
| Vite Dev | `http://localhost:5173` |
| API Status | `http://localhost:8080/api/system/status` |
| MySQL | `localhost:3307` (host) / `mysql:3306` (container) |

### Enter Containers

```bash
docker compose exec app sh       # PHP/Laravel
docker compose exec node sh      # Node/Vite
docker compose exec mysql mysql -uisac -pisac_password isac2026
```

### Production

```bash
cp .env.production.example .env.production
# Edit .env.production with real values
env PROD_ENV_FILE=.env.production docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
```

See [`docs/docker.md`](docs/docker.md) for full architecture, deployment, backup, and troubleshooting.
