<?php

use App\Models\Admin;
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

test('olimpiade participant never receives the score of an attempt', function () {
    [$team, $exam] = createTryoutContext('OLIMPIADE');
    $token = $team->createToken('t')->plainTextToken;

    $started = $this->withToken($token)->postJson("/api/dashboard/exams/{$exam->id}/attempts")->assertCreated();
    $attemptId = $started->json('data.attempt.id');
    expect($started->json('data.attempt'))->toHaveKey('totalScore')
        ->and($started->json('data.attempt.totalScore'))->toBeNull();

    $this->withToken($token)->postJson("/api/dashboard/exams/{$exam->id}/attempts/{$attemptId}/submit")
        ->assertOk()
        ->assertJsonPath('data.attempt.totalScore', null)
        ->assertJsonPath('data.attempt.maxPossibleScore', 10);

    $this->withToken($token)->getJson("/api/dashboard/exams/{$exam->id}/attempts/{$attemptId}")
        ->assertOk()
        ->assertJsonPath('data.attempt.totalScore', null);

    expect(DB::table('exam_attempts')->where('id', $attemptId)->value('total_score'))->toBe(0);
});

test('tryout participant receives the score of a finished attempt', function () {
    [$team, $exam] = createTryoutContext('tryout');
    $token = $team->createToken('t')->plainTextToken;
    $attemptId = $this->withToken($token)->postJson("/api/dashboard/exams/{$exam->id}/attempts")->assertCreated()->json('data.attempt.id');

    $this->withToken($token)->postJson("/api/dashboard/exams/{$exam->id}/attempts/{$attemptId}/submit")
        ->assertOk()
        ->assertJsonPath('data.attempt.totalScore', 0)
        ->assertJsonPath('data.attempt.maxPossibleScore', 10);
});

test('admin still sees the score of an olimpiade attempt', function () {
    [$team, $exam] = createTryoutContext('OLIMPIADE');
    $teamToken = $team->createToken('t')->plainTextToken;
    $attemptId = $this->withToken($teamToken)->postJson("/api/dashboard/exams/{$exam->id}/attempts")->assertCreated()->json('data.attempt.id');
    $this->withToken($teamToken)->postJson("/api/dashboard/exams/{$exam->id}/attempts/{$attemptId}/submit")->assertOk();
    $admin = Admin::factory()->create(['role' => 'super_admin', 'is_active' => true]);

    $res = $this->withToken($admin->createToken('a')->plainTextToken)->getJson("/api/admin/exams/{$exam->id}/attempts")->assertOk();

    expect($res->json('data.data.0.totalScore'))->toBe(0)
        ->and($res->json('data.data.0.maxPossibleScore'))->toBe(10);
});

test('exam shell reports the latest attempt of the team so the client can resume it', function () {
    [$team, $exam] = createTryoutContext('OLIMPIADE');
    $token = $team->createToken('t')->plainTextToken;

    $this->withToken($token)->getJson("/api/dashboard/exams/{$exam->id}")->assertOk()->assertJsonPath('data.attempt', null);

    $attemptId = $this->withToken($token)->postJson("/api/dashboard/exams/{$exam->id}/attempts")->assertCreated()->json('data.attempt.id');
    $this->withToken($token)->getJson("/api/dashboard/exams/{$exam->id}")
        ->assertJsonPath('data.attempt.id', $attemptId)
        ->assertJsonPath('data.attempt.finished', false);

    $this->withToken($token)->postJson("/api/dashboard/exams/{$exam->id}/attempts/{$attemptId}/submit")->assertOk();
    $this->withToken($token)->getJson("/api/dashboard/exams/{$exam->id}")
        ->assertJsonPath('data.attempt.id', $attemptId)
        ->assertJsonPath('data.attempt.finished', true);
});

test('exam shell prefers an unfinished attempt over a newer finished one', function () {
    [$team, $exam] = createTryoutContext('tryout');
    $token = $team->createToken('t')->plainTextToken;
    $row = fn (string $id, bool $finished, string $createdAt): array => [
        'id' => $id, 'team_id' => $team->id, 'exam_id' => $exam->id, 'total_score' => 0, 'max_possible_score' => 10,
        'start_time' => now()->subHour(), 'end_time' => now()->addHour(), 'finished' => $finished, 'flagged' => false,
        'created_at' => $createdAt, 'updated_at' => $createdAt,
    ];
    $unfinished = (string) Str::uuid();
    DB::table('exam_attempts')->insert([
        $row($unfinished, false, now()->subMinutes(30)->toDateTimeString()),
        $row((string) Str::uuid(), true, now()->subMinutes(5)->toDateTimeString()),
    ]);

    $this->withToken($token)->getJson("/api/dashboard/exams/{$exam->id}")
        ->assertOk()
        ->assertJsonPath('data.attempt.id', $unfinished)
        ->assertJsonPath('data.attempt.finished', false);
});

test('exam shell exposes tryout type so the client can review answers', function () {
    [$team, $exam] = createTryoutContext('tryout');
    $token = $team->createToken('t')->plainTextToken;
    $this->withToken($token)->getJson("/api/dashboard/exams/{$exam->id}")->assertOk()->assertJsonPath('data.exam.type', 'tryout');
});

test('exam shell exposes olimpiade type so the client hides answers', function () {
    [$team, $exam] = createTryoutContext('OLIMPIADE');
    $token = $team->createToken('t')->plainTextToken;
    $this->withToken($token)->getJson("/api/dashboard/exams/{$exam->id}")->assertOk()->assertJsonPath('data.exam.type', 'OLIMPIADE');
});
