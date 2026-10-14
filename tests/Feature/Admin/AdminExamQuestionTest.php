<?php

use App\Models\Admin;
use App\Models\Competition;
use App\Models\Exam;
use App\Models\ExamQuestion;
use App\Models\Stage;
use App\Models\Team;
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

test('a question cannot be deleted once the exam has attempts', function (): void {
    [, $token, $exam] = createQuestionExamContext();
    $question = createDeletableQuestion($exam);
    $team = Team::factory()->create();
    DB::table('exam_attempts')->insert([
        'id' => (string) Str::uuid(), 'team_id' => $team->id, 'exam_id' => $exam->id, 'total_score' => 0, 'max_possible_score' => 5,
        'start_time' => now(), 'end_time' => now()->addHour(), 'finished' => false, 'flagged' => false,
        'created_at' => now(), 'updated_at' => now(),
    ]);

    $this->withToken($token)
        ->deleteJson("/api/admin/exams/{$exam->id}/questions/{$question->id}")
        ->assertUnprocessable()
        ->assertJsonStructure(['error' => ['details' => ['question']]]);

    expect(ExamQuestion::query()->whereKey($question->id)->exists())->toBeTrue()
        ->and(DB::table('admin_audit_logs')->where('action', 'exam.question_deleted')->count())->toBe(0);
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
