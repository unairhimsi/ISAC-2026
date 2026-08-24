import React from 'react';
import { AuthLayout } from '@/features/auth/components/AuthLayout';
import { AuthShell } from '@/features/auth/components/AuthShell';
import { LoginForm } from '@/features/auth/components/LoginForm';

const Login = () => {
    return (
        <AuthShell
            title="Masuk — ISAC 2026"
            description="Masuk ke ISAC 2026 Symphony of System untuk melanjutkan pendaftaran tim atau kelola dashboard kompetisi HIMSI Universitas Airlangga."
        >
            <LoginForm />
        </AuthShell>
    );
};

Login.layout = (page: React.ReactNode) => (
    <AuthLayout
        title="Masuk — ISAC 2026"
        description="Masuk ke ISAC 2026 Symphony of System untuk melanjutkan pendaftaran tim atau kelola dashboard kompetisi HIMSI UNAIR."
    >
        {page}
    </AuthLayout>
);

export default Login;
