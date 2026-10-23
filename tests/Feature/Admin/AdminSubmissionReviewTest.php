<?php

use App\Models\Admin;
use App\Models\AdminAuditLog;
use App\Models\Competition;
use App\Models\Stage;
use App\Models\Submission;
use App\Models\Team;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;

uses(LazilyRefreshDatabase::class);

function reviewAdmin(string $role): array
{
    $admin = Admin::factory()->create(['role' => $role, 'is_active' => true]);

    return [$admin, $admin->createToken('a')->plainTextToken];
}

function reviewSubmission(string $status = 'submitted', array $team = []): Submission
{
    $competition = Competition::factory()->create(['type' => Competition::TYPE_BUSINESS_PLAN]);
    $stage = Stage::create(['competition_id' => $competition->id, 'name' => 'Preliminary', 'type' => 'submission', 'order' => 1, 'is_active' => true]);

    return reviewSubmissionAt($stage, $status, $team);
}

function reviewSubmissionAt(Stage $stage, string $status, array $team = []): Submission
{
    return Submission::create([
        'team_id' => Team::factory()->create(array_merge(['status' => Team::STATUS_VERIFIED], $team))->id,
        'stage_id' => $stage->id,
        'title' => 'Proposal',
        'status' => $status,
        'submitted_at' => $status === 'draft' ? null : now(),
    ]);
}

test('a judge can approve a submitted submission with a score and it is audited', function (): void {
    [$judge, $token] = reviewAdmin('judge');
    $submission = reviewSubmission();

    $this->withToken($token)->postJson("/api/admin/submissions/{$submission->id}/review", ['action' => 'approved', 'score' => 85, 'feedback' => 'Bagus'])
        ->assertOk()
        ->assertJsonPath('data.status', 'approved')
        ->assertJsonPath('data.score', 85)
        ->assertJsonPath('data.reviewedBy', $judge->id);

    expect($submission->fresh())->status->toBe('approved')->score->toBe(85)->reviewed_by->toBe($judge->id)
        ->and(AdminAuditLog::where('action', 'judging.review')->where('subject_id', $submission->id)->exists())->toBeTrue();
});

test('approval needs a score and rejection or revision needs feedback', function (): void {
    [, $token] = reviewAdmin('judge');
    $submission = reviewSubmission();
    $url = "/api/admin/submissions/{$submission->id}/review";

    $this->withToken($token)->postJson($url, ['action' => 'approved'])->assertUnprocessable()->assertJsonStructure(['error' => ['details' => ['score']]]);
    $this->withToken($token)->postJson($url, ['action' => 'approved', 'score' => 101])->assertUnprocessable()->assertJsonStructure(['error' => ['details' => ['score']]]);
    $this->withToken($token)->postJson($url, ['action' => 'rejected'])->assertUnprocessable()->assertJsonStructure(['error' => ['details' => ['feedback']]]);
    $this->withToken($token)->postJson($url, ['action' => 'revision_requested', 'feedback' => '   '])->assertUnprocessable()->assertJsonStructure(['error' => ['details' => ['feedback']]]);
    $this->withToken($token)->postJson($url, ['action' => 'revision_requested', 'feedback' => 'Lengkapi BMC'])->assertOk()->assertJsonPath('data.status', 'revision_requested');
});

test('a draft cannot be put under review or approved because the team never handed it in', function (): void {
    [, $token] = reviewAdmin('judge');
    $submission = reviewSubmission('draft');
    $url = "/api/admin/submissions/{$submission->id}/review";

    $this->withToken($token)->postJson($url, ['action' => 'under_review'])->assertUnprocessable()->assertJsonStructure(['error' => ['details' => ['status']]]);
    $this->withToken($token)->postJson($url, ['action' => 'approved', 'score' => 90])->assertUnprocessable()->assertJsonStructure(['error' => ['details' => ['status']]]);

    expect($submission->fresh()->status)->toBe('draft');
});

test('a submitted submission can move to under review', function (): void {
    [, $token] = reviewAdmin('judge');
    $submission = reviewSubmission();

    $this->withToken($token)->postJson("/api/admin/submissions/{$submission->id}/review", ['action' => 'under_review'])
        ->assertOk()
        ->assertJsonPath('data.status', 'under_review');
});

test('registration admins can view submissions but not review them, payment admins cannot see them', function (): void {
    $submission = reviewSubmission();

    [, $registration] = reviewAdmin('admin_registration');
    $this->withToken($registration)->getJson("/api/admin/submissions/{$submission->id}")->assertOk();
    $this->withToken($registration)->getJson("/api/admin/stages/{$submission->stage_id}/submissions")->assertOk();
    $this->withToken($registration)->postJson("/api/admin/submissions/{$submission->id}/review", ['action' => 'under_review'])->assertForbidden();

    app('auth')->forgetGuards();
    [, $payment] = reviewAdmin('admin_payment');
    $this->withToken($payment)->getJson("/api/admin/submissions/{$submission->id}")->assertForbidden();
    $this->withToken($payment)->getJson("/api/admin/stages/{$submission->stage_id}/submissions")->assertForbidden();

    expect($submission->fresh()->status)->toBe('submitted');
});

test('the stage list hides drafts unless asked, filters by status and team, puts the unreviewed first, and paginates', function (): void {
    [, $token] = reviewAdmin('judge');
    $competition = Competition::factory()->create(['type' => Competition::TYPE_BUSINESS_PLAN]);
    $stage = Stage::create(['competition_id' => $competition->id, 'name' => 'Preliminary', 'type' => 'submission', 'order' => 1, 'is_active' => true]);
    reviewSubmissionAt($stage, 'approved', ['code' => 'ISAC-TM-A', 'name' => 'Alpha']);
    reviewSubmissionAt($stage, 'submitted', ['code' => 'ISAC-TM-B', 'name' => 'Beta']);
    reviewSubmissionAt($stage, 'revision_requested', ['code' => 'ISAC-TM-C', 'name' => 'Gamma']);
    reviewSubmissionAt($stage, 'draft', ['code' => 'ISAC-TM-D', 'name' => 'Delta']);
    $url = "/api/admin/stages/{$stage->id}/submissions";

    $all = $this->withToken($token)->getJson($url)->assertOk();
    expect(collect($all->json('data.data'))->pluck('team.code')->all())->toBe(['ISAC-TM-B', 'ISAC-TM-C', 'ISAC-TM-A'])
        ->and($all->json('data.meta.total'))->toBe(3);

    $this->withToken($token)->getJson("{$url}?status=draft")->assertOk()->assertJsonCount(1, 'data.data')->assertJsonPath('data.data.0.team.code', 'ISAC-TM-D');
    $this->withToken($token)->getJson("{$url}?status=approved")->assertOk()->assertJsonCount(1, 'data.data')->assertJsonPath('data.data.0.team.code', 'ISAC-TM-A');
    $this->withToken($token)->getJson("{$url}?search=gamma")->assertOk()->assertJsonCount(1, 'data.data')->assertJsonPath('data.data.0.team.code', 'ISAC-TM-C');
    $this->withToken($token)->getJson("{$url}?per_page=2&page=2")->assertOk()->assertJsonCount(1, 'data.data')->assertJsonPath('data.meta.last_page', 2);
});
