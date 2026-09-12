<?php

use App\Models\BatchStatus;
use App\Models\Competition;
use App\Models\RegistrationStatus;
use App\Models\Team;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;

uses(LazilyRefreshDatabase::class);

test('bpc with legacy SEMIFINAL now creates WAITING_PAYMENT via runtime unify', function () {
    $team = Team::factory()->create();
    $token = $team->createToken('t')->plainTextToken;
    $c = Competition::factory()->create(['type' => Competition::TYPE_BUSINESS_PLAN, 'payment_flow' => Competition::PAYMENT_SEMIFINAL, 'status' => Competition::STATUS_REGISTRATION_OPEN]);
    $b = $c->batches()->create(['name' => 'Batch 1', 'slug' => 'b1-'.uniqid(), 'start_date' => now()->subDay(), 'end_date' => now()->addMonth(), 'price' => 70000, 'quota' => 10, 'status' => BatchStatus::OPEN]);
    $this->withToken($token)->putJson('/api/registrations/me/selection', ['competition_id' => $c->id])
        ->assertOk()->assertJsonPath('data.context.registration.status', RegistrationStatus::WAITING_PAYMENT->value);
    $reg = $team->fresh()->registration;
    expect($reg->status)->toBe(RegistrationStatus::WAITING_PAYMENT)->and($reg->payment_required_at)->not->toBeNull()->and($reg->payment_verified_at)->toBeNull();
});

test('bic also WAITING_PAYMENT', function () {
    $team = Team::factory()->create();
    $token = $team->createToken('t')->plainTextToken;
    $c = Competition::factory()->create(['type' => Competition::TYPE_BUSINESS_IT_CASE, 'payment_flow' => Competition::PAYMENT_SEMIFINAL, 'status' => Competition::STATUS_REGISTRATION_OPEN]);
    $b = $c->batches()->create(['name' => 'Batch 1', 'slug' => 'b1-'.uniqid(), 'start_date' => now()->subDay(), 'end_date' => now()->addMonth(), 'price' => 80000, 'quota' => 10, 'status' => BatchStatus::OPEN]);
    $this->withToken($token)->putJson('/api/registrations/me/selection', ['competition_id' => $c->id])
        ->assertOk()->assertJsonPath('data.context.registration.status', RegistrationStatus::WAITING_PAYMENT->value);
});

test('bpc with UPFRONT also WAITING_PAYMENT', function () {
    $team = Team::factory()->create();
    $token = $team->createToken('t')->plainTextToken;
    $c = Competition::factory()->create(['type' => Competition::TYPE_BUSINESS_PLAN, 'payment_flow' => Competition::PAYMENT_UPFRONT, 'status' => Competition::STATUS_REGISTRATION_OPEN]);
    $b = $c->batches()->create(['name' => 'Batch 1', 'slug' => 'b1-'.uniqid(), 'start_date' => now()->subDay(), 'end_date' => now()->addMonth(), 'price' => 70000, 'quota' => 10, 'status' => BatchStatus::OPEN]);
    $this->withToken($token)->putJson('/api/registrations/me/selection', ['competition_id' => $c->id])
        ->assertOk()->assertJsonPath('data.context.registration.status', RegistrationStatus::WAITING_PAYMENT->value);
});
