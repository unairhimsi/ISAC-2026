@php
    $team = data_get($payload, 'team', []);
    $competition = data_get($payload, 'competition', []);
    $announcement = data_get($payload, 'announcement', []);
    $title = $announcement['title'] ?? 'Pembaruan Kompetisi ISAC 2026';
    $message = $announcement['message'] ?? 'Terdapat pembaruan pada perjalanan kompetisi Team Anda.';
    $dashboardUrl = rtrim(config('app.url'), '/').'/dashboard';
    $logoUrl = rtrim(config('app.url'), '/').'/logo.png';
    $statusAfter = data_get($payload, 'statusAfter') ?? data_get($payload, 'currentStage') ?? '—';
    $actionLabel = str_replace('_',' ', data_get($payload,'action') ?? '');
    $teamCode = $team['code'] ?? '—';
    $preheader = Str::limit(strip_tags($message), 90);
@endphp
<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="dark">
<title>{{ $title }} — ISAC 2026</title>
</head>
<body style="margin:0;background:#090b15;color:#eff2ff;font-family:Arial,Helvetica,sans-serif;-webkit-font-smoothing:antialiased;">
{{-- Preheader untuk anti-spam & preview --}}
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">{{ $preheader }} — Lihat detail di dashboard ISAC 2026.</div>

<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#090b15;padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#151827;border:1px solid #30364f;border-radius:24px;overflow:hidden;">

{{-- Header: logo + gradient sesuai tema web ISAC (ungu → dark, lime aksen) --}}
<tr><td style="padding:28px 32px 22px;background:linear-gradient(135deg,#23155f 0%,#1a1440 45%,#151827 100%);border-bottom:1px solid rgba(255,255,255,0.06);">
  <img src="{{ $logoUrl }}" alt="ISAC 2026 — HIMSI UNAIR" width="132" height="48" style="display:block;border:0;max-width:132px;height:auto;image-rendering:-webkit-optimize-contrast;">
  <p style="margin:16px 0 0;color:#b9b5ff;font-size:11px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;">INFORMATION SYSTEMS AIRLANGGA COMPETITION 2026</p>
  <p style="margin:6px 0 0;color:#8d95ae;font-size:11px;letter-spacing:0.2px;">HIMSI Universitas Airlangga — Fakultas Sains & Teknologi</p>
  <h1 style="margin:16px 0 0;color:#ffffff;font-size:22px;line-height:1.3;font-weight:800;">{{ $title }}</h1>
  @if($actionLabel)<p style="margin:8px 0 0;display:inline-block;background:rgba(167,255,90,0.12);border:1px solid rgba(167,255,90,0.25);color:#a7ff5a;font-size:11px;font-weight:700;letter-spacing:0.6px;padding:4px 10px;border-radius:999px;">{{ strtoupper($actionLabel) }}</p>@endif
</td></tr>

{{-- Body --}}
<tr><td style="padding:28px 32px;color:#e4e7f4;font-size:14px;line-height:1.7;">

<p style="margin:0 0 14px;">Halo, <strong style="color:#ffffff;">{{ $team['name'] ?? 'Team ISAC' }}</strong> 👋</p>
<p style="margin:0 0 18px;color:#e4e7f4;">{!! nl2br(e($message)) !!}</p>

{{-- Highlight box sesuai template: lebih informatif --}}
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:18px 0;border:1px solid #30364f;border-radius:16px;background:#0f1220;overflow:hidden;">
<tr><td style="padding:18px;">
  <p style="margin:0 0 12px;color:#a7ff5a;font-size:12px;font-weight:700;letter-spacing:0.6px;text-transform:uppercase;">Detail Peserta</p>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="font-size:13px;line-height:1.5;">
    <tr><td style="padding:6px 0;color:#aeb6cf;width:38%;">Kode Tim</td><td style="padding:6px 0;color:#ffffff;font-weight:700;">{{ $teamCode }}</td></tr>
    <tr><td style="padding:6px 0;color:#aeb6cf;">Kompetisi</td><td style="padding:6px 0;color:#ffffff;font-weight:700;">{{ $competition['name'] ?? 'ISAC 2026' }}</td></tr>
    <tr><td style="padding:6px 0;color:#aeb6cf;">Batch</td><td style="padding:6px 0;color:#ffffff;font-weight:700;">{{ $competition['batch'] ?? '—' }}</td></tr>
    <tr><td style="padding:6px 0;color:#aeb6cf;">Tahap / Status</td><td style="padding:6px 0;color:#ffffff;font-weight:700;">{{ $statusAfter }}</td></tr>
    <tr><td style="padding:6px 0;color:#aeb6cf;">Email Terdaftar</td><td style="padding:6px 0;color:#e4e7f4;">{{ $team['email'] ?? '—' }}</td></tr>
  </table>
</td></tr>
</table>

{{-- Langkah selanjutnya — konsisten dengan UI web --}}
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:18px 0;background:rgba(167,255,90,0.07);border:1px solid rgba(167,255,90,0.18);border-radius:14px;">
<tr><td style="padding:14px 16px;">
  <p style="margin:0 0 4px;color:#a7ff5a;font-size:12px;font-weight:700;">Langkah Selanjutnya</p>
  <p style="margin:0;color:#e4e7f4;font-size:13px;line-height:1.55;">Buka dashboard team untuk melihat jadwal, pengumuman, dan instruksi tahap berikutnya. Pastikan data tim & anggota sudah lengkap.</p>
</td></tr>
</table>

{{-- CTA utama — warna lime #a7ff5a sesuai tema web --}}
<p style="margin:22px 0 0;text-align:center;">
  <a href="{{ $dashboardUrl }}" style="display:inline-block;border-radius:999px;background:#a7ff5a;color:#141a0c;padding:13px 24px;text-decoration:none;font-weight:800;font-size:14px;letter-spacing:0.2px;box-shadow:0 6px 20px rgba(167,255,90,0.25);">Buka Team Dashboard →</a>
</p>
<p style="margin:12px 0 0;text-align:center;color:#8d95ae;font-size:11px;">atau salin tautan: <a href="{{ $dashboardUrl }}" style="color:#a7ff5a;word-break:break-all;">{{ $dashboardUrl }}</a></p>

<p style="margin:22px 0 0;color:#aeb6cf;font-size:12px;line-height:1.6;">Butuh bantuan? Hubungi panitia via <a href="mailto:isac@himsiunair.com" style="color:#a7ff5a;text-decoration:none;">isac@himsiunair.com</a> atau kanal resmi ISAC 2026.</p>
<p style="margin:8px 0 0;color:#8d95ae;font-size:11px;line-height:1.5;">Pesan ini dikirim otomatis untuk <strong style="color:#e4e7f4;">{{ $team['email'] ?? 'email terdaftar' }}</strong>. Jika kamu merasa tidak mendaftar ISAC 2026, abaikan email ini.</p>

</td></tr>

{{-- Footer — alamat fisik untuk anti-spam (SPF/DKIM) --}}
<tr><td style="padding:16px 32px;background:#0f1220;border-top:1px solid #30364f;color:#8d95ae;font-size:11px;line-height:1.6;text-align:center;">
  <p style="margin:0;color:#e4e7f4;font-weight:700;letter-spacing:0.3px;">© {{ date('Y') }} Information Systems Airlangga Competition — HIMSI UNAIR</p>
  <p style="margin:4px 0 0;">Departemen Sistem Informasi, Fakultas Sains & Teknologi, Universitas Airlangga — Kampus C, Surabaya 60115</p>
  <p style="margin:8px 0 0;font-size:10px;color:#6b7280;">Email ini dikirim via sistem resmi ISAC 2026. Tambahkan <span style="color:#aeb6cf;">isac@himsiunair.com</span> ke kontak agar tidak masuk spam.</p>
</td></tr>

</table>
</td></tr>
</table>
</body>
</html>
