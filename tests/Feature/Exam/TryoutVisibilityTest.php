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

function createTryoutContext(string $type): array
{
    $team = Team::factory()->create(['email_verified_at' => now(), 'status' => Team::STATUS_VERIFIED]);
    $competition = Competition::factory()->create(['type' => Competition::TYPE_OLIMPIADE]);
    $batch = $competition->batches()->create([
        'name' => 'Batch '.Str::random(4),
        'slug' => 'batch-'.Str::random(6),
        'start_date' => now()->subDay(),
        'end_date' => now()->addMonth(),
        'price' => 60000,
        'status' => BatchStatus::OPEN,
    ]);
    $stage = Stage::query()->create(['id' => (string) Str::uuid(), 'competition_id' => $competition->id, 'name' => 'Tryout', 'type' => 'exam', 'order' => 1]);
    $team->update(['current_stage_id' => $stage->id]);
    Registration::query()->create([
        'competition_id' => $competition->id, 'batch_id' => $batch->id, 'team_id' => $team->id,
        'status' => RegistrationStatus::VERIFIED, 'team_completed_at' => now(), 'members_completed_at' => now(),
        'documents_completed_at' => now(), 'submitted_at' => now(), 'amount_paid' => 60000,
        'payment_submitted_at' => now(), 'payment_verified_at' => now(),
    ]);
    $exam = Exam::query()->create([
        'id' => (string) Str::uuid(), 'stage_id' => $stage->id, 'title' => 'Ujian '.$type,
        'start_date' => now()->subHour(), 'end_date' => now()->addHour(), 'duration' => 60, 'max_attempts' => 1, 'type' => $type,
    ]);
    $exam->questions()->create([
        'id' => (string) Str::uuid(), 'question' => '<p>Q tryout</p>', 'explanation' => '<p>Pembahasan tryout</p>', 'type' => 'multiple_choice',
        'options' => [['id' => 'a', 'content' => 'A'], ['id' => 'b', 'content' => 'B']], 'correct_answer' => 'a', 'order' => 1, 'correct_score' => 10, 'is_active' => true,
    ]);

    return [$team, $exam];
}

test('tryout finished exposes correctAnswer and explanation', function () {
    [$team, $exam] = createTryoutContext('tryout');
    $token = $team->createToken('t')->plainTextToken;
    $attemptId = $this->withToken($token)->postJson("/api/dashboard/exams/{$exam->id}/attempts")->assertCreated()->json('data.attempt.id');
    DB::table('exam_attempts')->where('id', $attemptId)->update(['finished' => true]);
    $res = $this->withToken($token)->getJson("/api/dashboard/exams/{$exam->id}/attempts/{$attemptId}")->assertOk();
    expect($res->json('data.questions.0'))->toHaveKey('correctAnswer');
});

test('olimpiade finished does not expose correctAnswer', function () {
    [$team, $exam] = createTryoutContext('OLIMPIADE');
    $token = $team->createToken('t')->plainTextToken;
    $attemptId = $this->withToken($token)->postJson("/api/dashboard/exams/{$exam->id}/attempts")->assertCreated()->json('data.attempt.id');
    DB::table('exam_attempts')->where('id', $attemptId)->update(['finished' => true]);
    $res = $this->withToken($token)->getJson("/api/dashboard/exams/{$exam->id}/attempts/{$attemptId}")->assertOk();
    expect($res->json('data.questions.0'))->not->toHaveKey('correctAnswer');
});

test('tryout unfinished does not expose correctAnswer', function () {
    [$team, $exam] = createTryoutContext('tryout');
    $token = $team->createToken('t')->plainTextToken;
    $attemptId = $this->withToken($token)->postJson("/api/dashboard/exams/{$exam->id}/attempts")->assertCreated()->json('data.attempt.id');
    $res = $this->withToken($token)->getJson("/api/dashboard/exams/{$exam->id}/attempts/{$attemptId}")->assertOk();
    expect($res->json('data.questions.0'))->not->toHaveKey('correctAnswer');
});

test('tryout finished exposes explanation', function () {
    [$team, $exam] = createTryoutContext('tryout');
    $token = $team->createToken('t')->plainTextToken;
    $attemptId = $this->withToken($token)->postJson("/api/dashboard/exams/{$exam->id}/attempts")->assertCreated()->json('data.attempt.id');
    DB::table('exam_attempts')->where('id', $attemptId)->update(['finished' => true]);
    $res = $this->withToken($token)->getJson("/api/dashboard/exams/{$exam->id}/attempts/{$attemptId}")->assertOk();
    $q = $res->json('data.questions.0');
    expect($q['explanation'])->not->toBeNull();
});
