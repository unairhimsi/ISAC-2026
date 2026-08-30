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

function createExamTeamContext(array $overrides = []): array
{
    $team = Team::factory()->create([
        'email_verified_at' => now(),
        'status' => Team::STATUS_VERIFIED,
    ]);
    $competition = Competition::factory()->create([
        'type' => Competition::TYPE_OLIMPIADE,
        'payment_flow' => Competition::PAYMENT_UPFRONT,
    ]);
    $batch = $competition->batches()->create([
        'name' => 'Batch Test '.Str::random(4),
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

    $exam = Exam::query()->create(array_merge([
        'id' => (string) Str::uuid(),
        'stage_id' => $stage->id,
        'title' => 'Ujian Eliminasi Test',
        'description' => 'Desc',
        'start_date' => now()->subHour(),
        'end_date' => now()->addHour(),
        'duration' => 60,
        'max_attempts' => 1,
        'shuffle_questions' => true,
        'shuffle_options' => false,
        'show_result_immediately' => true,
        'type' => 'OLIMPIADE',
    ], $overrides['exam'] ?? []));

    // create 2 active questions
    $q1 = $exam->questions()->create([
        'id' => (string) Str::uuid(),
        'question' => '<p>Soal 1 binary search?</p>',
        'type' => 'multiple_choice',
        'options' => [['id' => 'opt-a', 'content' => '<p>O(n)</p>'], ['id' => 'opt-b', 'content' => '<p>O(log n)</p>']],
        'correct_answer' => 'opt-b',
        'order' => 1,
        'correct_score' => 10,
        'wrong_score' => 0,
        'empty_score' => 0,
        'difficulty' => 'medium',
        'is_active' => true,
    ]);
    $q2 = $exam->questions()->create([
        'id' => (string) Str::uuid(),
        'question' => '<p>Essay jelaskan big-O</p>',
        'type' => 'essay',
        'correct_answer' => '<p>rubrik</p>',
        'order' => 2,
        'correct_score' => 15,
        'wrong_score' => 0,
        'empty_score' => 0,
        'difficulty' => 'medium',
        'is_active' => true,
    ]);

    $team = $team->fresh();

    return [$team, $competition, $stage, $exam, $q1, $q2];
}

test('team can start exam when window open with serverTime and shuffled questionOrder', function (): void {
    [$team, , , $exam] = createExamTeamContext();
    $token = $team->createToken('exam')->plainTextToken;

    $res = $this->withToken($token)->postJson("/api/dashboard/exams/{$exam->id}/attempts", [
        'device_id' => 'device-123',
    ]);

    $res->assertCreated()
        ->assertJsonPath('status', 'success')
        ->assertJsonStructure(['data' => ['attempt' => ['id', 'endTime', 'maxPossibleScore'], 'questions', 'serverTime']]);

    // questions should NOT contain correctAnswer for team
    $questions = $res->json('data.questions');
    expect($questions)->toHaveCount(2);
    foreach ($questions as $q) {
        expect($q)->not->toHaveKey('correctAnswer');
    }

    $attempt = $res->json('data.attempt');
    expect($attempt['maxPossibleScore'])->toBe(25);
    $order = $attempt['questionOrder'] ?? $attempt['question_order'] ?? null;
    if ($order === null) {
        $meta = DB::table('exam_attempts')->where('id', $attempt['id'])->value('metadata');
        $decoded = is_string($meta) ? json_decode($meta, true) : $meta;
        $order = $decoded['questionOrder'] ?? $decoded['question_order'] ?? null;
    }
    expect($order)->not->toBeNull();
    expect(DB::table('exam_attempts')->where('id', $attempt['id'])->value('flagged'))->toBe(0);
});

test('team cannot start outside window', function (): void {
    [$team, , , $exam] = createExamTeamContext(['exam' => [
        'start_date' => now()->addDay(),
        'end_date' => now()->addDays(2),
    ]]);
    $token = $team->createToken('exam')->plainTextToken;

    $this->withToken($token)->postJson("/api/dashboard/exams/{$exam->id}/attempts")
        ->assertForbidden();
});

test('team cannot exceed max_attempts with lock', function (): void {
    [$team, , , $exam] = createExamTeamContext(['exam' => ['max_attempts' => 1]]);
    $token = $team->createToken('exam')->plainTextToken;

    $this->withToken($token)->postJson("/api/dashboard/exams/{$exam->id}/attempts")->assertCreated();
    $this->withToken($token)->postJson("/api/dashboard/exams/{$exam->id}/attempts")
        ->assertStatus(409);
});

test('resume returns savedAnswers in questionOrder and shuffle only once', function (): void {
    [$team, , , $exam, $q1, $q2] = createExamTeamContext(['exam' => ['shuffle_questions' => true]]);
    $token = $team->createToken('exam')->plainTextToken;

    $start = $this->withToken($token)->postJson("/api/dashboard/exams/{$exam->id}/attempts")->assertCreated();
    $attemptId = $start->json('data.attempt.id');
    $firstOrder = DB::table('exam_attempts')->where('id', $attemptId)->value('metadata');
    $firstOrder = json_decode($firstOrder, true)['questionOrder'] ?? json_decode($firstOrder, true)['question_order'] ?? null;
    expect($firstOrder)->not->toBeNull();

    // save an answer
    $this->withToken($token)->putJson("/api/dashboard/exams/{$exam->id}/attempts/{$attemptId}/answers", [
        'answers' => [
            ['question_id' => $q1->id, 'selected_options' => ['opt-b'], 'time_spent' => 30],
        ],
    ])->assertOk();

    // resume should return same order and savedAnswers
    $resume = $this->withToken($token)->getJson("/api/dashboard/exams/{$exam->id}/attempts/{$attemptId}")
        ->assertOk()
        ->assertJsonStructure(['data' => ['attempt', 'questions', 'savedAnswers', 'serverTime']]);

    $saved = $resume->json('data.savedAnswers') ?? $resume->json('data.saved_answers') ?? $resume->json('data.answers') ?? [];
    // at least contains our saved
    $contains = collect($saved)->contains(fn ($a) => ($a['questionId'] ?? $a['question_id']) === $q1->id);
    expect($contains)->toBeTrue();

    // second resume should have same question order (not reshuffled)
    $second = $this->withToken($token)->getJson("/api/dashboard/exams/{$exam->id}/attempts/{$attemptId}")->assertOk();
    $secondMeta = DB::table('exam_attempts')->where('id', $attemptId)->value('metadata');
    $secondOrder = json_decode($secondMeta, true)['questionOrder'] ?? json_decode($secondMeta, true)['question_order'];
    expect($secondOrder)->toBe($firstOrder);
});

test('saving correct answer sets is_correct true and essay null', function (): void {
    [$team, , , $exam, $q1, $q2] = createExamTeamContext();
    $token = $team->createToken('exam')->plainTextToken;
    $attemptId = $this->withToken($token)->postJson("/api/dashboard/exams/{$exam->id}/attempts")->assertCreated()->json('data.attempt.id');

    // correct
    $this->withToken($token)->putJson("/api/dashboard/exams/{$exam->id}/attempts/{$attemptId}/answers", [
        'answers' => [
            ['question_id' => $q1->id, 'selected_options' => ['opt-b'], 'answer' => null, 'time_spent' => 10],
        ],
    ])->assertOk()->assertJsonPath('data.saved', 1);

    $ans = DB::table('exam_answers')->where('attempt_id', $attemptId)->where('question_id', $q1->id)->first();
    expect((int) $ans->is_correct)->toBe(1);
    expect((int) $ans->score_obtained)->toBe(10);

    // essay -> is_correct null, score null
    $this->withToken($token)->putJson("/api/dashboard/exams/{$exam->id}/attempts/{$attemptId}/answers", [
        'answers' => [
            ['question_id' => $q2->id, 'answer' => 'jawaban essay', 'time_spent' => 20],
        ],
    ])->assertOk();

    $essayAns = DB::table('exam_answers')->where('attempt_id', $attemptId)->where('question_id', $q2->id)->first();
    expect($essayAns->is_correct)->toBeNull();
    expect($essayAns->score_obtained)->toBeNull();
});

test('saving incorrect answer gives wrong_score', function (): void {
    [$team, , , $exam, $q1] = createExamTeamContext();
    $token = $team->createToken('exam')->plainTextToken;
    $attemptId = $this->withToken($token)->postJson("/api/dashboard/exams/{$exam->id}/attempts")->assertCreated()->json('data.attempt.id');

    // wrong select opt-a instead of opt-b
    $this->withToken($token)->putJson("/api/dashboard/exams/{$exam->id}/attempts/{$attemptId}/answers", [
        'answers' => [
            ['question_id' => $q1->id, 'selected_options' => ['opt-a']],
        ],
    ])->assertOk();

    $ans = DB::table('exam_answers')->where('attempt_id', $attemptId)->where('question_id', $q1->id)->first();
    expect((int) $ans->is_correct)->toBe(0);
    expect((int) $ans->score_obtained)->toBe(0); // wrong_score 0
});

test('manual submit calculates total_score and flagged does not block', function (): void {
    [$team, , , $exam, $q1] = createExamTeamContext();
    $token = $team->createToken('exam')->plainTextToken;
    $attemptId = $this->withToken($token)->postJson("/api/dashboard/exams/{$exam->id}/attempts")->assertCreated()->json('data.attempt.id');

    // make it flagged via events
    $this->withToken($token)->postJson("/api/dashboard/exams/{$exam->id}/attempts/{$attemptId}/events", [
        'events' => [
            ['type' => 'devtools_opened', 'metadata' => [], 'client_at' => now()->toISOString()],
            ['type' => 'devtools_opened', 'metadata' => [], 'client_at' => now()->toISOString()],
        ],
    ])->assertOk();

    $flagged = DB::table('exam_attempts')->where('id', $attemptId)->value('flagged');
    expect((int) $flagged)->toBe(1);

    // save correct
    $this->withToken($token)->putJson("/api/dashboard/exams/{$exam->id}/attempts/{$attemptId}/answers", [
        'answers' => [['question_id' => $q1->id, 'selected_options' => ['opt-b']]],
    ])->assertOk();

    // flagged should still allow submit
    $this->withToken($token)->postJson("/api/dashboard/exams/{$exam->id}/attempts/{$attemptId}/submit")
        ->assertOk()
        ->assertJsonPath('data.attempt.finished', true);

    $total = DB::table('exam_attempts')->where('id', $attemptId)->value('total_score');
    expect((int) $total)->toBe(10);
});

test('auto cron submits expired attempts', function (): void {
    [$team, , , $exam, $q1] = createExamTeamContext();
    $token = $team->createToken('exam')->plainTextToken;
    $attemptId = $this->withToken($token)->postJson("/api/dashboard/exams/{$exam->id}/attempts")->assertCreated()->json('data.attempt.id');

    // manually expire end_time
    DB::table('exam_attempts')->where('id', $attemptId)->update([
        'end_time' => now()->subMinute(),
        'finished' => false,
    ]);

    // run command
    $this->artisan('exam:auto-submit-expired')->assertExitCode(0);

    $attempt = DB::table('exam_attempts')->where('id', $attemptId)->first();
    expect((bool) $attempt->finished)->toBeTrue();
});
