<?php

use App\Models\Admin;
use App\Models\BatchStatus;
use App\Models\Competition;
use App\Models\Exam;
use App\Models\ExamAnswer;
use App\Models\ExamAttempt;
use App\Models\ExamQuestion;
use App\Models\Registration;
use App\Models\RegistrationStatus;
use App\Models\Stage;
use App\Models\Team;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

uses(LazilyRefreshDatabase::class);

function createAutoSubmitContext(): array
{
    $team = Team::factory()->create(['email_verified_at' => now(), 'status' => Team::STATUS_VERIFIED]);
    $competition = Competition::factory()->create([
        'type' => Competition::TYPE_OLIMPIADE,
        'payment_flow' => Competition::PAYMENT_UPFRONT,
    ]);
    $batch = $competition->batches()->create([
        'name' => 'Batch '.Str::random(4),
        'slug' => 'batch-'.Str::random(6),
        'start_date' => now()->subDay(),
        'end_date' => now()->addMonth(),
        'price' => 60000,
        'status' => BatchStatus::OPEN,
    ]);
    $stage = Stage::query()->create([
        'id' => (string) Str::uuid(),
        'competition_id' => $competition->id,
        'name' => 'Elimination',
        'type' => 'exam',
        'order' => 1,
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
        'amount_paid' => 60000,
        'payment_submitted_at' => now(),
        'payment_verified_at' => now(),
    ]);
    $exam = Exam::query()->create([
        'id' => (string) Str::uuid(),
        'stage_id' => $stage->id,
        'title' => 'Ujian Auto Submit',
        'start_date' => now()->subHour(),
        'end_date' => now()->addHour(),
        'duration' => 30,
        'max_attempts' => 1,
        'type' => 'OLIMPIADE',
    ]);
    $questions = collect([1, 2])->map(fn (int $order): ExamQuestion => $exam->questions()->create([
        'id' => (string) Str::uuid(),
        'question' => "<p>Soal {$order}</p>",
        'type' => 'multiple_choice',
        'options' => [['id' => 'a', 'content' => '<p>A</p>'], ['id' => 'b', 'content' => '<p>B</p>']],
        'correct_answer' => 'a',
        'order' => $order,
        'correct_score' => 10,
        'wrong_score' => -2,
        'empty_score' => 0,
        'difficulty' => 'easy',
        'is_active' => true,
    ]));

    return [$team->fresh(), $stage, $exam, $questions];
}

function createAutoSubmitAttempt(Team $team, Exam $exam, array $overrides = []): ExamAttempt
{
    return ExamAttempt::query()->create(array_merge([
        'id' => (string) Str::uuid(),
        'team_id' => $team->id,
        'exam_id' => $exam->id,
        'total_score' => 0,
        'max_possible_score' => 20,
        'start_time' => now()->subMinutes(40),
        'end_time' => now()->subMinute(),
        'finished' => false,
        'flagged' => false,
        'cheat_count' => 0,
        'suspicious_score' => 0,
        'metadata' => [],
    ], $overrides));
}

function createAutoSubmitAnswer(ExamAttempt $attempt, ExamQuestion $question, int $score): void
{
    ExamAnswer::query()->create([
        'id' => (string) Str::uuid(),
        'attempt_id' => $attempt->id,
        'question_id' => $question->id,
        'selected_options' => [$score > 0 ? 'a' : 'b'],
        'is_correct' => $score > 0,
        'score_obtained' => $score,
        'answered_at' => now()->subMinutes(5),
    ]);
}

test('auto submit command finalizes an expired attempt with its saved score', function (): void {
    [$team, , $exam, $questions] = createAutoSubmitContext();
    $attempt = createAutoSubmitAttempt($team, $exam);
    createAutoSubmitAnswer($attempt, $questions[0], 10);
    createAutoSubmitAnswer($attempt, $questions[1], -2);

    $this->artisan('exam:auto-submit-expired')
        ->expectsOutput('Auto submitted 1 attempts.')
        ->assertSuccessful();

    $attempt->refresh();
    expect($attempt->finished)->toBeTrue()
        ->and($attempt->total_score)->toBe(8)
        ->and(DB::table('exam_event_logs')->where('attempt_id', $attempt->id)->where('type', 'auto_submitted')->count())->toBe(1);
});

test('questions left blank count their empty score when the attempt is auto submitted', function (): void {
    [$team, , $exam, $questions] = createAutoSubmitContext();
    $questions[1]->update(['empty_score' => -3]);
    $essay = $exam->questions()->create([
        'id' => (string) Str::uuid(),
        'question' => '<p>Esai</p>',
        'type' => 'essay',
        'correct_answer' => '<p>rubrik</p>',
        'order' => 3,
        'correct_score' => 10,
        'wrong_score' => 0,
        'empty_score' => -5,
        'difficulty' => 'easy',
        'is_active' => true,
    ]);
    $attempt = createAutoSubmitAttempt($team, $exam);
    createAutoSubmitAnswer($attempt, $questions[0], 10);

    $this->artisan('exam:auto-submit-expired')->assertSuccessful();

    expect($attempt->fresh()->total_score)->toBe(7)
        ->and($essay->empty_score)->toBe(-5);
});

test('questions left blank count their empty score when the participant submits', function (): void {
    [$team, , $exam, $questions] = createAutoSubmitContext();
    $questions[0]->update(['empty_score' => -2]);
    $questions[1]->update(['empty_score' => -1]);
    $attempt = createAutoSubmitAttempt($team, $exam, ['end_time' => now()->addMinutes(10)]);
    $token = $team->createToken('exam')->plainTextToken;

    $this->withToken($token)
        ->postJson("/api/dashboard/exams/{$exam->id}/attempts/{$attempt->id}/submit")
        ->assertOk()
        ->assertJsonPath('data.attempt.totalScore', -3);
});

test('a question cleared by the participant is not penalised twice', function (): void {
    [$team, , $exam, $questions] = createAutoSubmitContext();
    $questions[0]->update(['empty_score' => -2]);
    $questions[1]->update(['empty_score' => -1]);
    $attempt = createAutoSubmitAttempt($team, $exam, ['end_time' => now()->addMinutes(10)]);
    $token = $team->createToken('exam')->plainTextToken;

    $this->withToken($token)
        ->putJson("/api/dashboard/exams/{$exam->id}/attempts/{$attempt->id}/answers", [
            'answers' => [['question_id' => $questions[0]->id]],
        ])
        ->assertOk();

    $this->withToken($token)
        ->postJson("/api/dashboard/exams/{$exam->id}/attempts/{$attempt->id}/submit")
        ->assertOk()
        ->assertJsonPath('data.attempt.totalScore', -3);
});

test('auto submit command leaves a running attempt untouched', function (): void {
    [$team, , $exam, $questions] = createAutoSubmitContext();
    $attempt = createAutoSubmitAttempt($team, $exam, ['end_time' => now()->addMinutes(10)]);
    createAutoSubmitAnswer($attempt, $questions[0], 10);

    $this->artisan('exam:auto-submit-expired')
        ->expectsOutput('Auto submitted 0 attempts.')
        ->assertSuccessful();

    expect($attempt->fresh()->finished)->toBeFalse()
        ->and($attempt->fresh()->total_score)->toBe(0);
});

test('auto submit command never finalizes an attempt twice', function (): void {
    [$team, , $exam] = createAutoSubmitContext();
    $attempt = createAutoSubmitAttempt($team, $exam, ['finished' => true, 'total_score' => 5]);

    $this->artisan('exam:auto-submit-expired')
        ->expectsOutput('Auto submitted 0 attempts.')
        ->assertSuccessful();

    expect($attempt->fresh()->total_score)->toBe(5)
        ->and(DB::table('exam_event_logs')->where('attempt_id', $attempt->id)->count())->toBe(0);
});

test('resuming an expired attempt returns it already submitted', function (): void {
    [$team, , $exam, $questions] = createAutoSubmitContext();
    $attempt = createAutoSubmitAttempt($team, $exam);
    createAutoSubmitAnswer($attempt, $questions[0], 10);
    $token = $team->createToken('exam')->plainTextToken;

    $this->withToken($token)
        ->getJson("/api/dashboard/exams/{$exam->id}/attempts/{$attempt->id}")
        ->assertOk()
        ->assertJsonPath('data.attempt.finished', true)
        ->assertJsonPath('data.attempt.totalScore', 10);

    expect($attempt->fresh()->finished)->toBeTrue();
});

test('heartbeat on an expired attempt submits it instead of keeping it alive', function (): void {
    [$team, , $exam, $questions] = createAutoSubmitContext();
    $attempt = createAutoSubmitAttempt($team, $exam);
    createAutoSubmitAnswer($attempt, $questions[0], 10);
    $token = $team->createToken('exam')->plainTextToken;

    $this->withToken($token)
        ->postJson("/api/dashboard/exams/{$exam->id}/attempts/{$attempt->id}/heartbeat")
        ->assertOk();

    expect($attempt->fresh()->finished)->toBeTrue()
        ->and($attempt->fresh()->total_score)->toBe(10)
        ->and($attempt->fresh()->metadata)->not->toHaveKey('heartbeatAt');
});

test('saving answers after the deadline is rejected', function (): void {
    [$team, , $exam, $questions] = createAutoSubmitContext();
    $attempt = createAutoSubmitAttempt($team, $exam);
    $token = $team->createToken('exam')->plainTextToken;

    $this->withToken($token)
        ->putJson("/api/dashboard/exams/{$exam->id}/attempts/{$attempt->id}/answers", [
            'answers' => [['question_id' => $questions[0]->id, 'selected_options' => ['a']]],
        ])
        ->assertStatus(422);

    expect(ExamAnswer::query()->where('attempt_id', $attempt->id)->count())->toBe(0);
});

test('admin stage scores include attempts whose time ran out without a submit', function (): void {
    [$team, $stage, $exam, $questions] = createAutoSubmitContext();
    $attempt = createAutoSubmitAttempt($team, $exam);
    createAutoSubmitAnswer($attempt, $questions[0], 10);
    $admin = Admin::factory()->create(['role' => 'admin_registration', 'is_active' => true]);

    $response = $this->withToken($admin->createToken('scores')->plainTextToken)
        ->getJson("/api/admin/stages/{$stage->id}/scores")
        ->assertOk();

    $scores = collect($response->json('data.scores'))->keyBy('teamId');

    expect($scores[$team->id]['score'])->toBe(10)
        ->and($scores[$team->id]['finishedAttempts'])->toBe(1);
});

test('expired attempts are submitted by the scheduler every minute', function (): void {
    Artisan::call('schedule:list');

    expect(Artisan::output())->toContain('exam:auto-submit-expired')->toContain('* * * * *');
});
