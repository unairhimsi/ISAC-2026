<?php

use App\Models\Admin;
use App\Models\Competition;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;

uses(LazilyRefreshDatabase::class);

test('new business plan with SEMIFINAL now rejected (soft-unify)', function () {
    $admin = Admin::factory()->create(['role' => 'super_admin', 'is_active' => true]);
    $token = $admin->createToken('t')->plainTextToken;
    $this->withToken($token)->postJson('/api/admin/competitions', [
        'name' => 'BPC Soft Unified',
        'slug' => 'bpc-soft-'.uniqid(),
        'description' => 'desc',
        'type' => Competition::TYPE_BUSINESS_PLAN,
        'payment_flow' => Competition::PAYMENT_SEMIFINAL,
        'start_date' => '2026-08-26',
        'end_date' => '2026-11-22',
        'status' => 'DRAFT',
    ])->assertUnprocessable()->assertJsonPath('error.details.payment_flow.0', 'BUSINESS_PLAN dan BUSINESS_IT_CASE harus menggunakan payment flow UPFRONT.');
});

test('existing SEMIFINAL competition stays readable via GET', function () {
    $c = Competition::factory()->create(['type' => Competition::TYPE_BUSINESS_PLAN, 'payment_flow' => Competition::PAYMENT_SEMIFINAL, 'status' => 'REGISTRATION_OPEN']);
    $this->getJson("/api/competitions/{$c->id}")->assertOk()->assertJsonPath('data.paymentFlow', 'SEMIFINAL'); // legacy read allowed
});

test('new business plan with UPFRONT succeeds', function () {
    $admin = Admin::factory()->create(['role' => 'super_admin', 'is_active' => true]);
    $token = $admin->createToken('t')->plainTextToken;
    $this->withToken($token)->postJson('/api/admin/competitions', [
        'name' => 'BPC UPFRONT OK',
        'slug' => 'bpc-up-'.uniqid(),
        'description' => 'desc',
        'type' => Competition::TYPE_BUSINESS_PLAN,
        'payment_flow' => Competition::PAYMENT_UPFRONT,
        'start_date' => '2026-08-26',
        'end_date' => '2026-11-22',
        'status' => 'DRAFT',
    ])->assertCreated();
});

test('new business it case with SEMIFINAL also rejected', function () {
    $admin = Admin::factory()->create(['role' => 'super_admin', 'is_active' => true]);
    $token = $admin->createToken('t')->plainTextToken;
    $this->withToken($token)->postJson('/api/admin/competitions', [
        'name' => 'BIC Soft Unified',
        'slug' => 'bic-soft-'.uniqid(),
        'description' => 'desc',
        'type' => Competition::TYPE_BUSINESS_IT_CASE,
        'payment_flow' => Competition::PAYMENT_SEMIFINAL,
        'start_date' => '2026-08-26',
        'end_date' => '2026-11-22',
        'status' => 'DRAFT',
    ])->assertUnprocessable();
});
