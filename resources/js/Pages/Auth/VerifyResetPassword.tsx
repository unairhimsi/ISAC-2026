import React from 'react'
import { AuthLayout } from '@/features/auth/components/AuthLayout'
import { AuthShell } from '@/features/auth/components/AuthShell'
import { VerifyResetPasswordForm } from '@/features/auth/components/VerifyResetPasswordForm'

const VerifyResetPassword = () => (
  <AuthShell title="Verifikasi OTP Reset — ISAC 2026" description="Masukkan kode OTP reset password ISAC 2026 Symphony of System untuk melanjutkan perubahan kredensial.">
    <VerifyResetPasswordForm />
  </AuthShell>
)

VerifyResetPassword.layout = (page: React.ReactNode) => (
  <AuthLayout title="Verifikasi OTP Reset — ISAC 2026" description="Verifikasi kode OTP reset password ISAC 2026 Symphony of System, HIMSI UNAIR." noindex>
    {page}
  </AuthLayout>
)

export default VerifyResetPassword
