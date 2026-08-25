<?php

use App\Models\Admin;
use App\Models\Competition;
use App\Models\Exam;
use App\Models\Stage;
use App\Models\Team;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

uses(LazilyRefreshDatabase::class);

function createScoreStage(Competition $competition, string $name, string $type, int $order): Stage
{
    return Stage::query()->create([
        'id' => (string) Str::uuid(),
        'competition_id' => $competition->id,
        'name' => $name,
        'type' => $type,
        'order' => $order,
    ]);
}

function createScoreExam(Stage $stage, string $title): Exam
{
    return Exam::query()->create([
        'id' => (string) Str::uuid(),
        'stage_id' => $stage->id,
        'title' => $title,
        'start_date' => now()->subHour(),
        'end_date' => now()->addHour(),
    ]);
}

function createScoreAttempt(Team $team, Exam $exam, int $score, int $max, bool $finished = true, bool $flagged = false): void
{
    DB::table('exam_attempts')->insert([
        'id' => (string) Str::uuid(),
        'team_id' => $team->id,
        'exam_id' => $exam->id,
        'total_score' => $score,
        'max_possible_score' => $max,
        'start_time' => now()->subMinutes(30),
        'end_time' => $finished ? now() : null,
        'finished' => $finished,
        'flagged' => $flagged,
        'created_at' => now(),
        'updated_at' => now(),
    ]);
}

test('admin stage scores aggregate finished exam attempts per team for olympiad stage', function (): void {
    $admin = Admin::factory()->create(['role' => 'admin_registration', 'is_active' => true]);
    $competition = Competition::factory()->create(['type' => Competition::TYPE_OLIMPIADE]);

    $elimination = createScoreStage($competition, 'Eliminasi', 'exam', 1);
    $semifinal = createScoreStage($competition, 'Semifinal', 'exam', 2);

    $teamA = Team::factory()->create();
    $teamB = Team::factory()->create();

    $examOne = createScoreExam($elimination, 'Ujian 1');
    $examTwo = createScoreExam($elimination, 'Ujian 2');
    $otherExam = createScoreExam($semifinal, 'Ujian Semifinal');

    // Team A: dua ujian selesai di stage eliminasi -> 60+30=90 dari 100+50=150
    createScoreAttempt($teamA, $examOne, 60, 100);
    createScoreAttempt($teamA, $examTwo, 30, 50);

    // Attempt di stage lain tidak boleh terhitung
    createScoreAttempt($teamA, $otherExam, 100, 100);

    // Team B: attempt belum selesai -> score tetap null tapi tercatat
    createScoreAttempt($teamB, $examOne, 10, 100, finished: false);

    $response = $this->withToken($admin->createToken('scores')->plainTextToken)
        ->getJson("/api/admin/stages/{$elimination->id}/scores")
        ->assertOk()
        ->assertJsonPath('status', 'success')
        ->assertJsonPath('data.mode', 'exam')
        ->assertJsonPath('data.stage.id', $elimination->id);

    $scores = collect($response->json('data.scores'))->keyBy('teamId');

    expect($scores)->toHaveCount(2)
        ->and($scores[$teamA->id]['score'])->toBe(90)
        ->and($scores[$teamA->id]['maxScore'])->toBe(150)
        ->and($scores[$teamA->id]['finishedAttempts'])->toBe(2)
        ->and($scores[$teamA->id]['attemptCount'])->toBe(2)
        ->and($scores[$teamB->id]['score'])->toBeNull()
        ->and($scores[$teamB->id]['finishedAttempts'])->toBe(0)
        ->and($scores[$teamB->id]['attemptCount'])->toBe(1);
});

test('admin stage scores flag teams with flagged attempts', function (): void {
    $admin = Admin::factory()->create(['role' => 'admin_registration', 'is_active' => true]);
    $competition = Competition::factory()->create(['type' => Competition::TYPE_OLIMPIADE]);
    $stage = createScoreStage($competition, 'Penyisihan', 'exam', 1);

    $team = Team::factory()->create();
    $exam = createScoreExam($stage, 'Ujian Penyisihan');
    createScoreAttempt($team, $exam, 80, 100, flagged: true);

    $response = $this->withToken($admin->createToken('scores')->plainTextToken)
        ->getJson("/api/admin/stages/{$stage->id}/scores")
        ->assertOk();

    $entry = collect($response->json('data.scores'))->firstWhere('teamId', $team->id);

    expect($entry['score'])->toBe(80)
        ->and($entry['flagged'])->toBeTrue();
});

test('admin stage scores return submission review data for business competition stage', function (): void {
    $admin = Admin::factory()->create(['role' => 'admin_registration', 'is_active' => true]);
    $competition = Competition::factory()->create(['type' => Competition::TYPE_BUSINESS_PLAN]);
    $stage = createScoreStage($competition, 'Pengumpulan Proposal', 'submission', 1);

    $team = Team::factory()->create();
    DB::table('submissions')->insert([
        'id' => (string) Str::uuid(),
        'team_id' => $team->id,
        'stage_id' => $stage->id,
        'title' => 'Proposal',
        'file_id' => null,
        'status' => 'approved',
        'score' => 85,
        'submitted_at' => now(),
        'created_at' => now(),
        'updated_at' => now(),
    ]);

    $response = $this->withToken($admin->createToken('scores')->plainTextToken)
        ->getJson("/api/admin/stages/{$stage->id}/scores")
        ->assertOk()
        ->assertJsonPath('data.mode', 'submission');

    $entry = collect($response->json('data.scores'))->firstWhere('teamId', $team->id);

    expect($entry['score'])->toBe(85)
        ->and($entry['submissionStatus'])->toBe('approved');
});

test('admin stage scores require an authenticated admin', function (): void {
    $competition = Competition::factory()->create();
    $stage = createScoreStage($competition, 'Tahap Ujian', 'exam', 1);

    $this->getJson("/api/admin/stages/{$stage->id}/scores")->assertUnauthorized();
});
