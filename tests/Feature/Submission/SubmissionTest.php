<?php

use App\Models\BatchStatus;
use App\Models\Competition;
use App\Models\File;
use App\Models\Registration;
use App\Models\RegistrationStatus;
use App\Models\Stage;
use App\Models\Team;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Illuminate\Support\Str;

uses(LazilyRefreshDatabase::class);

function submissionContext(array $overrides = []): array
{
    $team = Team::factory()->create([
        'email_verified_at' => now(),
        'status' => Team::STATUS_VERIFIED,
    ]);

    $competition = Competition::factory()->create(array_merge([
        'type' => Competition::TYPE_BUSINESS_PLAN,
        'payment_flow' => Competition::PAYMENT_UPFRONT,
    ], $overrides['competition'] ?? []));

    $batch = $competition->batches()->create([
        'name' => 'Batch '.Str::random(4),
        'slug' => 'batch-'.Str::random(6),
        'start_date' => now()->subDay(),
        'end_date' => now()->addMonth(),
        'price' => 150000,
        'status' => BatchStatus::OPEN,
    ]);

    $stage = Stage::query()->create(array_merge([
        'id' => (string) Str::uuid(),
        'competition_id' => $competition->id,
        'name' => 'Preliminary',
        'type' => 'submission',
        'order' => 1,
        'start_date' => now()->subDay(),
        'end_date' => now()->addWeek(),
    ], $overrides['stage'] ?? []));

    $team->update(['current_stage_id' => $stage->id]);

    Registration::query()->create([
        'competition_id' => $competition->id,
        'batch_id' => $batch->id,
        'team_id' => $team->id,
        'status' => RegistrationStatus::VERIFIED,
        'team_completed_at' => now(),
        'members_completed_at' => now(),
        'documents_completed_at' => now(),
        'submitted_at' => now(),
        'payment_submitted_at' => now(),
        'payment_verified_at' => now(),
    ]);

    return [$team, $competition, $stage, $batch];
}

test('team can upsert draft when window open', function (): void {
    [$team, , $stage] = submissionContext();
    $token = $team->createToken('test')->plainTextToken;

    $file = File::create([
        'file_id' => 'file-'.Str::random(8),
        'url' => 'https://ik.imagekit.io/isac/submission.pdf',
        'purpose' => 'SUBMISSION',
        'uploaded_by' => $team->id,
    ]);

    $this->withToken($token)->postJson("/api/dashboard/stages/{$stage->id}/submission", [
        'title' => 'Karya Inovasi Smart City',
        'description' => 'Deskripsi karya',
        'file_id' => $file->id,
    ])->assertOk()
      ->assertJsonPath('data.title', 'Karya Inovasi Smart City')
      ->assertJsonPath('data.status', 'draft');

    $this->withToken($token)->postJson("/api/dashboard/stages/{$stage->id}/submission", [
        'title' => 'Karya Update',
        'file_id' => $file->id,
    ])->assertOk()
      ->assertJsonPath('data.title', 'Karya Update');
});

test('upsert fails when window closed', function (): void {
    [$team, , $stage] = submissionContext(['stage' => [
        'start_date' => now()->subWeeks(2),
        'end_date' => now()->subWeek(),
    ]]);
    $token = $team->createToken('test')->plainTextToken;

    $this->withToken($token)->postJson("/api/dashboard/stages/{$stage->id}/submission", [
        'title' => 'Karya Test',
    ])->assertStatus(422)
      ->assertJsonPath('error.details.window.0', 'Periode pengumpulan telah berakhir.');
});

test('upsert rejects foreign file', function (): void {
    [$team, , $stage] = submissionContext();
    $otherTeam = Team::factory()->create(['email_verified_at' => now(), 'status' => Team::STATUS_VERIFIED]);
    $token = $team->createToken('test')->plainTextToken;

    $foreign = File::create([
        'file_id' => 'file-'.Str::random(8),
        'url' => 'https://ik.imagekit.io/isac/other.pdf',
        'purpose' => 'SUBMISSION',
        'uploaded_by' => $otherTeam->id,
    ]);

    $this->withToken($token)->postJson("/api/dashboard/stages/{$stage->id}/submission", [
        'title' => 'Karya Test',
        'file_id' => $foreign->id,
    ])->assertStatus(422)
      ->assertJsonPath('error.details.file_id.0', 'File tidak valid atau bukan milik Team ini.');
});

test('submit requires file', function (): void {
    [$team, , $stage] = submissionContext();
    $token = $team->createToken('test')->plainTextToken;

    $this->withToken($token)->postJson("/api/dashboard/stages/{$stage->id}/submission", [
        'title' => 'Karya Tanpa File',
    ])->assertOk();

    $this->withToken($token)->postJson("/api/dashboard/stages/{$stage->id}/submission/submit")
        ->assertStatus(422)
        ->assertJsonPath('error.details.file_id.0', 'File wajib diunggah sebelum mengumpulkan.');
});

test('submit is idempotent with same Idempotency-Key', function (): void {
    [$team, , $stage] = submissionContext();
    $token = $team->createToken('test')->plainTextToken;

    $file = File::create([
        'file_id' => 'file-'.Str::random(8),
        'url' => 'https://ik.imagekit.io/isac/submission.pdf',
        'purpose' => 'SUBMISSION',
        'uploaded_by' => $team->id,
    ]);

    $this->withToken($token)->postJson("/api/dashboard/stages/{$stage->id}/submission", [
        'title' => 'Karya Idempotent',
        'file_id' => $file->id,
    ])->assertOk();

    $key = (string) Str::uuid();

    $first = $this->withToken($token)->withHeader('Idempotency-Key', $key)->postJson("/api/dashboard/stages/{$stage->id}/submission/submit")->assertOk()->json('data.id');
    $second = $this->withToken($token)->withHeader('Idempotency-Key', $key)->postJson("/api/dashboard/stages/{$stage->id}/submission/submit")->assertOk()->json('data.id');

    expect($first)->toBe($second);
});

test('unsubmit works when window open and not reviewed', function (): void {
    [$team, , $stage] = submissionContext();
    $token = $team->createToken('test')->plainTextToken;

    $file = File::create([
        'file_id' => 'file-'.Str::random(8),
        'url' => 'https://ik.imagekit.io/isac/submission.pdf',
        'purpose' => 'SUBMISSION',
        'uploaded_by' => $team->id,
    ]);

    $this->withToken($token)->postJson("/api/dashboard/stages/{$stage->id}/submission", [
        'title' => 'Karya Unsubmit',
        'file_id' => $file->id,
    ])->assertOk();

    $this->withToken($token)->postJson("/api/dashboard/stages/{$stage->id}/submission/submit")->assertOk()->assertJsonPath('data.status', 'submitted');

    $this->withToken($token)->postJson("/api/dashboard/stages/{$stage->id}/submission/unsubmit")->assertOk()->assertJsonPath('data.status', 'draft');
});
