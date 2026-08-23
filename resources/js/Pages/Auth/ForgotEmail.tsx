import React from 'react';
import { AuthLayout } from '@/features/auth/components/AuthLayout';
import { AuthShell } from '@/features/auth/components/AuthShell';
import { ForgotEmailForm } from '@/features/auth/components/ForgotEmailForm';

const ForgotEmail = () => {
    return (
        <AuthShell
            title="Lupa Password — ISAC 2026"
            description="Pulihkan akses akun ISAC 2026 Symphony of System dengan kode OTP ke email. HIMSI Universitas Airlangga — proses cepat & aman."
        >
            <ForgotEmailForm />
        </AuthShell>
    );
};

ForgotEmail.layout = (page: React.ReactNode) => (
    <AuthLayout
        title="Lupa Password — ISAC 2026"
        description="Pulihkan akses akun ISAC 2026 Symphony of System dengan verifikasi OTP email. HIMSI UNAIR."
    >
        {page}
    </AuthLayout>
);

export default ForgotEmail;
