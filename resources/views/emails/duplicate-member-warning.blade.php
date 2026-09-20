<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Peringatan Duplikasi Peserta ISAC 2026</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; padding: 40px 0;">
        <tr>
            <td align="center">
                <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; width: 100%;">

                    <tr>
                        <td style="background-color: #7f1d1d; padding: 32px 40px; text-align: center; border-radius: 8px 8px 0 0;">
                            <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700; letter-spacing: 1px;">
                                ISAC 2026 — Peringatan Duplikasi
                            </h1>
                        </td>
                    </tr>

                    <tr>
                        <td style="background-color: #ffffff; padding: 40px;">
                            <h2 style="margin: 0 0 8px; color: #0f172a; font-size: 20px; font-weight: 600;">
                                Terdeteksi pendaftaran ganda
                            </h2>
                            <p style="margin: 0 0 24px; color: #64748b; font-size: 14px; line-height: 1.5;">
                                Sistem mendeteksi bahwa identitas peserta berikut sudah terdaftar pada tim lain untuk kompetisi ISAC 2026.
                            </p>

                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 6px;">
                                <tr>
                                    <td style="padding: 16px 20px;">
                                        <p style="margin: 0 0 8px; color: #991b1b; font-size: 13px; font-weight: 600;">
                                            Detail Konflik
                                        </p>
                                        <p style="margin: 0 0 4px; color: #7f1d1d; font-size: 13px; line-height: 1.6;">
                                            <strong>Tim Anda:</strong> {{ $existingTeamCode }} &mdash; {{ $existingTeamName }}
                                        </p>
                                        <p style="margin: 0 0 4px; color: #7f1d1d; font-size: 13px; line-height: 1.6;">
                                            <strong>Tim Pendaftar Lain:</strong> {{ $incomingTeamCode }} &mdash; {{ $incomingTeamName }}
                                        </p>
                                        <p style="margin: 0 0 4px; color: #7f1d1d; font-size: 13px; line-height: 1.6;">
                                            <strong>Jenis Konflik:</strong> {{ $conflictKind }}
                                        </p>
                                        <p style="margin: 0; color: #7f1d1d; font-size: 13px; line-height: 1.6;">
                                            <strong>Nilai Konflik:</strong> {{ $conflictValue }}
                                        </p>
                                    </td>
                                </tr>
                            </table>

                            <p style="margin: 24px 0 0; color: #475569; font-size: 14px; line-height: 1.6;">
                                Setiap peserta hanya boleh terdaftar pada <strong>satu tim</strong> untuk satu kompetisi. Mohon periksa kembali data anggota tim Anda. Jika ini adalah kesalahan, hubungi panitia ISAC 2026.
                            </p>
                        </td>
                    </tr>

                    <tr>
                        <td style="background-color: #f8fafc; padding: 24px 40px; border-top: 1px solid #e2e8f0; border-radius: 0 0 8px 8px;">
                            <p style="margin: 0 0 8px; color: #94a3b8; font-size: 13px; line-height: 1.5;">
                                Email ini dikirim secara otomatis oleh sistem ISAC 2026.
                            </p>
                            <p style="margin: 0; color: #cbd5e1; font-size: 12px;">
                                &copy; {{ date('Y') }} ISAC 2026. All rights reserved.
                            </p>
                        </td>
                    </tr>

                </table>
            </td>
        </tr>
    </table>
</body>
</html>
