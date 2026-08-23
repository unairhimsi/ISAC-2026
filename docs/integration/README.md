# ISAC 2026 — Spreadsheet Integration

Source of truth: **Database ISAC** — Spreadsheet hanya operational monitoring / integration log.

## Versi

| Versi | File | Status | Fitur |
|---|---|---|---|
| v1.1 | `ISAC-2026-Spreadsheet-API-v1.1.gs` *(legacy)* | deprecated | cuma log sheet, email via Brevo |
| v1.2 | `ISAC-2026-Spreadsheet-API-v1.2.gs` | deprecated | `ANNOUNCE_RESULT` via GmailApp, batch 500 |
| v1.3 | `ISAC-2026-Spreadsheet-API-v1.3.gs` | deprecated — gunakan v1.4 | ALL actions email + gabungan, tapi rawan spam (alias @gmail) |
| **v1.4** | `ISAC-2026-Spreadsheet-API-v1.4.gs` | **ACTIVE — 24 Agu 2026** | **Template informatif + anti-spam + alias domain** |

> Production URL aktif: `https://script.google.com/macros/s/AKfycbyh15BxnYd3ysRuZoB0vpXmu2LDnj0p4B3tUoltj3WTAjPy_s0K0nDMHcLO2Cord7KZ/exec`
> Health: `?path=health&apiKey={GOOGLE_SHEET_API_KEY}` → `{"version":"1.4.0", "emailAlias":"isac@himsiunair.com"}`

## v1.4 — Apa yang baru (Template + Anti-Spam + Tema Web)

**Masalah v1.3:** email dari Spreadsheet via `GmailApp.sendEmail` pakai akun `@gmail.com` (`misbahulmuttaqin395@gmail.com`) dengan nama `ISAC 2026 — HIMSI UNAIR`. Gmail penerima flag sebagai spam karena:
- From domain mismatch (envelope `gmail.com` ≠ display domain `himsiunair.com`)
- Tanpa SPF `include:_spf.google.com` + DKIM untuk domain `isac.himsiunair.com`
- Tanpa alamat fisik di footer (wajib CAN-SPAM)
- Tanpa preheader + plain-text alternatif
- Pengiriman massal 500 sekaligus tanpa throttling → Gmail rate-limit → bulk folder

**Fix v1.4:**

1. **Template lebih informatif & sinkron tema web** (`#090b15` bg, `#151827` card, `#a7ff5a` lime, gradient `#23155f`):
   - Header: logo `https://isac.himsiunair.com/logo.png` (public/logo.png 126×45), bukan `android-chrome-192x192.png`
   - Preheader 90 char + subject `ISAC 2026 — <judul>` (tanpa `[bracket]`)
   - Box **Detail Peserta**: kode tim, kompetisi, batch, tahap/status, email terdaftar
   - Box **Langkah Selanjutnya**: ajak buka dashboard, cek jadwal
   - CTA lime `Buka Team Dashboard →` + link plain
   - Footer fisik: *Departemen Sistem Informasi, FST UNAIR — Kampus C, Surabaya 60115* + notice *tambahkan ke kontak*
   - Laravel & Apps Script pakai template identik (lihat `resources/views/emails/competition-operation.blade.php`)

2. **Anti-Spam Spreadsheet:**
   - `CONFIG.EMAIL_SENDER_ALIAS = 'isac@himsiunair.com'` — WAJIB alias terverifikasi Google Workspace (Admin Console → Gmail → *Send mail as*). Jika kosong, fallback ke akun pemilik script (rawan spam).
   - **DNS untuk `isac.himsiunair.com`** (minta IT UNAIR):
     ```
     SPF:  v=spf1 include:_spf.google.com include:spf.brevo.net ~all
     DKIM: generate di Google Workspace Admin → Gmail → Authenticate email → TXT record
           + Brevo → Settings → Senders & Domains → DKIM
     DMARC: v=DMARC1; p=none; rua=mailto:dmarc@himsiunair.com
     ```
   - `CONFIG.SUPPORT_EMAIL` & `PHYSICAL_ADDRESS` dipakai di body (spam filter cek).
   - **Opsi Laravel**: jika tetap masuk spam, set `GOOGLE_SHEET_EMAIL_VIA_APPS_SCRIPT=false` → email dikirim via Brevo (deliverability tinggi, Sheet tetap SYNCED). Lihat `config/services.php`.

3. **UX Admin v1.4:**
   - `RunOperationDialog.tsx` — **Verifikasi pakai template otomatis**: `VERIFY_TEAM/PAYMENT/TEAM_PAYMENT/ADVANCE_STAGE` tidak perlu isi judul/pesan manual, tampil preview. Hanya `Pengumuman Finalis (ANNOUNCE_RESULT)` butuh teks custom.
   - `AdminOperationService.php` — **jangan di-SKIPPED**: verifikasi sekarang selalu kirim pengumuman walau `status` sudah `VERIFIED` (sebelumnya `SKIPPED`).
   - **Baru: `/admin/team-stages`** — cek stage tiap team per lomba + bulk advance. Pilih kompetisi → lihat `Tahap {order}: {name}` per team → pilih `Tujuan Tahap` → eligible check (`order+1`) + cek `VERIFIED` → tombol `Loloskan {n} Tim`. Pesan otomatis *Selamat, Team Anda berhasil lolos ke tahap {nama} ISAC 2026.*

## Cara deploy Apps Script v1.4

1. Buka https://script.google.com → project *ISAC Spreadsheet*
2. **Pastikan alias terverifikasi**: Gmail pemilik script → Settings → *Accounts and Import* → *Send mail as* → Add `isac@himsiunair.com` → verifikasi kode.
   Alternatif Workspace: Admin Console → Users → `isac@himsiunair.com` → Add alias.
3. Paste isi `ISAC-2026-Spreadsheet-API-v1.4.gs` → Save (Ctrl+S)
4. Deploy → Manage deployments → Edit → New version → Deploy
5. Copy `Web app URL` → update `.env` & `.env.production`:
   ```
   GOOGLE_SHEET_API_URL=https://script.google.com/macros/s/.../exec
   GOOGLE_SHEET_API_KEY=f312c2a32af14b5989f78a3c6365640991d72bd308d44831bb6c184fe202ffc2
   GOOGLE_SHEET_API_ENABLED=true
   GOOGLE_SHEET_EMAIL_VIA_APPS_SCRIPT=true   # false = via Brevo (lebih anti-spam)
   MAIL_EHLO_DOMAIN=isac.himsiunair.com
   MAIL_FROM_ADDRESS=isac@himsiunair.com     # jangan @gmail.com
   BREVO_SENDER_EMAIL=isac@himsiunair.com
   ```
6. `php artisan config:clear` → test:
   ```bash
   curl "https://.../exec?path=health&apiKey=f312c..."
   # expect {"version":"1.4.0","emailAlias":"isac@himsiunair.com"}
   ```

## Checklist Anti-Spam (Wajib)

- [ ] Domain `isac.himsiunair.com` SPF + DKIM + DMARC terpasang (cek https://www.mail-tester.com/ → score 9/10+)
- [ ] Alias `isac@himsiunair.com` terverifikasi di Gmail pengirim script
- [ ] `MAIL_EHLO_DOMAIN` = `isac.himsiunair.com` (bukan `localhost`)
- [ ] Logo `https://isac.himsiunair.com/logo.png` reachable (200 OK, bukan 404)
- [ ] Kirim test ke `check-auth@verifier.port25.com` + Gmail incognito → cek *Inbox* bukan Spam → lihat *Show original* → `SPF=PASS, DKIM=PASS, DMARC=PASS`

Jika skor <8: ganti `GOOGLE_SHEET_EMAIL_VIA_APPS_SCRIPT=false` sementara — email lewat Brevo, Sheet tetap sync.

## Alur Laravel (update v1.4)

```
Admin → POST /api/admin/operations {action, team_ids[<=500], target_stage_id, announcement{send_notification}}
  → AdminOperationService::create → ProcessAdminOperationJob
  → verifyTeam / verifyPayment / advanceStage
     - jika sudah VERIFIED: tetap COMPLETED (jangan SKIPPED) + buat event PENDING untuk pengumuman
  → SyncSpreadsheetIntegrationEventJob → POST ?path=events/batch-upsert
     → Apps Script v1.4 sendOperationEmail_() → GmailApp (alias domain) → Sheet SYNCED/SENT
     # jika GOOGLE_SHEET_EMAIL_VIA_APPS_SCRIPT=false → Brevo send via Laravel
```

Khusus **Kelola Tahap Team** (`/admin/team-stages`):

```
Admin pilih kompetisi → GET /api/admin/teams?competition_id=... + GET /api/admin/stages?competition_id=...
  → tampil tabel: Kode Tim | Tahap Saat Ini (Tahap {order}) | Eligible?
  → pilih Tujuan Tahap → cek eligible: status VERIFIED + order+1 == target.order
  → POST /api/admin/operations {action:ADVANCE_STAGE, target_stage_id, team_ids, announcement:{title:"Selamat! Lolos ke {stage}", message:"..."}, send_notification:true}
  → email: "Selamat, Team Anda berhasil lolos ke tahap {stage} ISAC 2026. Silakan cek dashboard..."
```

## Testing

```bash
# health v1.4
curl "https://script.google.com/macros/s/AKfycbyh15BxnYd3ysRuZoB0vpXmu2LDnj0p4B3tUoltj3WTAjPy_s0K0nDMHcLO2Cord7KZ/exec?path=health&apiKey=f312c..."

# test email template Laravel (brevo)
php artisan tinker --execute="
Mail::to('test@gmail.com')->send(new App\Mail\CompetitionOperationMail(['team'=>['name'=>'Test','code'=>'ISAC-TM-999','email'=>'test@gmail.com'],'competition'=>['name'=>'Business Case','batch'=>'Batch 1'],'currentStage'=>'Semifinal','action'=>'ADVANCE_STAGE','announcement'=>['title'=>'Pengumuman Kelolosan Tahap','message'=>'Selamat, Team Anda berhasil lolos ke tahap Semifinal ISAC 2026.'],'statusAfter'=>'Semifinal']));
"

# operation gabungan tetap kirim walau sudah VERIFIED (v1.4 tidak SKIPPED)
php artisan tinker --execute="
\$admin=App\Models\Admin::first(); \$team=App\Models\Team::where('code','ISAC-TM-001')->first();
\$op=app(App\Services\AdminOperationService::class)->create(\$admin, ['action'=>'VERIFY_TEAM','team_ids'=>[\$team->id],'announcement'=>['send_notification'=>true]], 'test-'.Str::uuid());
app(App\Services\AdminOperationService::class)->process(\$op);
echo \$op->fresh()->skipped_count.' skipped, '.\$op->fresh()->success_count.' success';
"

# cek Kelola Tahap
# buka /admin/team-stages → pilih kompetisi → pilih tim → pilih target stage → Loloskan
```

## File terkait di repo (v1.4)

- `resources/views/emails/competition-operation.blade.php` — template informatif baru + preheader + fisik footer
- `docs/integration/ISAC-2026-Spreadsheet-API-v1.4.gs` — NEW, 1.4.0
- `docs/integration/ISAC-2026-Spreadsheet-API-v1.3.gs` — tetap, deprecated
- `app/Services/AdminOperationService.php` — hapus `SKIPPED` untuk verifikasi (selalu kirim pengumuman)
- `resources/js/features/admin/components/RunOperationDialog.tsx` — template otomatis vs custom finalis
- `resources/js/Pages/Admin/TeamStages.tsx` — NEW: cek & bulk advance per kompetisi
- `resources/js/constants/admin.ts` — nav baru Kelola Tahap Team
- `routes/web.php` — route `/admin/team-stages`
- `app/Http/Resources/RegistrationSummaryResource.php` — expose `currentStage`
- `.env.example` — contoh `isac@himsiunair.com` anti-spam

## Spreadsheet

- ID: `1h1Y951j3RI3ngwl8RWqiEL4h7gVo2ywNTVYztF43d9c`
- URL: https://docs.google.com/spreadsheets/d/1h1Y951j3RI3ngwl8RWqiEL4h7gVo2ywNTVYztF43d9c
- Sheet: `Events`

## Alternatif jika tetap spam

Set di `.env`:

```
GOOGLE_SHEET_EMAIL_VIA_APPS_SCRIPT=false
MAIL_FROM_ADDRESS=isac@himsiunair.com
BREVO_SENDER_EMAIL=isac@himsiunair.com
```

Maka `SyncSpreadsheetIntegrationEventJob` tetap `SYNCED` ke Sheet, tapi email dikirim Laravel via Brevo (SPF/DKIM Brevo sudah verified) — bukan via GmailApp. Sheet kolom `email_status` akan update via Brevo webhook (jika diaktifkan) atau tetap `PENDING → SENT` oleh Laravel.
