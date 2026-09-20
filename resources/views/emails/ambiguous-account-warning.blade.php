<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Peringatan Akun Ambigu ISAC 2026</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; padding: 40px 0;">
        <tr>
            <td align="center">
                <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; width: 100%;">

                    <tr>
                        <td style="background-color: #78350f; padding: 32px 40px; text-align: center; border-radius: 8px 8px 0 0;">
                            <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700; letter-spacing: 1px;">
                                ISAC 2026 — Peringatan Akun
                            </h1>
                        </td>
                    </tr>

                    <tr>
                        <td style="background-color: #ffffff; padding: 40px;">
                            <h2 style="margin: 0 0 8px; color: #0f172a; font-size: 20px; font-weight: 600;">
                                Email Anda digunakan pada dua jenis akun
                            </h2>
                            <p style="margin: 0 0 24px; color: #64748b; font-size: 14px; line-height: 1.5;">
                                Sistem mendeteksi bahwa email di bawah ini terdaftar baik sebagai akun <strong>Tim</strong> maupun akun <strong>Admin</strong> ISAC 2026. Hal ini tidak diizinkan dan akan menyebabkan login gagal.
                            </p>

                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #fffbeb; border: 1px solid #fde68a; border-radius: 6px;">
                                <tr>
                                    <td style="padding: 16px 20px;">
                                        <p style="margin: 0 0 8px; color: #92400e; font-size: 13px; font-weight: 600;">
                                            Email Terdampak
                                        </p>
                                        <p style="margin: 0; color: #78350f; font-size: 14px; line-height: 1.6; font-family: 'Courier New', Courier, monospace;">
                                            {{ $email }}
                                        </p>
                                    </td>
                                </tr>
                            </table>

                            <p style="margin: 24px 0 0; color: #475569; font-size: 14px; line-height: 1.6;">
                                Untuk menjaga keamanan dan kejelasan peran, mohon gunakan <strong>email berbeda</strong> untuk akun Tim dan Admin. Hubungi panitia ISAC 2026 jika Anda memerlukan bantuan migrasi akun.
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
