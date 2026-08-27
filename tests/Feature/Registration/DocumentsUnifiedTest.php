<?php

use App\Models\BatchStatus;
use App\Models\Competition;
use App\Models\Team;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;

uses(LazilyRefreshDatabase::class);

test('bpc documents does not auto-submit waiting_verification', function () {
    $team = Team::factory()->create();
    $token = $team->createToken('t')->plainTextToken;
    $c = Competition::factory()->create(['type' => Competition::TYPE_BUSINESS_PLAN, 'payment_flow' => Competition::PAYMENT_SEMIFINAL, 'status' => Competition::STATUS_REGISTRATION_OPEN]);
    $b = $c->batches()->create(['name' => 'B1', 'slug' => 'b1-'.uniqid(), 'start_date' => now()->subDay(), 'end_date' => now()->addMonth(), 'price' => 70000, 'quota' => 10, 'status' => BatchStatus::OPEN]);
    \App\Models\Registration::create(['team_id' => $team->id, 'competition_id' => $c->id, 'batch_id' => $b->id, 'status' => \App\Models\RegistrationStatus::WAITING_PAYMENT, 'team_completed_at' => now(), 'members_completed_at' => now(), 'payment_required_at' => now()]);
    $this->withToken($token)->putJson('/api/registrations/me/documents', ['document_url' => 'https://drive.google.com/drive/folders/doc', 'twibbon_url' => 'https://drive.google.com/drive/folders/twib'])->assertOk();
    $team->refresh();
    $reg = $team->registration;
    expect($reg->documents_completed_at)->not->toBeNull()->and($reg->submitted_at)->toBeNull()->and($team->status)->not->toBe(Team::STATUS_WAITING_VERIFICATION);
});

test('bic documents does not auto-submit', function () {
    $team = Team::factory()->create();
    $token = $team->createToken('t')->plainTextToken;
    $c = Competition::factory()->create(['type' => Competition::TYPE_BUSINESS_IT_CASE, 'payment_flow' => Competition::PAYMENT_SEMIFINAL, 'status' => Competition::STATUS_REGISTRATION_OPEN]);
    $b = $c->batches()->create(['name' => 'B1', 'slug' => 'b1-'.uniqid(), 'start_date' => now()->subDay(), 'end_date' => now()->addMonth(), 'price' => 80000, 'quota' => 10, 'status' => BatchStatus::OPEN]);
    \App\Models\Registration::create(['team_id' => $team->id, 'competition_id' => $c->id, 'batch_id' => $b->id, 'status' => \App\Models\RegistrationStatus::WAITING_PAYMENT, 'team_completed_at' => now(), 'members_completed_at' => now(), 'payment_required_at' => now()]);
    $this->withToken($token)->putJson('/api/registrations/me/documents', ['document_url' => 'https://drive.google.com/drive/folders/doc', 'twibbon_url' => 'https://drive.google.com/drive/folders/twib'])->assertOk();
    $team->refresh();
    $reg = $team->registration;
    expect($reg->documents_completed_at)->not->toBeNull()->and($reg->submitted_at)->toBeNull();
});

test('bpc redirect after documents is PAYMENT not DASHBOARD', function () {
    $team = Team::factory()->create();
    $token = $team->createToken('t')->plainTextToken;
    $c = Competition::factory()->create(['type' => Competition::TYPE_BUSINESS_PLAN, 'payment_flow' => Competition::PAYMENT_SEMIFINAL, 'status' => Competition::STATUS_REGISTRATION_OPEN]);
    $b = $c->batches()->create(['name' => 'B1', 'slug' => 'b1-'.uniqid(), 'start_date' => now()->subDay(), 'end_date' => now()->addMonth(), 'price' => 70000, 'quota' => 10, 'status' => BatchStatus::OPEN]);
    \App\Models\Registration::create(['team_id' => $team->id, 'competition_id' => $c->id, 'batch_id' => $b->id, 'status' => \App\Models\RegistrationStatus::WAITING_PAYMENT, 'team_completed_at' => now(), 'members_completed_at' => now(), 'payment_required_at' => now()]);
    $this->withToken($token)->putJson('/api/registrations/me/documents', ['document_url' => 'https://drive.google.com/drive/folders/doc', 'twibbon_url' => 'https://drive.google.com/drive/folders/twib'])
        ->assertOk()->assertJsonPath('data.redirectTo', '/registration/payment');
});
