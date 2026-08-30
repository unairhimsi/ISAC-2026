<?php

use App\Models\Admin;
use App\Models\Batch;
use App\Models\BatchStatus;
use App\Models\Competition;
use App\Models\Registration;
use App\Models\RegistrationStatus;
use App\Models\Stage;
use App\Models\Team;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;

uses(LazilyRefreshDatabase::class);

test('advanceStage to semifinal no longer triggers waiting_payment (compat)', function () {
    $c = Competition::factory()->create(['type' => Competition::TYPE_BUSINESS_PLAN, 'payment_flow' => Competition::PAYMENT_SEMIFINAL, 'status' => Competition::STATUS_REGISTRATION_OPEN]);
    $batch = Batch::factory()->create(['competition_id' => $c->id, 'status' => BatchStatus::OPEN]);
    $team = Team::factory()->create(['status' => Team::STATUS_VERIFIED]);
    $reg = Registration::create(['team_id' => $team->id, 'competition_id' => $c->id, 'batch_id' => $batch->id, 'status' => RegistrationStatus::VERIFIED, 'team_completed_at' => now(), 'members_completed_at' => now(), 'documents_completed_at' => now(), 'submitted_at' => now(), 'payment_submitted_at' => now(), 'payment_required_at' => now(), 'paid_at' => now()]);
    $team->update(['current_stage_id' => Stage::create(['competition_id' => $c->id, 'name' => 'Preliminary', 'type' => 'submission', 'order' => 1, 'is_active' => true])->id]);
    $semifinal = Stage::create(['competition_id' => $c->id, 'name' => 'Semifinal', 'type' => 'submission', 'order' => 2, 'is_active' => true]);
    $admin = Admin::factory()->create(['role' => 'super_admin', 'is_active' => true]);
    $token = $admin->createToken('a')->plainTextToken;
    $this->withToken($token)->postJson("/api/admin/teams/{$team->id}/stages/{$semifinal->id}/advance")->assertOk();
    $reg = $reg->fresh();
    expect($reg->status)->toBe(RegistrationStatus::VERIFIED)->and($reg->payment_for_stage_id)->toBeNull()->and($team->fresh()->current_stage_id)->toBe($semifinal->id);
});

test('paymentQuery includes legacy SEMIFINAL BPC waiting_payment', function () {
    $c = Competition::factory()->create(['type' => Competition::TYPE_BUSINESS_PLAN, 'payment_flow' => Competition::PAYMENT_SEMIFINAL]);
    $team = Team::factory()->create();
    $reg = Registration::create(['team_id' => $team->id, 'competition_id' => $c->id, 'batch_id' => Batch::factory()->create(['competition_id' => $c->id])->id, 'status' => RegistrationStatus::WAITING_PAYMENT, 'payment_required_at' => now()]);
    $admin = Admin::factory()->create(['role' => 'super_admin', 'is_active' => true]);
    $token = $admin->createToken('a')->plainTextToken;
    $this->withToken($token)->getJson('/api/admin/payments?per_page=100')->assertOk()->assertJsonPath('data.data.0.registrationId', $reg->id);
});

test('advanceStage for olimpiade also just advances stage', function () {
    $c = Competition::factory()->create(['type' => Competition::TYPE_OLIMPIADE, 'payment_flow' => Competition::PAYMENT_UPFRONT, 'status' => Competition::STATUS_REGISTRATION_OPEN]);
    $batch = Batch::factory()->create(['competition_id' => $c->id, 'status' => BatchStatus::OPEN]);
    $team = Team::factory()->create(['status' => Team::STATUS_VERIFIED]);
    $reg = Registration::create(['team_id' => $team->id, 'competition_id' => $c->id, 'batch_id' => $batch->id, 'status' => RegistrationStatus::VERIFIED, 'team_completed_at' => now(), 'members_completed_at' => now(), 'documents_completed_at' => now(), 'submitted_at' => now(), 'payment_submitted_at' => now(), 'payment_required_at' => now(), 'paid_at' => now()]);
    $team->update(['current_stage_id' => Stage::create(['competition_id' => $c->id, 'name' => 'Preliminary', 'type' => 'exam', 'order' => 1, 'is_active' => true])->id]);
    $semifinal = Stage::create(['competition_id' => $c->id, 'name' => 'Semifinal', 'type' => 'exam', 'order' => 2, 'is_active' => true]);
    $admin = Admin::factory()->create(['role' => 'super_admin', 'is_active' => true]);
    $token = $admin->createToken('a')->plainTextToken;
    $this->withToken($token)->postJson("/api/admin/teams/{$team->id}/stages/{$semifinal->id}/advance")->assertOk();
    expect($team->fresh()->current_stage_id)->toBe($semifinal->id);
});
