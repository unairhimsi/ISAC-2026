import React from 'react';
import { AuthLayout } from '@/features/auth/components/AuthLayout';
import { AuthShell } from '@/features/auth/components/AuthShell';
import { VerifyEmailForm } from '@/features/auth/components/VerifyEmailForm';

const VerifyEmail = () => {
    return (
        <AuthShell
            title="Verifikasi Email — ISAC 2026"
            description="Masukkan kode OTP yang dikirim ke email untuk aktivasi akun ISAC 2026 Symphony of System, HIMSI UNAIR."
        >
            <VerifyEmailForm />
        </AuthShell>
    );
};

VerifyEmail.layout = (page: React.ReactNode) => (
    <AuthLayout
        title="Verifikasi Email — ISAC 2026"
        description="Aktivasi akun ISAC 2026 dengan kode OTP email — Symphony of System HIMSI UNAIR."
        noindex
    >
        {page}
    </AuthLayout>
);

export default VerifyEmail;
