<?php

use App\Models\Admin;
use App\Models\Team;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;

uses(LazilyRefreshDatabase::class);

dataset('principals', [
    'admin' => [fn () => Admin::factory()->create([
        'email' => 'session.user@isac.com',
        'password' => 'SessionPass123!',
        'is_active' => true,
    ])],
    'team' => [fn () => Team::factory()->create([
        'email' => 'session.user@isac.com',
        'password' => 'SessionPass123!',
        'email_verified_at' => now(),
    ])],
]);

function loginToken(): string
{
    return test()->postJson('/api/auth/login', [
        'email' => 'session.user@isac.com',
        'password' => 'SessionPass123!',
    ])->assertOk()->json('data.token');
}

function meAs(string $token): Illuminate\Testing\TestResponse
{
    // Guard Sanctum menyimpan user hasil resolve; reset agar tiap request memvalidasi token lagi.
    app('auth')->forgetGuards();

    return test()->withToken($token)->getJson('/api/auth/me');
}

test('one account can stay logged in on many devices', function (Closure $makePrincipal): void {
    $principal = $makePrincipal();

    $laptop = loginToken();
    $phone = loginToken();
    $tablet = loginToken();

    expect($principal->tokens()->count())->toBe(3);

    meAs($laptop)->assertOk();
    meAs($phone)->assertOk();
    meAs($tablet)->assertOk();
})->with('principals');

test('logout only revokes the session that pressed it', function (Closure $makePrincipal): void {
    $makePrincipal();

    $laptop = loginToken();
    $phone = loginToken();

    app('auth')->forgetGuards();
    $this->withToken($laptop)->postJson('/api/auth/logout')->assertOk();

    meAs($laptop)->assertUnauthorized();
    meAs($phone)->assertOk();
})->with('principals');

test('login prunes only tokens idle longer than the configured days', function (Closure $makePrincipal): void {
    config(['sanctum.idle_days' => 30]);
    $principal = $makePrincipal();

    $idle = $principal->createToken('idle');
    $idle->accessToken->forceFill(['last_used_at' => now()->subDays(40)])->save();

    $neverUsedOld = $principal->createToken('never-used-old');
    $neverUsedOld->accessToken->forceFill(['created_at' => now()->subDays(40)])->save();

    $recent = $principal->createToken('recent');
    $recent->accessToken->forceFill(['last_used_at' => now()->subDays(1)])->save();

    loginToken();

    $names = $principal->tokens()->pluck('name')->all();
    expect($names)->toContain('recent', 'auth-token')
        ->not->toContain('idle')
        ->not->toContain('never-used-old');
})->with('principals');

test('idle token pruning can be disabled', function (Closure $makePrincipal): void {
    config(['sanctum.idle_days' => 0]);
    $principal = $makePrincipal();

    $idle = $principal->createToken('idle');
    $idle->accessToken->forceFill(['last_used_at' => now()->subDays(400)])->save();

    loginToken();

    expect($principal->tokens()->pluck('name')->all())->toContain('idle', 'auth-token');
})->with('principals');

test('revoked or invalid tokens get the UNAUTHENTICATED code the frontend relies on', function (): void {
    meAs('999|not-a-real-token')
        ->assertUnauthorized()
        ->assertJsonPath('status', 'error')
        ->assertJsonPath('error.code', 'UNAUTHENTICATED');
});
