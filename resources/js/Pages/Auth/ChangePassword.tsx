import React from 'react';
import { AuthLayout } from '@/features/auth/components/AuthLayout';
import { AuthShell } from '@/features/auth/components/AuthShell';
import { ChangePasswordForm } from '@/features/auth/components/ChangePasswordForm';

const ChangePassword = () => {
    return (
        <AuthShell
            title="Ubah Password — ISAC 2026"
            description="Buat password baru yang aman untuk akun ISAC 2026 Symphony of System, HIMSI UNAIR."
        >
            <ChangePasswordForm />
        </AuthShell>
    );
};

ChangePassword.layout = (page: React.ReactNode) => (
    <AuthLayout
        title="Ubah Password — ISAC 2026"
        description="Atur password baru untuk mengamankan akun ISAC 2026 Symphony of System, HIMSI UNAIR."
        noindex
    >
        {page}
    </AuthLayout>
);

export default ChangePassword;
