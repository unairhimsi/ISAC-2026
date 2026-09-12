<?php

use App\Models\BatchStatus;
use App\Models\Competition;
use App\Models\Exam;
use App\Models\Registration;
use App\Models\RegistrationStatus;
use App\Models\Stage;
use App\Models\Team;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

uses(LazilyRefreshDatabase::class);

function createDetectionContext(): array
{
    $team = Team::factory()->create(['email_verified_at' => now(), 'status' => Team::STATUS_VERIFIED]);
    $competition = Competition::factory()->create(['type' => Competition::TYPE_OLIMPIADE]);
    $batch = $competition->batches()->create([
        'name' => 'Batch Det '.Str::random(4),
        'slug' => 'batch-det-'.Str::random(6),
        'start_date' => now()->subDay(),
        'end_date' => now()->addMonth(),
        'price' => 60000,
        'status' => BatchStatus::OPEN,
    ]);
    $stage = Stage::query()->create(['id' => (string) Str::uuid(), 'competition_id' => $competition->id, 'name' => 'Elim', 'type' => 'exam', 'order' => 1]);
    $team->update(['current_stage_id' => $stage->id]);
    Registration::query()->create([
        'competition_id' => $competition->id, 'batch_id' => $batch->id, 'team_id' => $team->id,
        'status' => RegistrationStatus::VERIFIED, 'team_completed_at' => now(), 'members_completed_at' => now(),
        'documents_completed_at' => now(), 'submitted_at' => now(), 'amount_paid' => 60000,
        'payment_submitted_at' => now(), 'payment_verified_at' => now(),
    ]);
    $exam = Exam::query()->create([
        'id' => (string) Str::uuid(), 'stage_id' => $stage->id, 'title' => 'Ujian Det',
        'start_date' => now()->subHour(), 'end_date' => now()->addHour(), 'duration' => 60, 'max_attempts' => 3, 'type' => 'OLIMPIADE',
    ]);
    $exam->questions()->create([
        'id' => (string) Str::uuid(), 'question' => '<p>Q</p>', 'type' => 'multiple_choice',
        'options' => [['id' => 'a', 'content' => '1']], 'correct_answer' => 'a', 'order' => 1, 'correct_score' => 10, 'is_active' => true,
    ]);

    return [$team, $exam];
}

test('tab switch increments suspiciousScore by 5', function (): void {
    [$team, $exam] = createDetectionContext();
    $token = $team->createToken('det')->plainTextToken;
    $attemptId = $this->withToken($token)->postJson("/api/dashboard/exams/{$exam->id}/attempts")->assertCreated()->json('data.attempt.id');

    $this->withToken($token)->postJson("/api/dashboard/exams/{$exam->id}/attempts/{$attemptId}/events", [
        'events' => [['type' => 'tab_switched', 'metadata' => [], 'client_at' => now()->toISOString()]],
    ])->assertOk()->assertJsonPath('data.suspiciousScore', 5)->assertJsonPath('data.flagged', false);

    expect((int) DB::table('exam_attempts')->where('id', $attemptId)->value('suspicious_score'))->toBe(5);
});

test('devtools opened twice flags attempt suspicious >=50', function (): void {
    [$team, $exam] = createDetectionContext();
    $token = $team->createToken('det')->plainTextToken;
    $attemptId = $this->withToken($token)->postJson("/api/dashboard/exams/{$exam->id}/attempts")->assertCreated()->json('data.attempt.id');

    $this->withToken($token)->postJson("/api/dashboard/exams/{$exam->id}/attempts/{$attemptId}/events", [
        'events' => [
            ['type' => 'devtools_opened', 'metadata' => []],
            ['type' => 'devtools_opened', 'metadata' => []],
        ],
    ])->assertOk()->assertJsonPath('data.suspiciousScore', 50)->assertJsonPath('data.flagged', true);
});

test('device drift adds 20 and can flag', function (): void {
    [$team, $exam] = createDetectionContext();
    $token = $team->createToken('det')->plainTextToken;
    $attemptId = $this->withToken($token)->postJson("/api/dashboard/exams/{$exam->id}/attempts", ['device_id' => 'device-A'])->assertCreated()->json('data.attempt.id');

    // send events with different device id -> drift
    $this->withToken($token)->postJson("/api/dashboard/exams/{$exam->id}/attempts/{$attemptId}/events", [
        'device_id' => 'device-B',
        'events' => [
            ['type' => 'tab_switched', 'metadata' => []],
            ['type' => 'tab_switched', 'metadata' => []],
            ['type' => 'tab_switched', 'metadata' => []],
        ],
    ])->assertOk();

    $score = (int) DB::table('exam_attempts')->where('id', $attemptId)->value('suspicious_score');
    // 3*5=15 +20 drift =35
    expect($score)->toBe(35);
});

test('paste attempted increments 15', function (): void {
    [$team, $exam] = createDetectionContext();
    $token = $team->createToken('det')->plainTextToken;
    $attemptId = $this->withToken($token)->postJson("/api/dashboard/exams/{$exam->id}/attempts")->assertCreated()->json('data.attempt.id');

    $this->withToken($token)->postJson("/api/dashboard/exams/{$exam->id}/attempts/{$attemptId}/events", [
        'events' => [['type' => 'paste_attempted', 'metadata' => []]],
    ])->assertOk()->assertJsonPath('data.suspiciousScore', 15);
});
