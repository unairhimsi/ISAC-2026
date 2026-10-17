<?php

use App\Models\BatchStatus;
use App\Models\Competition;
use App\Models\File;
use App\Models\Registration;
use App\Models\RegistrationStatus;
use App\Models\Team;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;

uses(LazilyRefreshDatabase::class);

/**
 * @return array{0: Team, 1: string, 2: Registration}
 */
function registeredTeam(Competition $competition, array $registration = []): array
{
    $team = Team::factory()->create();
    $batch = $competition->batches()->create([
        'name' => 'Batch', 'slug' => 'upsert-'.uniqid(),
        'start_date' => now(), 'end_date' => now()->addMonth(),
        'price' => 100000, 'quota' => 50, 'status' => BatchStatus::OPEN,
    ]);
    $row = Registration::query()->create([
        'competition_id' => $competition->id,
        'batch_id' => $batch->id,
        'team_id' => $team->id,
        'status' => RegistrationStatus::WAITING_PAYMENT,
        'team_completed_at' => now(),
        ...$registration,
    ]);

    return [$team, $team->createToken('auth-token')->plainTextToken, $row];
}

function openCompetition(string $type): Competition
{
    return Competition::factory()->create([
        'status' => Competition::STATUS_REGISTRATION_OPEN,
        'type' => $type,
    ]);
}

function saveMembers(string $token, array $members): Illuminate\Testing\TestResponse
{
    // The auth guard caches the first resolved user, so switch teams explicitly.
    app('auth')->forgetGuards();

    return test()->withToken($token)->putJson('/api/registrations/me/members', ['members' => $members]);
}

function memberPayload(string $name, string $role, ?string $id = null, ?string $photo = null): array
{
    $slug = strtolower(str_replace(' ', '', $name));

    return array_filter([
        'id' => $id,
        'name' => $name,
        'role' => $role,
        'email' => "{$slug}@example.test",
        'student_id' => strtoupper($slug).'-ID',
        'photo_file_id' => $photo,
    ], fn (mixed $value): bool => $value !== null);
}

test('saving the same members twice updates the rows instead of creating new ones', function (): void {
    [$team, $token] = registeredTeam(openCompetition(Competition::TYPE_BUSINESS_PLAN));
    $payload = ['members' => [memberPayload('Alpha One', 'LEADER'), memberPayload('Beta Two', 'MEMBER')]];

    $this->withToken($token)->putJson('/api/registrations/me/members', $payload)->assertOk();
    $firstIds = $team->members()->orderBy('sort_order')->pluck('id')->all();

    $payload['members'][0]['id'] = $firstIds[0];
    $payload['members'][1]['id'] = $firstIds[1];
    $payload['members'][1]['name'] = 'Beta Renamed';
    $this->withToken($token)->putJson('/api/registrations/me/members', $payload)->assertOk();

    expect($team->members()->withTrashed()->count())->toBe(2);
    expect($team->members()->orderBy('sort_order')->pluck('id')->all())->toBe($firstIds);
    expect($team->members()->orderBy('sort_order')->pluck('name')->all())->toBe(['Alpha One', 'Beta Renamed']);
});

test('a removed participant can be added back with the same email', function (): void {
    [$team, $token] = registeredTeam(openCompetition(Competition::TYPE_BUSINESS_PLAN));
    $leader = memberPayload('Alpha One', 'LEADER');
    $other = memberPayload('Beta Two', 'MEMBER');

    saveMembers($token, [$leader, $other])->assertOk();
    $originalId = $team->members()->where('email', $other['email'])->value('id');

    saveMembers($token, [$leader])->assertOk();
    expect($team->members()->count())->toBe(1);

    saveMembers($token, [$leader, [...$other, 'name' => 'Beta Back']])
        ->assertOk();

    expect($team->members()->count())->toBe(2);
    expect($team->members()->withTrashed()->count())->toBe(2);
    expect($team->members()->where('email', $other['email'])->first())
        ->id->toBe($originalId)
        ->name->toBe('Beta Back');
});

test('the same person can join teams of different competitions', function (): void {
    [, $tokenA] = registeredTeam(openCompetition(Competition::TYPE_BUSINESS_PLAN));
    [$teamB, $tokenB] = registeredTeam(openCompetition(Competition::TYPE_OLIMPIADE));
    $person = memberPayload('Shared Person', 'LEADER');

    saveMembers($tokenA, [$person])->assertOk();
    saveMembers($tokenB, [$person])->assertOk();

    expect($teamB->members()->count())->toBe(1);
});

test('the same person cannot join two teams of the same competition', function (): void {
    $competition = openCompetition(Competition::TYPE_BUSINESS_PLAN);
    [, $tokenA] = registeredTeam($competition);
    [, $tokenB] = registeredTeam($competition);
    $person = memberPayload('Shared Person', 'LEADER');

    saveMembers($tokenA, [$person])->assertOk();
    $response = saveMembers($tokenB, [$person])->assertUnprocessable();

    expect(array_keys($response->json('error.details')))
        ->toContain('members.0.email', 'members.0.student_id');
});

test('a participant removed from a team no longer blocks the same competition', function (): void {
    $competition = openCompetition(Competition::TYPE_BUSINESS_PLAN);
    [, $tokenA] = registeredTeam($competition);
    [, $tokenB] = registeredTeam($competition);
    $stay = memberPayload('Stay Here', 'LEADER');
    $leaves = memberPayload('Moves Away', 'MEMBER');

    saveMembers($tokenA, [$stay, $leaves])->assertOk();
    saveMembers($tokenA, [$stay])->assertOk();

    saveMembers($tokenB, [[...$leaves, 'role' => 'LEADER']])->assertOk();
});

test('re-saving members keeps a photo the team already stores', function (): void {
    [$team, $token] = registeredTeam(openCompetition(Competition::TYPE_OLIMPIADE));
    $legacyPhoto = File::query()->create([
        'file_id' => 'legacy-photo', 'url' => 'https://ik.imagekit.io/isac/legacy.png',
        'purpose' => 'MEMBER_PHOTO', 'uploaded_by' => null,
    ]);
    $team->members()->create([
        ...memberPayload('Solo Player', 'LEADER'), 'photo_file_id' => $legacyPhoto->id, 'sort_order' => 1,
    ]);
    $memberId = $team->members()->value('id');

    $this->withToken($token)
        ->putJson('/api/registrations/me/members', [
            'members' => [memberPayload('Solo Player', 'LEADER', $memberId, $legacyPhoto->id)],
        ])
        ->assertOk();

    expect($team->members()->value('photo_file_id'))->toBe($legacyPhoto->id);
});

test('a photo the team does not store yet must still be owned by the team', function (): void {
    [, $token] = registeredTeam(openCompetition(Competition::TYPE_OLIMPIADE));
    $stranger = File::query()->create([
        'file_id' => 'unowned-photo', 'url' => 'https://ik.imagekit.io/isac/unowned.png',
        'purpose' => 'MEMBER_PHOTO', 'uploaded_by' => null,
    ]);

    $this->withToken($token)
        ->putJson('/api/registrations/me/members', [
            'members' => [memberPayload('Solo Player', 'LEADER', null, $stranger->id)],
        ])
        ->assertUnprocessable()
        ->assertJsonPath('error.details.photo_file_id.0', 'File tidak valid atau bukan milik Team ini.');
});

test('the payment form returns the submitted method and transaction id', function (): void {
    [, $token] = registeredTeam(openCompetition(Competition::TYPE_OLIMPIADE), [
        'payment_submitted_at' => now(),
        'payment_method' => 'QRIS',
        'transaction_id' => 'TP-20261018-XYZ',
    ]);

    $this->withToken($token)
        ->getJson('/api/registrations/me/payment')
        ->assertOk()
        ->assertJsonPath('data.paymentMethod', 'QRIS')
        ->assertJsonPath('data.transactionId', 'TP-20261018-XYZ');
});

test('the payment form has no method or transaction id before anything is submitted', function (): void {
    [, $token] = registeredTeam(openCompetition(Competition::TYPE_OLIMPIADE));

    $this->withToken($token)
        ->getJson('/api/registrations/me/payment')
        ->assertOk()
        ->assertJsonPath('data.paymentMethod', null)
        ->assertJsonPath('data.transactionId', null);
});

test('submitting for verification again does not undo an admin decision', function (): void {
    foreach ([Team::STATUS_VERIFIED, Team::STATUS_REJECTED] as $status) {
        [$team, $token] = registeredTeam(openCompetition(Competition::TYPE_OLIMPIADE), [
            'members_completed_at' => now(),
            'documents_completed_at' => now(),
            'payment_submitted_at' => now(),
            'submitted_at' => now(),
        ]);
        $team->update(['status' => $status, 'verification_note' => 'Keputusan admin']);

        app('auth')->forgetGuards();
        $this->withToken($token)->postJson('/api/registrations/me/submit-verification')->assertOk();

        expect($team->fresh())
            ->status->toBe($status)
            ->verification_note->toBe('Keputusan admin');
    }
});

function selectCompetitionAs(string $token, Competition $competition): Illuminate\Testing\TestResponse
{
    app('auth')->forgetGuards();

    return test()->withToken($token)->putJson('/api/registrations/me/selection', ['competition_id' => $competition->id]);
}

function openBatchFor(Competition $competition): void
{
    $competition->batches()->create([
        'name' => 'Batch', 'slug' => 'switch-'.uniqid(),
        'start_date' => now()->subDay(), 'end_date' => now()->addMonth(),
        'price' => 90000, 'quota' => 50, 'status' => BatchStatus::OPEN,
    ]);
}

test('an unpaid team can switch competition and keeps what it already filled in', function (): void {
    $from = openCompetition(Competition::TYPE_BUSINESS_PLAN);
    $to = openCompetition(Competition::TYPE_BUSINESS_IT_CASE);
    openBatchFor($to);
    [$team, $token, $registration] = registeredTeam($from, [
        'batch_id' => null,
        'members_completed_at' => now(),
        'documents_completed_at' => now(),
    ]);
    $team->update(['name' => 'Tim Lama', 'institution_name' => 'SMAN 1 Surabaya']);
    $team->members()->create([...memberPayload('Alpha One', 'LEADER'), 'sort_order' => 1]);
    $batchQuota = $to->batches()->sum('current_registrations');

    selectCompetitionAs($token, $to)
        ->assertOk()
        ->assertJsonPath('data.context.registration.competition.id', $to->id)
        ->assertJsonPath('data.context.registration.competitionLocked', false)
        ->assertJsonPath('data.context.currentStep', 'TEAM')
        ->assertJsonPath('data.redirectTo', '/registration/team');

    $registration->refresh();
    expect(Registration::withTrashed()->where('team_id', $team->id)->count())->toBe(1);
    expect($registration)
        ->competition_id->toBe($to->id)
        ->batch_id->toBeNull()
        ->team_completed_at->toBeNull()
        ->members_completed_at->toBeNull()
        ->documents_completed_at->toBeNull();
    expect($team->fresh())->name->toBe('Tim Lama')->institution_name->toBe('SMAN 1 Surabaya');
    expect($team->members()->count())->toBe(1);
    expect($to->batches()->sum('current_registrations'))->toBe($batchQuota);
});

test('the competition cannot be switched once payment is on its way', function (array $locked): void {
    $from = openCompetition(Competition::TYPE_OLIMPIADE);
    $to = openCompetition(Competition::TYPE_BUSINESS_PLAN);
    openBatchFor($to);
    [, $token, $registration] = registeredTeam($from, $locked);

    selectCompetitionAs($token, $to)
        ->assertUnprocessable()
        ->assertJsonPath('error.details.competition_id.0', 'Kompetisi tidak dapat diubah setelah pembayaran dikirim.');

    expect($registration->fresh()->competition_id)->toBe($from->id);
})->with([
    'payment submitted' => [['batch_id' => null, 'payment_submitted_at' => now()]],
    'submitted for verification' => [['batch_id' => null, 'submitted_at' => now()]],
    'status past waiting payment' => [['batch_id' => null, 'status' => RegistrationStatus::WAITING_VERIFICATION]],
    'batch claimed' => [[]],
]);

test('the context says whether the competition is still switchable', function (): void {
    [, $openToken] = registeredTeam(openCompetition(Competition::TYPE_OLIMPIADE), ['batch_id' => null]);
    [, $lockedToken] = registeredTeam(openCompetition(Competition::TYPE_OLIMPIADE), ['payment_submitted_at' => now()]);

    app('auth')->forgetGuards();
    $this->withToken($openToken)->getJson('/api/registrations/me/context')
        ->assertOk()->assertJsonPath('data.registration.competitionLocked', false);

    app('auth')->forgetGuards();
    $this->withToken($lockedToken)->getJson('/api/registrations/me/context')
        ->assertOk()->assertJsonPath('data.registration.competitionLocked', true);
});

test('switching is refused for a competition that is closed or has no open batch', function (): void {
    $from = openCompetition(Competition::TYPE_OLIMPIADE);
    $closed = Competition::factory()->create([
        'status' => Competition::STATUS_REGISTRATION_CLOSED,
        'type' => Competition::TYPE_BUSINESS_PLAN,
    ]);
    openBatchFor($closed);
    $noBatch = openCompetition(Competition::TYPE_BUSINESS_IT_CASE);
    [, $token, $registration] = registeredTeam($from, ['batch_id' => null]);

    selectCompetitionAs($token, $closed)
        ->assertUnprocessable()
        ->assertJsonPath('error.details.competition_id.0', 'Pendaftaran kompetisi belum dibuka.');
    selectCompetitionAs($token, $noBatch)
        ->assertUnprocessable()
        ->assertJsonPath('error.details.competition_id.0', 'Belum ada Batch aktif dengan kuota tersedia untuk kompetisi ini.');

    expect($registration->fresh()->competition_id)->toBe($from->id);
});

test('switching back and forth keeps a single registration row', function (): void {
    $a = openCompetition(Competition::TYPE_BUSINESS_PLAN);
    $b = openCompetition(Competition::TYPE_BUSINESS_IT_CASE);
    openBatchFor($a);
    openBatchFor($b);
    [$team, $token] = registeredTeam($a, ['batch_id' => null]);

    selectCompetitionAs($token, $b)->assertOk();
    selectCompetitionAs($token, $a)->assertOk();
    selectCompetitionAs($token, $a)->assertOk();

    expect(Registration::withTrashed()->where('team_id', $team->id)->count())->toBe(1);
    expect($team->registration()->value('competition_id'))->toBe($a->id);
});
