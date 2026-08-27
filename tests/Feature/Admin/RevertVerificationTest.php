<?php

use App\Models\Admin;
use App\Models\Batch;
use App\Models\BatchStatus;
use App\Models\Competition;
use App\Models\RegistrationStatus;
use App\Models\Team;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;

uses(LazilyRefreshDatabase::class);

test('admin can unverify verified team back to waiting_verification', function () {
    $admin = Admin::factory()->create(['role' => 'admin_registration', 'is_active' => true]);
    $team = Team::factory()->create(['status' => Team::STATUS_VERIFIED, 'verified_at' => now(), 'verified_by' => $admin->id]);
    $token = $admin->createToken('t')->plainTextToken;
    $this->withToken($token)->postJson("/api/admin/teams/{$team->id}/unverify", ['reason' => 'Koreksi data institusi'])
        ->assertOk()->assertJsonPath('data.team.status', Team::STATUS_WAITING_VERIFICATION);
    expect($team->fresh()->verified_at)->toBeNull()->and($team->fresh()->verification_note)->toBe('Koreksi data institusi');
    expect(\App\Models\AdminAuditLog::where('action', 'team.unverified')->exists())->toBeTrue();
});

test('unverify only allowed from VERIFIED', function () {
    $team = Team::factory()->create(['status' => Team::STATUS_WAITING_VERIFICATION]);
    $admin = Admin::factory()->create(['role' => 'admin_registration', 'is_active' => true]);
    $token = $admin->createToken('t')->plainTextToken;
    $this->withToken($token)->postJson("/api/admin/teams/{$team->id}/unverify")->assertUnprocessable();
});

test('admin can unverify verified payment back to waiting_verification', function () {
    $admin = Admin::factory()->create(['role' => 'admin_payment', 'is_active' => true]);
    $c = Competition::factory()->create(['type' => Competition::TYPE_BUSINESS_PLAN, 'payment_flow' => Competition::PAYMENT_UPFRONT]);
    $team = Team::factory()->create(['status' => Team::STATUS_VERIFIED]);
    $reg = \App\Models\Registration::create(['team_id' => $team->id, 'competition_id' => $c->id, 'batch_id' => Batch::factory()->create(['competition_id' => $c->id])->id, 'status' => RegistrationStatus::VERIFIED, 'payment_required_at' => now(), 'payment_submitted_at' => now(), 'payment_verified_at' => now(), 'paid_at' => now(), 'payment_verified_by' => $admin->id, 'amount_paid' => 70000]);
    $token = $admin->createToken('t')->plainTextToken;
    $this->withToken($token)->postJson("/api/admin/registrations/{$reg->id}/payment/unverify", ['reason' => 'Bukti blur'])->assertOk()->assertJsonPath('data.status', 'WAITING_VERIFICATION');
    expect($reg->fresh()->payment_verified_at)->toBeNull()->and($reg->fresh()->paid_at)->toBeNull();
});

test('policy: admin_payment cannot unverify team', function () {
    $team = Team::factory()->create(['status' => Team::STATUS_VERIFIED]);
    $payAdmin = Admin::factory()->create(['role' => 'admin_payment', 'is_active' => true]);
    $this->withToken($payAdmin->createToken('t')->plainTextToken)->postJson("/api/admin/teams/{$team->id}/unverify")->assertForbidden();
});

test('policy: admin_registration cannot unverify payment', function () {
    $admin2 = Admin::factory()->create(['role' => 'admin_payment', 'is_active' => true]);
    $c = Competition::factory()->create(['type' => Competition::TYPE_BUSINESS_PLAN, 'payment_flow' => Competition::PAYMENT_UPFRONT]);
    $regTeam = Team::factory()->create(['status' => Team::STATUS_VERIFIED]);
    $reg = \App\Models\Registration::create(['team_id' => $regTeam->id, 'competition_id' => $c->id, 'batch_id' => Batch::factory()->create(['competition_id' => $c->id])->id, 'status' => RegistrationStatus::VERIFIED, 'payment_required_at' => now(), 'payment_submitted_at' => now(), 'payment_verified_at' => now(), 'paid_at' => now(), 'payment_verified_by' => $admin2->id, 'amount_paid' => 70000]);
    $regAdmin = Admin::factory()->create(['role' => 'admin_registration', 'is_active' => true]);
    $this->withToken($regAdmin->createToken('t')->plainTextToken)->postJson("/api/admin/registrations/{$reg->id}/payment/unverify", ['reason' => 'test'])->assertForbidden();
});
