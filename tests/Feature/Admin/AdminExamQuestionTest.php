<?php

use App\Models\Admin;
use App\Models\Competition;
use App\Models\Exam;
use App\Models\ExamAttempt;
use App\Models\ExamQuestion;
use App\Models\Stage;
use App\Models\Team;
use App\Services\ExamAttemptService;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

uses(LazilyRefreshDatabase::class);

function createQuestionExamContext(): array
{
    $admin = Admin::factory()->create(['role' => 'super_admin', 'is_active' => true]);
    $token = $admin->createToken('admin-exam-question')->plainTextToken;
    $competition = Competition::factory()->create(['type' => Competition::TYPE_OLIMPIADE]);
    $stage = Stage::query()->create([
        'competition_id' => $competition->id,
        'name' => 'Penyisihan',
        'type' => 'exam',
        'order' => 1,
    ]);
    $exam = Exam::query()->create([
        'stage_id' => $stage->id,
        'title' => 'Ujian Penyisihan',
        'start_date' => now()->subHour(),
        'end_date' => now()->addHour(),
    ]);

    return [$admin, $token, $exam];
}

function essayQuestionPayload(array $overrides = []): array
{
    return [
        'question' => '<p>Jelaskan konsep big-O notation.</p>',
        'type' => 'essay',
        'correct_answer' => '<p>Rubrik: kompleksitas waktu.</p>',
        'difficulty' => 'medium',
        ...$overrides,
    ];
}

test('rejects essay question whose correct score exceeds fifteen points', function (): void {
    [, $token, $exam] = createQuestionExamContext();

    $this->withToken($token)
        ->postJson("/api/admin/exams/{$exam->id}/questions", essayQuestionPayload([
            'correct_score' => 16,
            'wrong_score' => 0,
            'empty_score' => 0,
        ]))
        ->assertUnprocessable()
        ->assertJsonPath('error.code', 'VALIDATION_ERROR')
        ->assertJsonStructure(['error' => ['details' => ['correct_score']]]);
});

test('rejects essay question without a positive score', function (): void {
    [, $token, $exam] = createQuestionExamContext();

    $this->withToken($token)
        ->postJson("/api/admin/exams/{$exam->id}/questions", essayQuestionPayload([
            'correct_score' => 0,
            'wrong_score' => 0,
            'empty_score' => 0,
        ]))
        ->assertUnprocessable()
        ->assertJsonPath('error.code', 'VALIDATION_ERROR')
        ->assertJsonStructure(['error' => ['details' => ['correct_score']]]);
});

test('stores essay question with weighted score inside one to fifteen range', function (): void {
    [, $token, $exam] = createQuestionExamContext();

    $this->withToken($token)
        ->postJson("/api/admin/exams/{$exam->id}/questions", essayQuestionPayload([
            'correct_score' => 15,
            'wrong_score' => 0,
            'empty_score' => 0,
        ]))
        ->assertOk()
        ->assertJsonPath('data.correctScore', 15)
        ->assertJsonPath('data.type', 'essay');

    expect($exam->questions()->where('type', 'essay')->count())->toBe(1);
});

test('objective question keeps configurable penalty weights per difficulty', function (): void {
    [, $token, $exam] = createQuestionExamContext();

    $this->withToken($token)
        ->postJson("/api/admin/exams/{$exam->id}/questions", [
            'question' => '<p>Big-O dari binary search?</p>',
            'type' => 'multiple_choice',
            'options' => [
                ['id' => 'opt-a', 'content' => '<p>O(n)</p>'],
                ['id' => 'opt-b', 'content' => '<p>O(log n)</p>'],
            ],
            'correct_answer' => 'opt-b',
            'difficulty' => 'hard',
            'correct_score' => 20,
            'wrong_score' => -10,
            'empty_score' => -5,
        ])
        ->assertOk()
        ->assertJsonPath('data.correctScore', 20)
        ->assertJsonPath('data.wrongScore', -10)
        ->assertJsonPath('data.emptyScore', -5)
        ->assertJsonPath('data.difficulty', 'hard');
});

test('exam update rejects an end time that is not after the start time', function (): void {
    [, $token, $exam] = createQuestionExamContext();
    $start = $exam->start_date->copy();

    $this->withToken($token)
        ->patchJson("/api/admin/exams/{$exam->id}", ['end_date' => $start->copy()->subMinute()->toDateTimeString()])
        ->assertUnprocessable()
        ->assertJsonStructure(['error' => ['details' => ['end_date']]]);

    $this->withToken($token)
        ->patchJson("/api/admin/exams/{$exam->id}", ['start_date' => $exam->end_date->copy()->addMinute()->toDateTimeString()])
        ->assertUnprocessable()
        ->assertJsonStructure(['error' => ['details' => ['end_date']]]);

    $this->withToken($token)
        ->patchJson("/api/admin/exams/{$exam->id}", [
            'start_date' => '2026-10-20 08:00:00',
            'end_date' => '2026-10-20 08:00:00',
        ])
        ->assertUnprocessable();

    expect($exam->fresh()->end_date->equalTo($exam->end_date))->toBeTrue();
});

test('exam update accepts a valid window and a partial update that stays consistent', function (): void {
    [, $token, $exam] = createQuestionExamContext();

    $this->withToken($token)
        ->patchJson("/api/admin/exams/{$exam->id}", [
            'start_date' => '2026-10-20 08:00:00',
            'end_date' => '2026-10-20 10:00:00',
        ])
        ->assertOk();

    $this->withToken($token)
        ->patchJson("/api/admin/exams/{$exam->id}", ['end_date' => '2026-10-20 12:00:00'])
        ->assertOk();

    expect($exam->fresh()->end_date->format('Y-m-d H:i'))->toBe('2026-10-20 12:00');
});

function createDeletableQuestion(Exam $exam, int $order = 1): ExamQuestion
{
    return $exam->questions()->create([
        'question' => "<p>Soal nomor {$order}</p>",
        'type' => 'multiple_choice',
        'options' => [['id' => 'a', 'content' => '<p>A</p>'], ['id' => 'b', 'content' => '<p>B</p>']],
        'correct_answer' => 'a',
        'order' => $order,
        'correct_score' => 5,
        'wrong_score' => -1,
        'empty_score' => 0,
        'difficulty' => 'easy',
        'is_active' => true,
    ]);
}

test('admin can delete a question from an exam nobody has taken yet', function (): void {
    [$admin, $token, $exam] = createQuestionExamContext();
    $keep = createDeletableQuestion($exam, 1);
    $remove = createDeletableQuestion($exam, 2);

    $this->withToken($token)
        ->deleteJson("/api/admin/exams/{$exam->id}/questions/{$remove->id}")
        ->assertOk()
        ->assertJsonPath('message', 'Soal berhasil dihapus.');

    $listed = collect($this->withToken($token)->getJson("/api/admin/exams/{$exam->id}")->json('data.questions'))->pluck('id');
    $log = DB::table('admin_audit_logs')->where('subject_id', $remove->id)->where('action', 'exam.question_deleted')->first();

    expect($listed->all())->toBe([$keep->id])
        ->and(ExamQuestion::query()->whereKey($remove->id)->exists())->toBeFalse()
        ->and($log)->not->toBeNull()
        ->and($log->admin_id)->toBe($admin->id)
        ->and(json_decode($log->before_data, true)['preview'])->toBe('Soal nomor 2');
});

/**
 * Insert an attempt on $exam for a fresh team. $answers maps question id => score_obtained (null = essay).
 *
 * @param  list<ExamQuestion>  $questions  the questions the attempt started with
 * @param  array<string, int|null>  $answers
 */
function createAttemptWithAnswers(Exam $exam, array $questions, array $answers, array $attempt = []): string
{
    $id = (string) Str::uuid();
    $team = Team::factory()->create();
    DB::table('exam_attempts')->insert([
        'id' => $id, 'team_id' => $team->id, 'exam_id' => $exam->id, 'total_score' => 0,
        'max_possible_score' => array_sum(array_map(fn (ExamQuestion $q) => $q->correct_score, $questions)),
        'start_time' => now()->subMinutes(30), 'end_time' => now()->addMinutes(30), 'finished' => false, 'flagged' => false,
        'metadata' => json_encode(['questionOrder' => array_map(fn (ExamQuestion $q) => $q->id, $questions)]),
        'created_at' => now(), 'updated_at' => now(),
        ...$attempt,
    ]);

    foreach ($answers as $questionId => $score) {
        DB::table('exam_answers')->insert([
            'id' => (string) Str::uuid(), 'attempt_id' => $id, 'question_id' => $questionId,
            'selected_options' => json_encode(['a']), 'is_correct' => $score !== null && $score > 0, 'score_obtained' => $score,
            'created_at' => now(), 'updated_at' => now(),
        ]);
    }

    return $id;
}

function createScoredQuestion(Exam $exam, int $order, int $correct, int $wrong, int $empty): ExamQuestion
{
    return $exam->questions()->create([
        'question' => "<p>Soal nomor {$order}</p>",
        'type' => 'multiple_choice',
        'options' => [['id' => 'a', 'content' => '<p>A</p>'], ['id' => 'b', 'content' => '<p>B</p>']],
        'correct_answer' => 'a',
        'order' => $order,
        'correct_score' => $correct,
        'wrong_score' => $wrong,
        'empty_score' => $empty,
        'difficulty' => 'easy',
        'is_active' => true,
    ]);
}

test('a question can be deleted after participants finished the exam and their scores are recalculated', function (): void {
    [$admin, $token, $exam] = createQuestionExamContext();
    $keep = createScoredQuestion($exam, 1, 5, -1, 0);
    $remove = createScoredQuestion($exam, 2, 5, -1, -2);
    $questions = [$keep, $remove];
    $answeredBoth = createAttemptWithAnswers($exam, $questions, [$keep->id => 5, $remove->id => 5], ['finished' => true, 'total_score' => 10]);
    $leftBlank = createAttemptWithAnswers($exam, $questions, [$keep->id => 5], ['finished' => true, 'total_score' => 3]);
    $wrong = createAttemptWithAnswers($exam, $questions, [$keep->id => 5, $remove->id => -1], ['finished' => true, 'total_score' => 4]);

    $this->withToken($token)->getJson("/api/admin/exams/{$exam->id}")->assertJsonPath('data.attemptCount', 3);

    $this->withToken($token)
        ->deleteJson("/api/admin/exams/{$exam->id}/questions/{$remove->id}")
        ->assertOk()
        ->assertJsonPath('message', 'Soal berhasil dihapus.')
        ->assertJsonPath('data.attemptsRecalculated', 3)
        ->assertJsonPath('data.answersVoided', 2);

    $row = fn (string $id) => DB::table('exam_attempts')->where('id', $id)->first();
    $log = DB::table('admin_audit_logs')->where('subject_id', $remove->id)->where('action', 'exam.question_deleted')->first();
    $after = json_decode($log->after_data, true);

    expect(ExamQuestion::query()->whereKey($remove->id)->exists())->toBeFalse()
        ->and(ExamQuestion::withTrashed()->whereKey($remove->id)->exists())->toBeTrue()
        ->and([$row($answeredBoth)->total_score, $row($answeredBoth)->max_possible_score])->toBe([5, 5])
        ->and([$row($leftBlank)->total_score, $row($leftBlank)->max_possible_score])->toBe([5, 5])
        ->and([$row($wrong)->total_score, $row($wrong)->max_possible_score])->toBe([5, 5])
        ->and(DB::table('exam_answers')->where('question_id', $remove->id)->count())->toBe(2)
        ->and($log->admin_id)->toBe($admin->id)
        ->and($after['attempts_recalculated'])->toBe(3)
        ->and(collect($after['attempts'])->firstWhere('attempt_id', $leftBlank))->toMatchArray(['total_before' => 3, 'total_after' => 5, 'max_after' => 5]);
});

test('deleting a question keeps a score an admin corrected by hand and only removes the question share', function (): void {
    [$admin, $token, $exam] = createQuestionExamContext();
    $keep = createScoredQuestion($exam, 1, 5, -1, 0);
    $remove = createScoredQuestion($exam, 2, 5, -1, 0);
    $attemptId = createAttemptWithAnswers($exam, [$keep, $remove], [$keep->id => 5, $remove->id => 5], [
        'finished' => true, 'total_score' => 8, 'reviewed_by' => $admin->id,
    ]);

    $this->withToken($token)->deleteJson("/api/admin/exams/{$exam->id}/questions/{$remove->id}")->assertOk();

    $attempt = DB::table('exam_attempts')->where('id', $attemptId)->first();
    expect([$attempt->total_score, $attempt->max_possible_score, $attempt->reviewed_by])->toBe([3, 5, $admin->id]);
});

test('a running attempt loses the deleted question from its maximum and is not scored with it on submit', function (): void {
    [, $token, $exam] = createQuestionExamContext();
    $keep = createScoredQuestion($exam, 1, 5, -1, 0);
    $remove = createScoredQuestion($exam, 2, 5, -1, 0);
    $attemptId = createAttemptWithAnswers($exam, [$keep, $remove], [$keep->id => 5, $remove->id => 5]);

    $this->withToken($token)->deleteJson("/api/admin/exams/{$exam->id}/questions/{$remove->id}")->assertOk();

    $running = ExamAttempt::query()->findOrFail($attemptId);
    expect([$running->total_score, $running->max_possible_score, $running->finished])->toBe([0, 5, false]);

    $submitted = app(ExamAttemptService::class)->submit($running->team, $exam, $running);

    expect([$submitted->total_score, $submitted->max_possible_score, $submitted->finished])->toBe([5, 5, true]);
});

test('a participant resuming an attempt no longer receives the deleted question or its saved answer', function (): void {
    [, $token, $exam] = createQuestionExamContext();
    $keep = createScoredQuestion($exam, 1, 5, -1, 0);
    $remove = createScoredQuestion($exam, 2, 5, -1, 0);
    $attemptId = createAttemptWithAnswers($exam, [$keep, $remove], [$keep->id => 5, $remove->id => 5]);

    $this->withToken($token)->deleteJson("/api/admin/exams/{$exam->id}/questions/{$remove->id}")->assertOk();

    $attempt = ExamAttempt::query()->findOrFail($attemptId);
    $resumed = app(ExamAttemptService::class)->resume($attempt->team, $exam, $attempt);

    expect($resumed['questions']->pluck('id')->all())->toBe([$keep->id])
        ->and($resumed['savedAnswers']->pluck('questionId')->all())->toBe([$keep->id]);
});

test('an admin still sees the participant answer to a deleted question, marked as deleted', function (): void {
    [, $token, $exam] = createQuestionExamContext();
    $keep = createScoredQuestion($exam, 1, 5, -1, 0);
    $remove = createScoredQuestion($exam, 2, 5, -1, 0);
    $attemptId = createAttemptWithAnswers($exam, [$keep, $remove], [$keep->id => 5, $remove->id => 5], ['finished' => true, 'total_score' => 10]);

    $this->withToken($token)->deleteJson("/api/admin/exams/{$exam->id}/questions/{$remove->id}")->assertOk();

    $answers = collect($this->withToken($token)->getJson("/api/admin/exams/{$exam->id}/attempts/{$attemptId}")->assertOk()->json('data.answers'))
        ->keyBy('questionId');

    expect($answers[$remove->id]['questionDeleted'])->toBeTrue()
        ->and($answers[$remove->id]['question']['id'])->toBe($remove->id)
        ->and($answers[$remove->id]['correctAnswer'])->toBe('a')
        ->and($answers[$keep->id]['questionDeleted'])->toBeFalse();
});

test('deleting the same question twice does not recalculate the scores twice', function (): void {
    [, $token, $exam] = createQuestionExamContext();
    $keep = createScoredQuestion($exam, 1, 5, -1, 0);
    $remove = createScoredQuestion($exam, 2, 5, -1, 0);
    $attemptId = createAttemptWithAnswers($exam, [$keep, $remove], [$keep->id => 5, $remove->id => 5], ['finished' => true, 'total_score' => 10]);

    $this->withToken($token)->deleteJson("/api/admin/exams/{$exam->id}/questions/{$remove->id}")->assertOk();
    $this->withToken($token)->deleteJson("/api/admin/exams/{$exam->id}/questions/{$remove->id}")->assertNotFound();

    $attempt = DB::table('exam_attempts')->where('id', $attemptId)->first();
    expect([$attempt->total_score, $attempt->max_possible_score])->toBe([5, 5])
        ->and(DB::table('admin_audit_logs')->where('action', 'exam.question_deleted')->count())->toBe(1);
});

test('deleting a question leaves the attempts of other exams untouched', function (): void {
    [, $token, $exam] = createQuestionExamContext();
    [, , $otherExam] = createQuestionExamContext();
    $remove = createScoredQuestion($exam, 1, 5, -1, 0);
    $otherQuestion = createScoredQuestion($otherExam, 1, 5, -1, 0);
    $otherAttempt = createAttemptWithAnswers($otherExam, [$otherQuestion], [$otherQuestion->id => 5], ['finished' => true, 'total_score' => 5]);

    $this->withToken($token)->deleteJson("/api/admin/exams/{$exam->id}/questions/{$remove->id}")->assertOk();

    $attempt = DB::table('exam_attempts')->where('id', $otherAttempt)->first();
    expect([$attempt->total_score, $attempt->max_possible_score])->toBe([5, 5]);
});

test('a question cannot be deleted through another exam', function (): void {
    [, $token, $exam] = createQuestionExamContext();
    [, , $otherExam] = createQuestionExamContext();
    $question = createDeletableQuestion($otherExam);

    $this->withToken($token)
        ->deleteJson("/api/admin/exams/{$exam->id}/questions/{$question->id}")
        ->assertNotFound();

    expect(ExamQuestion::query()->whereKey($question->id)->exists())->toBeTrue();
});

test('deleting a question requires authentication', function (): void {
    [, , $exam] = createQuestionExamContext();
    $question = createDeletableQuestion($exam);

    $this->deleteJson("/api/admin/exams/{$exam->id}/questions/{$question->id}")->assertUnauthorized();

    expect(ExamQuestion::query()->whereKey($question->id)->exists())->toBeTrue();
});

test('a team token cannot delete questions', function (): void {
    [, , $exam] = createQuestionExamContext();
    $question = createDeletableQuestion($exam);
    $team = Team::factory()->create(['email_verified_at' => now()]);

    $this->withToken($team->createToken('t')->plainTextToken)
        ->deleteJson("/api/admin/exams/{$exam->id}/questions/{$question->id}")
        ->assertUnauthorized();

    expect(ExamQuestion::query()->whereKey($question->id)->exists())->toBeTrue();
});

test('admins without exam authoring rights cannot delete questions', function (string $role): void {
    [, , $exam] = createQuestionExamContext();
    $question = createDeletableQuestion($exam);
    $other = Admin::factory()->create(['role' => $role, 'is_active' => true]);

    $this->withToken($other->createToken('t')->plainTextToken)
        ->deleteJson("/api/admin/exams/{$exam->id}/questions/{$question->id}")
        ->assertForbidden();

    expect(ExamQuestion::query()->whereKey($question->id)->exists())->toBeTrue();
})->with(['admin_registration', 'admin_payment']);

test('a judge can delete questions', function (): void {
    [, , $exam] = createQuestionExamContext();
    $question = createDeletableQuestion($exam);
    $judge = Admin::factory()->create(['role' => 'judge', 'is_active' => true]);

    $this->withToken($judge->createToken('t')->plainTextToken)
        ->deleteJson("/api/admin/exams/{$exam->id}/questions/{$question->id}")
        ->assertOk();

    expect(ExamQuestion::query()->whereKey($question->id)->exists())->toBeFalse();
});
