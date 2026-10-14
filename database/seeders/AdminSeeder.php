<?php

namespace Database\Seeders;

use App\Models\Admin;
use Illuminate\Database\Seeder;

class AdminSeeder extends Seeder
{
    private const LOCAL_PASSWORD = 'isacop@dmin123';

    public function run(): void
    {
        $email = (string) config('admin.seed.email');
        $password = config('admin.seed.password');

        if ($password === null || $password === '') {
            if (! app()->environment(['local', 'testing'])) {
                $this->command?->error('ADMIN_SEED_PASSWORD wajib diisi di luar lingkungan lokal. Admin tidak dibuat.');

                return;
            }

            $password = self::LOCAL_PASSWORD;
        }

        $admin = Admin::query()->firstOrNew(['email' => $email]);

        if ($admin->exists) {
            $this->command?->info("Admin {$email} sudah ada dan tidak diubah.");

            return;
        }

        $admin->fill([
            'name' => 'Admin ISAC',
            'password' => $password,
            'role' => 'super_admin',
            'is_active' => true,
        ])->save();
    }
}
