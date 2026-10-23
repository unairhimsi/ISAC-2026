<?php

use App\Models\Admin;
use App\Models\AdminOperation;
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

function advToken(string $role = 'admin_registration'): string
{
    return Admin::factory()->create(['role' => $role, 'is_active' => true])->createToken('a')->plainTextToken;
}

/** @return array{0: Competition, 1: Stage, 2: Stage, 3: Stage, 4: Batch, 5: Batch} */
function advCompetition(string $type = Competition::TYPE_BUSINESS_PLAN): array
{
    $competition = Competition::factory()->create(['type' => $type]);
    $stages = array_map(fn (string $name, int $order): Stage => Stage::create(['competition_id' => $competition->id, 'name' => $name, 'type' => $order === 3 ? 'final' : 'submission', 'order' => $order, 'is_active' => true]), ['Preliminary', 'Semifinal', 'Final'], [1, 2, 3]);
    $batches = [
        Batch::factory()->create(['competition_id' => $competition->id, 'name' => 'Batch 1', 'status' => BatchStatus::OPEN]),
        Batch::factory()->create(['competition_id' => $competition->id, 'name' => 'Batch 2', 'status' => BatchStatus::OPEN]),
    ];

    return [$competition, ...$stages, ...$batches];
}

function advTeam(Competition $competition, Batch $batch, ?Stage $at, string $code, array $team = [], RegistrationStatus $registration = RegistrationStatus::VERIFIED): Team
{
    $created = Team::factory()->create(array_merge(['code' => $code, 'status' => Team::STATUS_VERIFIED, 'current_stage_id' => $at?->id], $team));
    Registration::create(['team_id' => $created->id, 'competition_id' => $competition->id, 'batch_id' => $batch->id, 'status' => $registration]);

    return $created;
}

function advSubmission(Team $team, Stage $stage, string $status, ?int $score = null): void
{
    Submission::create(['team_id' => $team->id, 'stage_id' => $stage->id, 'title' => 'Proposal', 'status' => $status, 'score' => $score, 'submitted_at' => now()]);
}

test('the pool is every team at or past the stage, scored teams first, with review info and why a team is blocked', function (): void {
    [$competition, $pre, $semi, , $batch1] = advCompetition();
    $a = advTeam($competition, $batch1, $pre, 'T-A');
    $b = advTeam($competition, $batch1, $pre, 'T-B');
    $c = advTeam($competition, $batch1, $pre, 'T-C');
    advTeam($competition, $batch1, $pre, 'T-D');
    advTeam($competition, $batch1, $pre, 'T-E', ['status' => Team::STATUS_WAITING_VERIFICATION]);
    advTeam($competition, $batch1, $pre, 'T-F', [], RegistrationStatus::WAITING_PAYMENT);
    advTeam($competition, $batch1, $semi, 'T-G');
    advTeam($competition, $batch1, null, 'T-H');
    advSubmission($b, $pre, 'approved', 70);
    advSubmission($a, $pre, 'approved', 90);
    advSubmission($c, $pre, 'submitted');

    [$other, $otherPre, , , $otherBatch] = advCompetition(Competition::TYPE_BUSINESS_IT_CASE);
    advTeam($other, $otherBatch, $otherPre, 'T-OTHER');

    $response = $this->withToken(advToken())->getJson("/api/admin/stages/{$pre->id}/advancement")->assertOk();
    $rows = collect($response->json('data.teams'))->keyBy('team.code');

    expect(collect($response->json('data.teams'))->pluck('team.code')->all())->toBe(['T-A', 'T-B', 'T-C', 'T-D', 'T-E', 'T-F', 'T-G'])
        ->and($response->json('data.nextStage.id'))->toBe($semi->id)
        ->and($response->json('data.summary'))->toBe(['total' => 7, 'eligible' => 4, 'advanced' => 1, 'blocked' => 2])
        ->and($rows['T-A']['submission'])->toMatchArray(['status' => 'approved', 'score' => 90])
        ->and($rows['T-C']['submission']['status'])->toBe('submitted')
        ->and($rows['T-D']['submission'])->toBeNull()
        ->and($rows['T-A']['state'])->toBe('eligible')
        ->and($rows['T-G']['state'])->toBe('advanced')
        ->and($rows['T-E'])->toMatchArray(['state' => 'blocked', 'reason' => 'Tim belum terverifikasi.'])
        ->and($rows['T-F'])->toMatchArray(['state' => 'blocked', 'reason' => 'Pembayaran belum terverifikasi.'])
        ->and($rows['T-A']['batch']['name'])->toBe('Batch 1')
        ->and($response->json('data.truncated'))->toBeFalse();
});

test('the batch filter narrows the pool to one batch', function (): void {
    [$competition, $pre, , , $batch1, $batch2] = advCompetition();
    advTeam($competition, $batch1, $pre, 'T-A');
    advTeam($competition, $batch2, $pre, 'T-B');
    advTeam($competition, $batch2, $pre, 'T-C');
    $token = advToken();

    $this->withToken($token)->getJson("/api/admin/stages/{$pre->id}/advancement?batch_id={$batch2->id}")
        ->assertOk()
        ->assertJsonPath('data.summary.total', 2)
        ->assertJsonPath('data.teams.0.batch.id', $batch2->id)
        ->assertJsonCount(2, 'data.teams');

    $this->withToken($token)->getJson("/api/admin/stages/{$pre->id}/advancement?batch_id=not-a-uuid")->assertUnprocessable();
});

test('the last stage has no next stage so nobody can be moved on from it', function (): void {
    [$competition, , , $final, $batch1] = advCompetition();
    advTeam($competition, $batch1, $final, 'T-A');

    $this->withToken(advToken())->getJson("/api/admin/stages/{$final->id}/advancement")
        ->assertOk()
        ->assertJsonPath('data.nextStage', null)
        ->assertJsonPath('data.teams.0.state', 'blocked')
        ->assertJsonPath('data.teams.0.reason', 'Tidak ada tahap berikutnya.');
});

test('olympiad stages answer 404 and only registration admins and super admins may open the pool', function (): void {
    [, $olympiadStage] = advCompetition(Competition::TYPE_OLIMPIADE);
    $this->withToken(advToken('super_admin'))->getJson("/api/admin/stages/{$olympiadStage->id}/advancement")->assertNotFound();

    [, $pre] = advCompetition();
    foreach (['admin_registration' => 200, 'super_admin' => 200, 'judge' => 403, 'admin_payment' => 403] as $role => $status) {
        app('auth')->forgetGuards();
        $this->withToken(advToken($role))->getJson("/api/admin/stages/{$pre->id}/advancement")->assertStatus($status);
    }

    app('auth')->forgetGuards();
    $this->flushHeaders()->getJson("/api/admin/stages/{$pre->id}/advancement")->assertUnauthorized();
});

test('the admin picks which teams go through and only those move to the next stage', function (): void {
    [$competition, $pre, $semi, , $batch1] = advCompetition();
    $a = advTeam($competition, $batch1, $pre, 'T-A');
    $b = advTeam($competition, $batch1, $pre, 'T-B');
    $d = advTeam($competition, $batch1, $pre, 'T-D');
    advSubmission($a, $pre, 'approved', 90);
    advSubmission($b, $pre, 'approved', 70);
    $token = advToken();

    // The admin chooses an approved team and one that never submitted: review status does not gate the choice.
    $this->withToken($token)->postJson('/api/admin/operations', [
        'action' => AdminOperation::ACTION_ADVANCE_STAGE,
        'team_ids' => [$a->id, $d->id],
        'target_stage_id' => $semi->id,
        'sync_spreadsheet' => false,
        'announcement' => ['title' => 'Selamat', 'template' => 'advance_stage', 'send_notification' => false],
    ])->assertAccepted();

    expect($a->fresh()->current_stage_id)->toBe($semi->id)
        ->and($d->fresh()->current_stage_id)->toBe($semi->id)
        ->and($b->fresh()->current_stage_id)->toBe($pre->id);

    $after = $this->withToken($token)->getJson("/api/admin/stages/{$pre->id}/advancement")->assertOk();
    $states = collect($after->json('data.teams'))->pluck('state', 'team.code')->all();

    expect($states)->toBe(['T-A' => 'advanced', 'T-B' => 'eligible', 'T-D' => 'advanced'])
        ->and($after->json('data.summary'))->toBe(['total' => 3, 'eligible' => 1, 'advanced' => 2, 'blocked' => 0]);
});
