# Design: SEO Architecture + Admin Run Operation Dialog

Date: 2026-08-23
Status: Approved by user

## Part A — SEO Architecture

Domain produksi: `https://isac.himsiunair.com`. Aplikasi TANPA SSR → SEO server-side (blade) adalah prioritas.

### A1. Fondasi
- `.env.production` + `.env.production.example`: `APP_URL=https://isac.himsiunair.com`; tambah `SEO_ROBOTS_ALLOW=true`, `GOOGLE_SITE_VERIFICATION=` (kosong, diisi saat daftar Search Console).
- Hapus statis `public/robots.txt` (menutupi route); ganti route dinamis `/robots.txt` membaca `config('seo.robots_allow')`:
  - Produksi: `Allow: /` + `Disallow: /api, /admin, /dashboard, /auth, /registration, /todos` + `Sitemap: {app.url}/sitemap.xml`
  - Lokal: `Disallow: /`
- Config baru `config/seo.php`.
- Sitemap diperluas: `/` dan `/auth/register`.

### A2. Structured Data server-side (partial blade `partials/seo-ld.blade.php`)
1. `WebSite`: name "ISAC 2026", alternateName ["Information System Airlangga Competition", "ISAC", "isac.himsiunair.com"], url canonical home. (Pola resmi Google Site Names.)
2. `Organization`: HIMSI Universitas Airlangga, logo `{app}/logo.png`, sameAs Instagram resmi.
3. `Event`: ISAC 2026 tema "Symphony of System", start 2026-08-23, end 2026-10-31, EventScheduled, offline di Universitas Airlangga Surabaya, organizer HIMSI UNAIR.

Duplikasi WebSite dihindari: hapus `createWebsiteJsonLd()` dari `LandingPage/Index.tsx`.

### A3. Meta blade
- `twitter:card` → `summary_large_image`.
- Meta `google-site-verification` kondisional dari env.

### A4. Manual (user, pasca-deploy)
- Google Search Console: verifikasi + submit sitemap.
- Sedikan og-image 1200×630 (logo.png sekarang 126×45).

## Part B — Admin Run Operation Dialog

Backend lengkap (`POST /api/admin/operations`, aksi VERIFY_TEAM | VERIFY_PAYMENT | ADVANCE_STAGE | ANNOUNCE_RESULT, maks 100 tim); hook `useCreateAdminOperation` yatim tanpa UI.

- Tombol "Jalankan Operasi" di header `Admin/Operations/Index.tsx`.
- Dialog baru `features/admin/components/RunOperationDialog.tsx`:
  1. Pilih aksi (4 opsi).
  2. Multi-select tim dengan search debounce (useAdminTeams), chips terpilih, counter maks 100.
  3. Target stage (wajib hanya untuk ADVANCE_STAGE, dari useAdminStages).
  4. Form pengumuman (judul, template, pesan, kirim notifikasi email) hanya untuk ANNOUNCE_RESULT.
  5. Toggle sinkron Spreadsheet (default true).
  6. Submit → toast background-process → invalidate list operasi.

Tanpa perubahan backend.
