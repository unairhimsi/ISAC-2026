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

function createScoreUpdateContext(): array
{
    $admin = Admin::factory()->create(['role' => 'judge', 'is_active' => true]);
    $team = Team::factory()->create(['email_verified_at' => now(), 'status' => Team::STATUS_VERIFIED]);
    $competition = Competition::factory()->create(['type' => Competition::TYPE_OLIMPIADE]);
    $batch = $competition->batches()->create([
        'name' => 'Batch Score '.Str::random(4), 'slug' => 'batch-score-'.Str::random(6),
        'start_date' => now()->subDay(), 'end_date' => now()->addMonth(), 'price' => 60000, 'status' => BatchStatus::OPEN,
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
        'id' => (string) Str::uuid(), 'stage_id' => $stage->id, 'title' => 'Ujian Score',
        'start_date' => now()->subHour(), 'end_date' => now()->addHour(), 'duration' => 60, 'max_attempts' => 1, 'type' => 'OLIMPIADE',
    ]);
    $exam->questions()->create([
        'id' => (string) Str::uuid(), 'question' => '<p>Q1</p>', 'type' => 'multiple_choice',
        'options' => [['id' => 'a', 'content' => '1']], 'correct_answer' => 'a', 'order' => 1, 'correct_score' => 10, 'is_active' => true,
    ]);
    $exam->questions()->create([
        'id' => (string) Str::uuid(), 'question' => '<p>Q2</p>', 'type' => 'multiple_choice',
        'options' => [['id' => 'a', 'content' => '1']], 'correct_answer' => 'a', 'order' => 2, 'correct_score' => 20, 'is_active' => true,
    ]);
    // attempt finished 10/30
    $attemptId = (string) Str::uuid();
    DB::table('exam_attempts')->insert([
        'id' => $attemptId, 'team_id' => $team->id, 'exam_id' => $exam->id, 'total_score' => 10, 'max_possible_score' => 30,
        'start_time' => now()->subMinutes(30), 'end_time' => now(), 'finished' => true, 'flagged' => false,
        'cheat_count' => 0, 'suspicious_score' => 0, 'created_at' => now(), 'updated_at' => now(),
    ]);

    return [$admin, $team, $exam, $attemptId];
}

test('admin can update total_score with audit', function (): void {
    [$admin, , $exam, $attemptId] = createScoreUpdateContext();
    $token = $admin->createToken('admin')->plainTextToken;

    $this->withToken($token)->patchJson("/api/admin/exams/{$exam->id}/attempts/{$attemptId}/score", [
        'total_score' => 25,
        'reason' => 'Koreksi nilai essay manual',
    ])->assertOk()->assertJsonPath('data.totalScore', 25);

    expect(DB::table('exam_attempts')->where('id', $attemptId)->value('total_score'))->toBe(25);
    expect(DB::table('exam_attempts')->where('id', $attemptId)->value('reviewed_by'))->toBe($admin->id);
    // audit log
    expect(DB::table('admin_audit_logs')->where('subject_id', $attemptId)->count())->toBe(1);
    $log = DB::table('admin_audit_logs')->where('subject_id', $attemptId)->first();
    expect($log->action)->toBe('exam.score_updated');
});

test('admin cannot set total_score beyond max', function (): void {
    [$admin, , $exam, $attemptId] = createScoreUpdateContext();
    $token = $admin->createToken('admin')->plainTextToken;

    $this->withToken($token)->patchJson("/api/admin/exams/{$exam->id}/attempts/{$attemptId}/score", [
        'total_score' => 999,
        'reason' => 'too high',
    ])->assertUnprocessable();
});

test('admin list flagged attempts filter', function (): void {
    [$admin, $team, $exam, $attemptId] = createScoreUpdateContext();
    $token = $admin->createToken('admin')->plainTextToken;

    // create flagged attempt
    $flaggedId = (string) Str::uuid();
    DB::table('exam_attempts')->insert([
        'id' => $flaggedId, 'team_id' => $team->id, 'exam_id' => $exam->id, 'total_score' => 5, 'max_possible_score' => 30,
        'start_time' => now()->subMinutes(20), 'end_time' => now(), 'finished' => true, 'flagged' => true,
        'cheat_count' => 10, 'suspicious_score' => 80, 'created_at' => now(), 'updated_at' => now(),
    ]);

    $resFlagged = $this->withToken($token)->getJson("/api/admin/exams/{$exam->id}/attempts?flagged=1")->assertOk();
    $flaggedIds = collect($resFlagged->json('data.data'))->pluck('id')->all();
    expect($flaggedIds)->toContain($flaggedId);

    $resNon = $this->withToken($token)->getJson("/api/admin/exams/{$exam->id}/attempts?flagged=0")->assertOk();
    $nonIds = collect($resNon->json('data.data'))->pluck('id')->all();
    expect($nonIds)->not->toContain($flaggedId);
    expect($nonIds)->toContain($attemptId);
});
