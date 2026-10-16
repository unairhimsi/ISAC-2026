<?php

use App\Models\Admin;
use App\Models\Competition;
use App\Models\Member;
use App\Models\Registration;
use App\Models\RegistrationStatus;
use App\Models\Team;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;

uses(LazilyRefreshDatabase::class);

function teamListToken(string $role = 'admin_registration'): string
{
    return Admin::factory()->create(['role' => $role, 'is_active' => true])->createToken('t')->plainTextToken;
}

/** @return list<string> */
function teamListCodes($response): array
{
    return collect($response->json('data.data'))->pluck('team.code')->sort()->values()->all();
}

test('admin team list searches by code, name, email and institution', function (): void {
    $alpha = Team::factory()->create(['code' => 'ISAC-ALPHA', 'name' => 'Garuda Muda', 'email' => 'garuda@example.test', 'institution_name' => 'SMA Negeri 1 Surabaya']);
    Team::factory()->create(['code' => 'ISAC-BETA', 'name' => 'Elang Perkasa', 'email' => 'elang@example.test', 'institution_name' => 'Universitas Airlangga']);
    $token = teamListToken();

    foreach (['ISAC-ALPHA', 'garuda muda', 'garuda@example', 'Surabaya'] as $term) {
        $response = $this->withToken($token)->getJson('/api/admin/teams?search='.urlencode($term))->assertOk();
        expect(teamListCodes($response))->toBe([$alpha->code], "search term: {$term}");
    }

    $this->withToken($token)->getJson('/api/admin/teams?search=tidak-ada-yang-cocok')->assertOk()
        ->assertJsonPath('data.meta.total', 0);
});

test('admin team list searches by member name, email and student id', function (): void {
    $team = Team::factory()->create(['code' => 'ISAC-MEMBER']);
    Team::factory()->create(['code' => 'ISAC-OTHER']);
    Member::query()->create([
        'team_id' => $team->id, 'name' => 'Budi Santoso', 'role' => 'LEADER', 'email' => 'budi.peserta@example.test',
        'student_id' => '081234567', 'sort_order' => 1,
    ]);
    $token = teamListToken();

    foreach (['Santoso', 'budi.peserta', '081234567'] as $term) {
        $response = $this->withToken($token)->getJson('/api/admin/teams?search='.urlencode($term))->assertOk();
        expect(teamListCodes($response))->toBe(['ISAC-MEMBER'], "search term: {$term}");
    }
});

test('admin team list combines search with status and competition filters', function (): void {
    $competition = Competition::factory()->create(['type' => Competition::TYPE_BUSINESS_PLAN]);
    $verified = Team::factory()->create(['code' => 'ISAC-ONE', 'name' => 'Tim Sama', 'status' => Team::STATUS_VERIFIED]);
    $waiting = Team::factory()->create(['code' => 'ISAC-TWO', 'name' => 'Tim Sama', 'status' => Team::STATUS_WAITING_VERIFICATION]);
    foreach ([$verified, $waiting] as $team) {
        Registration::query()->create(['team_id' => $team->id, 'competition_id' => $competition->id, 'status' => RegistrationStatus::WAITING_VERIFICATION]);
    }
    $token = teamListToken();

    $both = $this->withToken($token)->getJson('/api/admin/teams?search=Tim+Sama')->assertOk();
    expect(teamListCodes($both))->toBe(['ISAC-ONE', 'ISAC-TWO']);

    $onlyVerified = $this->withToken($token)->getJson('/api/admin/teams?search=Tim+Sama&status=VERIFIED&competition_id='.$competition->id)->assertOk();
    expect(teamListCodes($onlyVerified))->toBe(['ISAC-ONE']);
});

test('admin team list treats a blank search as no filter', function (): void {
    Team::factory()->count(2)->create();
    $token = teamListToken();

    $this->withToken($token)->getJson('/api/admin/teams?search=%20%20')->assertOk()->assertJsonPath('data.meta.total', 2);
});

test('admin team list rejects invalid filters instead of failing in the query', function (): void {
    $token = teamListToken();

    $this->withToken($token)->getJson('/api/admin/teams?status=BUKAN_STATUS')->assertUnprocessable();
    $this->withToken($token)->getJson('/api/admin/teams?competition_id=bukan-uuid')->assertUnprocessable();
    $this->withToken($token)->getJson('/api/admin/teams?search='.str_repeat('a', 101))->assertUnprocessable();
});

test('admin team list is still forbidden for roles without access', function (): void {
    $this->withToken(teamListToken('judge'))->getJson('/api/admin/teams?search=apa-saja')->assertForbidden();
});

test('admin team list clamps oversized per_page instead of rejecting it', function (): void {
    Team::factory()->create();

    $this->withToken(teamListToken())->getJson('/api/admin/teams?per_page=1000')->assertOk()->assertJsonPath('data.meta.per_page', 100);
});
