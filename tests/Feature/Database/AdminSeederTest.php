<?php

use App\Models\Admin;
use Database\Seeders\AdminSeeder;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Illuminate\Support\Facades\Hash;

uses(LazilyRefreshDatabase::class);

test('admin seeder creates the local admin with the development password when none is configured', function (): void {
    config(['admin.seed.email' => 'admin@isac.com', 'admin.seed.password' => null]);

    $this->seed(AdminSeeder::class);

    $admin = Admin::query()->where('email', 'admin@isac.com')->firstOrFail();
    expect(Hash::check('isacop@dmin123', $admin->password))->toBeTrue()
        ->and($admin->role)->toBe('super_admin')
        ->and($admin->is_active)->toBeTrue();
});

test('admin seeder never overwrites an existing admin', function (): void {
    config(['admin.seed.email' => 'admin@isac.com', 'admin.seed.password' => 'Password-Baru-123']);
    Admin::factory()->create([
        'email' => 'admin@isac.com',
        'password' => 'Password-Lama-123',
        'role' => 'admin_payment',
        'is_active' => false,
    ]);

    $this->seed(AdminSeeder::class);

    $admin = Admin::query()->where('email', 'admin@isac.com')->firstOrFail();
    expect(Hash::check('Password-Lama-123', $admin->password))->toBeTrue()
        ->and($admin->role)->toBe('admin_payment')
        ->and($admin->is_active)->toBeFalse()
        ->and(Admin::query()->count())->toBe(1);
});

test('admin seeder refuses to create an admin outside local without a configured password', function (): void {
    Admin::query()->count();
    $this->app->detectEnvironment(fn (): string => 'production');
    config(['admin.seed.email' => 'admin@isac.com', 'admin.seed.password' => null]);

    app(AdminSeeder::class)->run();

    expect(Admin::query()->count())->toBe(0);
});

test('admin seeder uses the configured credentials in production', function (): void {
    Admin::query()->count();
    $this->app->detectEnvironment(fn (): string => 'production');
    config(['admin.seed.email' => 'ketua@isac.test', 'admin.seed.password' => 'Rahasia-Kuat-2026!']);

    app(AdminSeeder::class)->run();

    $admin = Admin::query()->where('email', 'ketua@isac.test')->firstOrFail();
    expect(Hash::check('Rahasia-Kuat-2026!', $admin->password))->toBeTrue()
        ->and(Hash::check('isacop@dmin123', $admin->password))->toBeFalse();
});
