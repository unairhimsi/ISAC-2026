<?php

use App\Models\BatchStatus;
use App\Models\Competition;
use App\Models\File;
use App\Models\Registration;
use App\Models\RegistrationStatus;
use App\Models\Team;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;

uses(LazilyRefreshDatabase::class);

test('bpc can submit payment same gate as olimpiade (legacy SEMIFINAL compat)', function () {
    $team = Team::factory()->create();
    $token = $team->createToken('t')->plainTextToken;
    $c = Competition::factory()->create(['type' => Competition::TYPE_BUSINESS_PLAN, 'payment_flow' => Competition::PAYMENT_SEMIFINAL, 'status' => Competition::STATUS_REGISTRATION_OPEN]);
    $b = $c->batches()->create(['name' => 'B1', 'slug' => 'b1-'.uniqid(), 'start_date' => now()->subDay(), 'end_date' => now()->addMonth(), 'price' => 70000, 'quota' => 10, 'status' => BatchStatus::OPEN]);
    $reg = Registration::create(['team_id' => $team->id, 'competition_id' => $c->id, 'batch_id' => $b->id, 'status' => RegistrationStatus::WAITING_PAYMENT, 'team_completed_at' => now(), 'members_completed_at' => now(), 'documents_completed_at' => now(), 'payment_required_at' => now()]);
    $file = File::create(['file_id' => 'proof-'.uniqid(), 'url' => 'https://ik.imagekit.io/isac/proof.jpg', 'uploaded_by' => $team->id, 'purpose' => 'PAYMENT_PROOF']);
    $this->withToken($token)->postJson('/api/registrations/me/payment', ['payment_proof_file_id' => $file->id, 'payment_method' => 'BANK_TRANSFER'])->assertOk()->assertJsonPath('data.context.registration.status', RegistrationStatus::WAITING_VERIFICATION->value);
});

test('bic can submit payment same gate', function () {
    $team = Team::factory()->create();
    $token = $team->createToken('t')->plainTextToken;
    $c = Competition::factory()->create(['type' => Competition::TYPE_BUSINESS_IT_CASE, 'payment_flow' => Competition::PAYMENT_SEMIFINAL, 'status' => Competition::STATUS_REGISTRATION_OPEN]);
    $b = $c->batches()->create(['name' => 'B1', 'slug' => 'b1-'.uniqid(), 'start_date' => now()->subDay(), 'end_date' => now()->addMonth(), 'price' => 80000, 'quota' => 10, 'status' => BatchStatus::OPEN]);
    $reg = Registration::create(['team_id' => $team->id, 'competition_id' => $c->id, 'batch_id' => $b->id, 'status' => RegistrationStatus::WAITING_PAYMENT, 'team_completed_at' => now(), 'members_completed_at' => now(), 'documents_completed_at' => now(), 'payment_required_at' => now()]);
    $file = File::create(['file_id' => 'proof-'.uniqid(), 'url' => 'https://ik.imagekit.io/isac/proof.jpg', 'uploaded_by' => $team->id, 'purpose' => 'PAYMENT_PROOF']);
    $this->withToken($token)->postJson('/api/registrations/me/payment', ['payment_proof_file_id' => $file->id, 'payment_method' => 'BANK_TRANSFER'])->assertOk();
});

test('submitForVerification requires payment for bpc too', function () {
    $team = Team::factory()->create();
    $token = $team->createToken('t')->plainTextToken;
    $c = Competition::factory()->create(['type' => Competition::TYPE_BUSINESS_PLAN, 'payment_flow' => Competition::PAYMENT_SEMIFINAL, 'status' => Competition::STATUS_REGISTRATION_OPEN]);
    $b = $c->batches()->create(['name' => 'B1', 'slug' => 'b1-'.uniqid(), 'start_date' => now()->subDay(), 'end_date' => now()->addMonth(), 'price' => 70000, 'quota' => 10, 'status' => BatchStatus::OPEN]);
    Registration::create(['team_id' => $team->id, 'competition_id' => $c->id, 'batch_id' => $b->id, 'status' => RegistrationStatus::WAITING_PAYMENT, 'team_completed_at' => now(), 'members_completed_at' => now(), 'documents_completed_at' => now(), 'payment_required_at' => now()]);
    $this->withToken($token)->postJson('/api/registrations/me/submit-verification')->assertUnprocessable()->assertJsonPath('error.details.payment.0', 'Lengkapi pembayaran terlebih dahulu.');
});

test('context for bpc after documents shows PAYMENT not DASHBOARD', function () {
    $team = Team::factory()->create();
    $token = $team->createToken('t')->plainTextToken;
    $c = Competition::factory()->create(['type' => Competition::TYPE_BUSINESS_PLAN, 'payment_flow' => Competition::PAYMENT_SEMIFINAL, 'status' => Competition::STATUS_REGISTRATION_OPEN]);
    $b = $c->batches()->create(['name' => 'B1', 'slug' => 'b1-'.uniqid(), 'start_date' => now()->subDay(), 'end_date' => now()->addMonth(), 'price' => 70000, 'quota' => 10, 'status' => BatchStatus::OPEN]);
    Registration::create(['team_id' => $team->id, 'competition_id' => $c->id, 'batch_id' => $b->id, 'status' => RegistrationStatus::WAITING_PAYMENT, 'team_completed_at' => now(), 'members_completed_at' => now(), 'documents_completed_at' => now(), 'payment_required_at' => now()]);
    $this->withToken($token)->getJson('/api/registrations/me/context')->assertOk()->assertJsonPath('data.currentStep', 'PAYMENT')->assertJsonPath('data.redirectTo', '/registration/payment');
});
