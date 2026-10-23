<?php

use App\Models\Admin;
use App\Models\Batch;
use App\Models\BatchStatus;
use App\Models\Competition;
use App\Models\Registration;
use App\Models\RegistrationStatus;
use App\Models\Stage;
use App\Models\Submission;
use App\Models\Team;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;

uses(LazilyRefreshDatabase::class);

function missingToken(string $role = 'judge'): string
{
    return Admin::factory()->create(['role' => $role, 'is_active' => true])->createToken('a')->plainTextToken;
}

function missingStage(Competition $competition, string $name, int $order, array $overrides = []): Stage
{
    return Stage::create(array_merge([
        'competition_id' => $competition->id,
        'name' => $name,
        'type' => 'submission',
        'order' => $order,
        'is_active' => true,
        'start_date' => now()->subDays(5),
        'end_date' => now()->addDays(5),
    ], $overrides));
}

function missingTeam(Competition $competition, ?Stage $at, array $team = [], RegistrationStatus $registration = RegistrationStatus::VERIFIED): Team
{
    $created = Team::factory()->create(array_merge(['status' => Team::STATUS_VERIFIED, 'current_stage_id' => $at?->id], $team));
    $batch = Batch::query()->where('competition_id', $competition->id)->first()
        ?? Batch::factory()->create(['competition_id' => $competition->id, 'status' => BatchStatus::OPEN]);
    Registration::create([
        'team_id' => $created->id,
        'competition_id' => $competition->id,
        'batch_id' => $batch->id,
        'status' => $registration,
    ]);

    return $created;
}

function missingSubmission(Team $team, Stage $stage, string $status, array $overrides = []): Submission
{
    return Submission::create(array_merge([
        'team_id' => $team->id,
        'stage_id' => $stage->id,
        'title' => 'Proposal',
        'status' => $status,
    ], $overrides));
}

test('lists verified teams at the stage that never submitted or only drafted, and leaves out the rest', function (): void {
    $competition = Competition::factory()->create(['type' => Competition::TYPE_BUSINESS_PLAN]);
    $preliminary = missingStage($competition, 'Preliminary', 1);

    $notStarted = missingTeam($competition, $preliminary, ['code' => 'ISAC-TM-A']);
    $draft = missingTeam($competition, $preliminary, ['code' => 'ISAC-TM-B']);
    missingSubmission($draft, $preliminary, 'draft');

    foreach (['submitted', 'under_review', 'approved', 'rejected', 'revision_requested'] as $status) {
        missingSubmission(missingTeam($competition, $preliminary), $preliminary, $status, ['submitted_at' => now()]);
    }

    missingTeam($competition, $preliminary, ['status' => Team::STATUS_WAITING_VERIFICATION]);
    missingTeam($competition, $preliminary, [], RegistrationStatus::WAITING_PAYMENT);
    missingTeam($competition, null);

    $other = Competition::factory()->create(['type' => Competition::TYPE_BUSINESS_IT_CASE]);
    missingTeam($other, missingStage($other, 'Preliminary', 1));

    $response = $this->withToken(missingToken())->getJson("/api/admin/stages/{$preliminary->id}/missing-submissions")->assertOk();

    expect(collect($response->json('data.teams.data'))->pluck('code')->all())->toBe(['ISAC-TM-A', 'ISAC-TM-B'])
        ->and($response->json('data.summary'))->toBe(['expected' => 7, 'submitted' => 5, 'missing' => 2, 'notStarted' => 1, 'draft' => 1])
        ->and($response->json('data.teams.data.0.state'))->toBe('not_started')
        ->and($response->json('data.teams.data.0.submission'))->toBeNull()
        ->and($response->json('data.teams.data.1.state'))->toBe('draft')
        ->and($response->json('data.teams.data.1.submission.withdrawn'))->toBeFalse()
        ->and($response->json('data.competition.type'))->toBe(Competition::TYPE_BUSINESS_PLAN)
        ->and($response->json('data.teams.total'))->toBe(2);

    expect($notStarted->id)->toBe($response->json('data.teams.data.0.id'));
});

test('a submission withdrawn back to draft counts as missing and is marked withdrawn', function (): void {
    $competition = Competition::factory()->create(['type' => Competition::TYPE_BUSINESS_IT_CASE]);
    $stage = missingStage($competition, 'Preliminary', 1);
    $team = missingTeam($competition, $stage);
    missingSubmission($team, $stage, 'draft', ['submitted_at' => now()->subDay()]);

    $this->withToken(missingToken())->getJson("/api/admin/stages/{$stage->id}/missing-submissions")
        ->assertOk()
        ->assertJsonPath('data.teams.data.0.id', $team->id)
        ->assertJsonPath('data.teams.data.0.submission.withdrawn', true);
});

test('teams already advanced past the stage without submitting are listed as lapsed', function (): void {
    $competition = Competition::factory()->create(['type' => Competition::TYPE_BUSINESS_PLAN]);
    $preliminary = missingStage($competition, 'Preliminary', 1);
    $semifinal = missingStage($competition, 'Semifinal', 2);
    $advanced = missingTeam($competition, $semifinal);
    $waiting = missingTeam($competition, $preliminary);

    $response = $this->withToken(missingToken())->getJson("/api/admin/stages/{$preliminary->id}/missing-submissions")->assertOk();
    $byId = collect($response->json('data.teams.data'))->keyBy('id');

    expect($byId[$advanced->id]['advancedPast'])->toBeTrue()
        ->and($byId[$advanced->id]['lapsed'])->toBeTrue()
        ->and($byId[$waiting->id]['advancedPast'])->toBeFalse()
        ->and($byId[$waiting->id]['lapsed'])->toBeFalse();

    // Teams still on the preliminary stage have not reached the semifinal yet.
    $this->withToken(missingToken())->getJson("/api/admin/stages/{$semifinal->id}/missing-submissions")
        ->assertOk()
        ->assertJsonPath('data.summary.expected', 1)
        ->assertJsonPath('data.teams.data.0.id', $advanced->id);
});

test('a closed window marks the missing team as lapsed even on the current stage', function (): void {
    $competition = Competition::factory()->create(['type' => Competition::TYPE_BUSINESS_PLAN]);
    $stage = missingStage($competition, 'Preliminary', 1, ['end_date' => now()->subDay()]);
    missingTeam($competition, $stage);

    $this->withToken(missingToken())->getJson("/api/admin/stages/{$stage->id}/missing-submissions")
        ->assertOk()
        ->assertJsonPath('data.teams.data.0.lapsed', true)
        ->assertJsonPath('data.teams.data.0.advancedPast', false);
});

test('state and search filters narrow the list while the summary stays overall', function (): void {
    $competition = Competition::factory()->create(['type' => Competition::TYPE_BUSINESS_PLAN]);
    $stage = missingStage($competition, 'Preliminary', 1);
    missingTeam($competition, $stage, ['code' => 'ISAC-TM-A', 'name' => 'Alpha Team']);
    $draft = missingTeam($competition, $stage, ['code' => 'ISAC-TM-B', 'name' => 'Beta Team']);
    missingSubmission($draft, $stage, 'draft');
    $token = missingToken();

    $this->withToken($token)->getJson("/api/admin/stages/{$stage->id}/missing-submissions?state=draft")
        ->assertOk()
        ->assertJsonPath('data.teams.total', 1)
        ->assertJsonPath('data.teams.data.0.code', 'ISAC-TM-B')
        ->assertJsonPath('data.summary.missing', 2);

    $this->withToken($token)->getJson("/api/admin/stages/{$stage->id}/missing-submissions?state=not_started")
        ->assertOk()
        ->assertJsonPath('data.teams.total', 1)
        ->assertJsonPath('data.teams.data.0.code', 'ISAC-TM-A');

    $this->withToken($token)->getJson("/api/admin/stages/{$stage->id}/missing-submissions?search=beta")
        ->assertOk()
        ->assertJsonPath('data.teams.total', 1)
        ->assertJsonPath('data.teams.data.0.code', 'ISAC-TM-B');

    $this->withToken($token)->getJson("/api/admin/stages/{$stage->id}/missing-submissions?state=bogus")->assertUnprocessable();
});

test('olympiad stages have no submissions and answer 404', function (): void {
    $competition = Competition::factory()->create(['type' => Competition::TYPE_OLIMPIADE]);
    $stage = missingStage($competition, 'Elimination', 1, ['type' => 'exam']);

    $this->withToken(missingToken())->getJson("/api/admin/stages/{$stage->id}/missing-submissions")->assertNotFound();
});

test('only judges, registration admins and super admins can see the missing list', function (): void {
    $competition = Competition::factory()->create(['type' => Competition::TYPE_BUSINESS_PLAN]);
    $stage = missingStage($competition, 'Preliminary', 1);

    foreach (['judge', 'admin_registration', 'super_admin'] as $role) {
        app('auth')->forgetGuards();
        $this->withToken(missingToken($role))->getJson("/api/admin/stages/{$stage->id}/missing-submissions")->assertOk();
    }

    app('auth')->forgetGuards();
    $this->withToken(missingToken('admin_payment'))->getJson("/api/admin/stages/{$stage->id}/missing-submissions")->assertForbidden();

    app('auth')->forgetGuards();
    $this->flushHeaders()->getJson("/api/admin/stages/{$stage->id}/missing-submissions")->assertUnauthorized();
});
