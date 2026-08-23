# ISAC 2026 — Spreadsheet Integration

Source of truth: **Database ISAC** — Spreadsheet hanya operational monitoring / integration log.

## Versi

| Versi | File | Status | Fitur |
|---|---|---|---|
| v1.1 | `ISAC-2026-Spreadsheet-API-v1.1.gs` *(legacy, tidak ada di repo)* | deprecated | cuma log sheet, email via Brevo |
| v1.2 | `ISAC-2026-Spreadsheet-API-v1.2.gs` | deployed 23 Agu 11:59 | `ANNOUNCE_RESULT` via GmailApp, batch 500 |
| **v1.3** | `ISAC-2026-Spreadsheet-API-v1.3.gs` | **deployed 23 Agu 12:22 — ACTIVE** | **ALL actions email + VERIFY_TEAM_PAYMENT gabungan + 500/team** |

> Production URL aktif: `https://script.google.com/macros/s/AKfycbyh15BxnYd3ysRuZoB0vpXmu2LDnj0p4B3tUoltj3WTAjPy_s0K0nDMHcLO2Cord7KZ/exec`
> Health: `?path=health&apiKey={GOOGLE_SHEET_API_KEY}` → `{"version":"1.3.0"}`

## v1.3 — Apa yang baru (A & B)

- **A. Limit 100 → 500**: `RunOperationDialog MAX_TEAMS 500`, `RunAdminOperationRequest max:500`, `CONFIG.MAX_BATCH_SIZE 500` → bisa 300-400 team per operasi.
- **B. Email untuk semua aksi**: `VERIFY_TEAM`, `VERIFY_PAYMENT`, `VERIFY_TEAM_PAYMENT`, `ADVANCE_STAGE`, `ANNOUNCE_RESULT` semua `emailStatus=PENDING → SENT` via GmailApp kalau `send_notification=true`.
- **Gabungan 1 operasi**: `VERIFY_TEAM_PAYMENT` verifikasi `team.status` + `registration.status` sekaligus. Jika salah satu sudah `VERIFIED`, hanya yang belum yang diproses. `SKIPPED` hanya kalau keduanya sudah `VERIFIED`.

## Cara deploy Apps Script

1. Buka https://script.google.com → project ISAC Spreadsheet
2. Paste isi `ISAC-2026-Spreadsheet-API-v1.3.gs` → Save
3. Deploy → Manage deployments → Edit → New version → Deploy
4. Copy `Web app URL` → update `.env` & `.env.production`:
   ```
   GOOGLE_SHEET_API_URL=https://script.google.com/macros/s/.../exec
   GOOGLE_SHEET_API_KEY=f312c2a32af14b5989f78a3c6365640991d72bd308d44831bb6c184fe202ffc2
   GOOGLE_SHEET_API_ENABLED=true
   GOOGLE_SHEET_EMAIL_VIA_APPS_SCRIPT=true
   ```
5. `php artisan config:clear` → test `curl ?path=health`

## Alur Laravel

```
Admin → POST /api/admin/operations {action, team_ids[<=500], announcement{send_notification}}
  → AdminOperationService::create → ProcessAdminOperationJob (sync)
  → processItem → applyAction → firstOrCreate SpreadsheetIntegrationEvent (email PENDING jika send_notification)
  → SyncSpreadsheetIntegrationEventJob → POST ?path=events/batch-upsert → Apps Script GmailApp → Sheet SYNCED/SENT
```

## Testing

```bash
# health
curl "https://script.google.com/macros/s/AKfyc.../exec?path=health&apiKey=f312c..."

# operation gabungan
php artisan tinker --execute="
\$op = app(App\Services\AdminOperationService::class)->create(\$admin, ['action'=>'VERIFY_TEAM_PAYMENT','team_ids'=>[...],'announcement'=>['send_notification'=>true]], 'key');
app(App\Services\AdminOperationService::class)->process(\$op);
"
# cek sheet
curl "https://.../exec?path=events/operation:{id}:team:{id}&apiKey=..."
```

## File terkait di repo

- `app/Models/AdminOperation.php` — tambah `VERIFY_TEAM_PAYMENT`
- `app/Services/AdminOperationService.php` — `verifyTeamAndPayment()`, fix `$notify`
- `app/Policies/AdminOperationPolicy.php` — role untuk gabungan
- `app/Http/Requests/Admin/RunAdminOperationRequest.php` — max 500
- `app/Jobs/SendCompetitionAnnouncementJob.php` — skip Brevo untuk 5 aksi
- `resources/js/features/admin/components/RunOperationDialog.tsx` — MAX 500 + UI gabungan + email all
- `resources/js/features/admin/types/adminTypes.ts` — type baru
- `resources/js/Pages/Admin/Operations/*` — label

## Spreadsheet

- ID: `1h1Y951j3RI3ngwl8RWqiEL4h7gVo2ywNTVYztF43d9c`
- URL: https://docs.google.com/spreadsheets/d/1h1Y951j3RI3ngwl8RWqiEL4h7gVo2ywNTVYztF43d9c
- Sheet: `Events`

