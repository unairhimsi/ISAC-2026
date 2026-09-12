<?php

use App\Models\Admin;
use App\Models\Competition;
use App\Models\Exam;
use App\Models\Stage;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;

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
