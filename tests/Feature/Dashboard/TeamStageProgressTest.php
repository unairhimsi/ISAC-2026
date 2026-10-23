<?php

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

/** @return array{0: Team, 1: string, 2: Stage, 3: Stage, 4: Stage} team at the semifinal, its token, then the three stages */
function progressTeam(string $type = Competition::TYPE_BUSINESS_PLAN): array
{
    $competition = Competition::factory()->create(['type' => $type, 'payment_flow' => Competition::PAYMENT_UPFRONT]);
    $batch = Batch::factory()->create(['competition_id' => $competition->id, 'status' => BatchStatus::OPEN]);
    $pre = Stage::create(['competition_id' => $competition->id, 'name' => 'Preliminary', 'type' => 'submission', 'order' => 1, 'is_active' => true, 'start_date' => now()->subDays(10), 'end_date' => now()->subDays(2)]);
    $semi = Stage::create(['competition_id' => $competition->id, 'name' => 'Semifinal', 'type' => 'submission', 'order' => 2, 'is_active' => true, 'start_date' => now()->subDay(), 'end_date' => now()->addDays(7)]);
    $final = Stage::create(['competition_id' => $competition->id, 'name' => 'Final', 'type' => 'final', 'order' => 3, 'is_active' => true, 'start_date' => now()->addDays(20), 'end_date' => now()->addDays(20)]);

    $team = Team::factory()->create(['status' => Team::STATUS_VERIFIED, 'email_verified_at' => now(), 'current_stage_id' => $semi->id]);
    Registration::create([
        'team_id' => $team->id, 'competition_id' => $competition->id, 'batch_id' => $batch->id, 'status' => RegistrationStatus::VERIFIED,
        'team_completed_at' => now(), 'members_completed_at' => now(), 'documents_completed_at' => now(), 'submitted_at' => now(),
        'payment_submitted_at' => now(), 'payment_required_at' => now(), 'paid_at' => now(),
    ]);

    return [$team, $team->createToken('t')->plainTextToken, $pre, $semi, $final];
}

test('a team that moved on can still read the result and feedback of the stage it passed, but not change it', function (): void {
    [$team, $token, $pre] = progressTeam();
    Submission::create(['team_id' => $team->id, 'stage_id' => $pre->id, 'title' => 'BMC', 'status' => 'approved', 'score' => 90, 'feedback' => 'Sangat baik', 'submitted_at' => now()->subDays(5), 'reviewed_at' => now()->subDays(3)]);

    $this->withToken($token)->getJson("/api/dashboard/stages/{$pre->id}/submission")
        ->assertOk()
        ->assertJsonPath('data.readOnly', true)
        ->assertJsonPath('data.canSubmit', false)
        ->assertJsonPath('data.submission.status', 'approved')
        ->assertJsonPath('data.submission.score', 90)
        ->assertJsonPath('data.submission.feedback', 'Sangat baik');

    $this->withToken($token)->postJson("/api/dashboard/stages/{$pre->id}/submission", ['title' => 'Diubah'])->assertForbidden();
    $this->withToken($token)->postJson("/api/dashboard/stages/{$pre->id}/submission/submit")->assertForbidden();
    $this->withToken($token)->postJson("/api/dashboard/stages/{$pre->id}/submission/unsubmit")->assertForbidden();

    expect(Submission::where('team_id', $team->id)->where('stage_id', $pre->id)->first()->title)->toBe('BMC');
});

test('the stage the team is on stays editable and a stage it has not reached stays closed', function (): void {
    [, $token, , $semi, $final] = progressTeam();

    $this->withToken($token)->getJson("/api/dashboard/stages/{$semi->id}/submission")
        ->assertOk()
        ->assertJsonPath('data.readOnly', false)
        ->assertJsonPath('data.canSubmit', true);

    $this->withToken($token)->getJson("/api/dashboard/stages/{$final->id}/submission")->assertForbidden();
});

test('a stage of another competition is never readable', function (): void {
    [, $token] = progressTeam();
    $otherCompetition = Competition::factory()->create(['type' => Competition::TYPE_BUSINESS_IT_CASE]);
    $foreign = Stage::create(['competition_id' => $otherCompetition->id, 'name' => 'Preliminary', 'type' => 'submission', 'order' => 1, 'is_active' => true]);

    $this->withToken($token)->getJson("/api/dashboard/stages/{$foreign->id}/submission")->assertForbidden();
});

test('the dashboard summary lists the stages reached with the team result of each and marks the current one', function (): void {
    [$team, $token, $pre, $semi] = progressTeam();
    Submission::create(['team_id' => $team->id, 'stage_id' => $pre->id, 'title' => 'BMC', 'status' => 'approved', 'score' => 88, 'submitted_at' => now()->subDays(5)]);

    $response = $this->withToken($token)->getJson('/api/dashboard/summary')->assertOk();

    expect(collect($response->json('data.stages'))->pluck('name')->all())->toBe(['Preliminary', 'Semifinal'])
        ->and($response->json('data.stages.0'))->toMatchArray(['id' => $pre->id, 'isCurrent' => false, 'submission' => ['status' => 'approved', 'score' => 88]])
        ->and($response->json('data.stages.1'))->toMatchArray(['id' => $semi->id, 'isCurrent' => true, 'submission' => null]);
});

test('olympiad teams get no stage progress because their results come from exams', function (): void {
    [, $token] = progressTeam(Competition::TYPE_OLIMPIADE);

    $this->withToken($token)->getJson('/api/dashboard/summary')->assertOk()->assertJsonPath('data.stages', []);
});
