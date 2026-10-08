<?php

use App\Models\Batch;
use App\Models\BatchStatus;
use App\Models\Competition;
use App\Models\Team;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Illuminate\Support\Str;

uses(LazilyRefreshDatabase::class);

test('selecting OLIMPIADE does not bind a batch or consume quota', function (): void {
    $team = Team::factory()->create();
    $competition = Competition::factory()->create([
        'status' => Competition::STATUS_REGISTRATION_OPEN,
        'type' => Competition::TYPE_OLIMPIADE,
    ]);
    $batch = $competition->batches()->create([
        'name' => 'Batch 1', 'slug' => 'batch-1',
        'start_date' => now(), 'end_date' => now()->addMonth(),
        'price' => 100000, 'quota' => 50, 'current_registrations' => 0,
        'status' => BatchStatus::OPEN,
    ]);

    $this->withToken($team->createToken('auth-token')->plainTextToken)
        ->putJson('/api/registrations/me/selection', [
            'competition_id' => $competition->id,
        ])
        ->assertOk()
        ->assertJsonPath('status', 'success')
        ->assertJsonPath('data.context.registration.status', 'WAITING_PAYMENT')
        ->assertJsonPath('data.context.registration.competition.id', $competition->id)
        ->assertJsonPath('data.context.registration.batch', null)
        ->assertJsonPath('data.redirectTo', '/registration/team');

    $this->assertDatabaseHas('registrations', [
        'team_id' => $team->id,
        'competition_id' => $competition->id,
        'batch_id' => null,
    ]);
    expect($batch->fresh()->current_registrations)->toBe(0);
});

test('business competition registration stays unbatched until payment', function (string $competitionType): void {
    // UNIFIED: all competitions now UPFRONT, same as OLIMPIADE (no DB change but runtime unify)
    $team = Team::factory()->create();
    $competition = Competition::factory()->create([
        'status' => Competition::STATUS_REGISTRATION_OPEN,
        'type' => $competitionType,
        'payment_flow' => Competition::PAYMENT_UPFRONT,
    ]);
    $competition->batches()->create([
        'name' => 'Batch 1', 'slug' => 'batch-1',
        'start_date' => now()->subDay(), 'end_date' => now()->addMonth(),
        'price' => 70000, 'quota' => 50, 'current_registrations' => 0,
        'status' => BatchStatus::OPEN,
    ]);
    $competition->batches()->create([
        'name' => 'Batch 2', 'slug' => 'batch-2',
        'start_date' => now(), 'end_date' => now()->addMonth(),
        'price' => 90000, 'quota' => 50, 'current_registrations' => 0,
        'status' => BatchStatus::OPEN,
    ]);

    $this->withToken($team->createToken('auth-token')->plainTextToken)
        ->putJson('/api/registrations/me/selection', [
            'competition_id' => $competition->id,
        ])
        ->assertOk()
        ->assertJsonPath('data.context.registration.status', 'WAITING_PAYMENT')
        ->assertJsonPath('data.context.registration.batch', null)
        ->assertJsonPath('data.context.registration.paymentRequiredAt', fn ($value) => $value !== null)
        ->assertJsonPath('data.redirectTo', '/registration/team');

    $this->assertDatabaseHas('registrations', [
        'team_id' => $team->id,
        'competition_id' => $competition->id,
        'batch_id' => null,
        'status' => 'WAITING_PAYMENT',
    ]);
    expect(Batch::query()->sum('current_registrations'))->toBe(0);
})->with([
    Competition::TYPE_BUSINESS_PLAN,
    Competition::TYPE_BUSINESS_IT_CASE,
]);

test('team cannot select competition when batch is full', function (): void {
    $team = Team::factory()->create();
    $competition = Competition::factory()->create(['status' => Competition::STATUS_REGISTRATION_OPEN]);
    $batch = $competition->batches()->create([
        'name' => 'Batch 1', 'slug' => 'batch-1',
        'start_date' => now(), 'end_date' => now()->addMonth(),
        'price' => 100000, 'quota' => 5, 'current_registrations' => 5,
        'status' => BatchStatus::OPEN,
    ]);

    $this->withToken($team->createToken('auth-token')->plainTextToken)
        ->putJson('/api/registrations/me/selection', [
            'competition_id' => $competition->id,
        ])
        ->assertUnprocessable();
});

test('selecting the same competition twice is idempotent and never consumes quota', function (): void {
    $team = Team::factory()->create();
    $competition = Competition::factory()->create(['status' => Competition::STATUS_REGISTRATION_OPEN]);
    $batch = $competition->batches()->create([
        'name' => 'Batch 1', 'slug' => 'batch-1',
        'start_date' => now(), 'end_date' => now()->addMonth(),
        'price' => 100000, 'quota' => 50, 'status' => BatchStatus::OPEN,
    ]);
    $payload = ['competition_id' => $competition->id];
    $token = $team->createToken('auth-token')->plainTextToken;

    $this->withToken($token)->putJson('/api/registrations/me/selection', $payload)->assertOk();
    $this->withToken($token)->putJson('/api/registrations/me/selection', $payload)->assertOk();

    expect($team->registration()->count())->toBe(1);
    expect($batch->fresh()->current_registrations)->toBe(0);
});

test('selection requires authentication', function (): void {
    $this->putJson('/api/registrations/me/selection', [
        'competition_id' => (string) Str::uuid(),
    ])->assertUnauthorized();
});
