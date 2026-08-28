<?php

use App\Models\BatchStatus;
use App\Models\Competition;
use App\Models\RegistrationStatus;
use App\Models\Registration;
use App\Models\Stage;
use App\Models\Submission;
use App\Models\Team;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;

uses(LazilyRefreshDatabase::class);

function createBatchForSubmission(Competition $competition, string $slug): mixed
{
    return $competition->batches()->create([
        'name' => 'Batch Test',
        'slug' => $slug,
        'start_date' => now()->subDay(),
        'end_date' => now()->addMonth(),
        'price' => 150000,
        'status' => BatchStatus::OPEN,
    ]);
}

test('submission shell returns direct collection data without payment fields for verified business team', function (): void {
    $team = Team::factory()->create([
        'email_verified_at' => now(),
        'status' => Team::STATUS_VERIFIED,
    ]);
    $competition = Competition::factory()->create([
        'type' => Competition::TYPE_BUSINESS_PLAN,
        'payment_flow' => Competition::PAYMENT_UPFRONT,
    ]);
    $batch = createBatchForSubmission($competition, 'direct-collection-batch-1');
    $stage = Stage::query()->create([
        'competition_id' => $competition->id,
        'name' => 'Preliminary',
        'type' => 'submission',
        'order' => 1,
        'start_date' => now()->subDay(),
        'end_date' => now()->addWeek(),
    ]);
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

    $token = $team->createToken('test')->plainTextToken;

    $this->withToken($token)->getJson("/api/dashboard/stages/{$stage->id}")
        ->assertOk()
        ->assertJsonPath('data.stage.id', $stage->id)
        // NEW CONTRACT: no payment fields
        ->assertJsonMissingPath('data.payment')
        ->assertJsonMissingPath('data.submissionLocked')
        // NEW FIELDS
        ->assertJsonPath('data.canSubmit', true)
        ->assertJsonPath('data.window.isOpen', true)
        ->assertJsonStructure([
            'data' => [
                'stage' => ['id', 'name', 'type', 'order', 'startDate', 'endDate'],
                'window' => ['isOpen', 'isOverdue', 'remainingMs', 'startDate', 'endDate'],
                'submission',
                'canSubmit',
                'competition',
                'batch',
            ],
        ]);
});

test('submission shell returns canSubmit false when window closed', function (): void {
    $team = Team::factory()->create([
        'email_verified_at' => now(),
        'status' => Team::STATUS_VERIFIED,
    ]);
    $competition = Competition::factory()->create([
        'type' => Competition::TYPE_BUSINESS_PLAN,
        'payment_flow' => Competition::PAYMENT_UPFRONT,
    ]);
    $batch = createBatchForSubmission($competition, 'direct-collection-batch-2');
    $stage = Stage::query()->create([
        'competition_id' => $competition->id,
        'name' => 'Preliminary Closed',
        'type' => 'submission',
        'order' => 1,
        'start_date' => now()->subWeeks(2),
        'end_date' => now()->subWeek(),
    ]);
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
    ]);

    $token = $team->createToken('test')->plainTextToken;

    $this->withToken($token)->getJson("/api/dashboard/stages/{$stage->id}")
        ->assertOk()
        ->assertJsonPath('data.window.isOpen', false)
        ->assertJsonPath('data.canSubmit', false);
});

test('submission shell includes existing submission when present', function (): void {
    $team = Team::factory()->create([
        'email_verified_at' => now(),
        'status' => Team::STATUS_VERIFIED,
    ]);
    $competition = Competition::factory()->create([
        'type' => Competition::TYPE_BUSINESS_IT_CASE,
        'payment_flow' => Competition::PAYMENT_UPFRONT,
    ]);
    $batch = createBatchForSubmission($competition, 'direct-collection-batch-3');
    $stage = Stage::query()->create([
        'competition_id' => $competition->id,
        'name' => 'Preliminary',
        'type' => 'submission',
        'order' => 1,
        'start_date' => now()->subDay(),
        'end_date' => now()->addWeek(),
    ]);
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
    ]);

    // Create a file for submission
    $file = \App\Models\File::create([
        'file_id' => 'test-file-'.uniqid(),
        'url' => 'https://ik.imagekit.io/isac/submission.pdf',
        'purpose' => 'SUBMISSION',
        'uploaded_by' => $team->id,
    ]);

    $submission = Submission::create([
        'team_id' => $team->id,
        'stage_id' => $stage->id,
        'title' => 'Karya Test',
        'description' => 'Deskripsi',
        'file_id' => $file->id,
        'status' => 'submitted',
        'submitted_at' => now(),
    ]);

    $token = $team->createToken('test')->plainTextToken;

    $this->withToken($token)->getJson("/api/dashboard/stages/{$stage->id}")
        ->assertOk()
        ->assertJsonPath('data.submission.id', $submission->id)
        ->assertJsonPath('data.submission.title', 'Karya Test')
        ->assertJsonPath('data.submission.status', 'submitted')
        ->assertJsonPath('data.canSubmit', true);
});
