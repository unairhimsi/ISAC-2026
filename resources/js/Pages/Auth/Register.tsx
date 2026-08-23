import React from 'react';
import { AuthLayout } from '@/features/auth/components/AuthLayout';
import { AuthShell } from '@/features/auth/components/AuthShell';
import { RegisterForm } from '@/features/auth/components/RegisterForm';

const Register = () => {
    return (
        <AuthShell
            title="Daftar Akun — ISAC 2026"
            description="Buat akun ISAC 2026 Symphony of System untuk mendaftarkan tim Olimpiade, Business Plan atau Business IT Case — HIMSI Universitas Airlangga."
        >
            <RegisterForm />
        </AuthShell>
    );
};

Register.layout = (page: React.ReactNode) => (
    <AuthLayout
        title="Daftar Akun — ISAC 2026"
        description="Buat akun ISAC 2026 Symphony of System untuk mendaftarkan tim Olimpiade, Business Plan atau Business IT Case — HIMSI UNAIR."
    >
        {page}
    </AuthLayout>
);

export default Register;
