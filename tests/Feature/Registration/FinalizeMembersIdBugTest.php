<?php

use App\Models\BatchStatus;
use App\Models\Competition;
use App\Models\File;
use App\Models\Registration;
use App\Models\RegistrationStatus;
use App\Models\Team;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;

uses(LazilyRefreshDatabase::class);

beforeEach(function (): void {
    $this->team = Team::factory()->create();
    $this->token = $this->team->createToken('auth-token')->plainTextToken;
    $this->competition = Competition::factory()->create([
        'status' => Competition::STATUS_REGISTRATION_OPEN,
        'type' => Competition::TYPE_BUSINESS_PLAN,
    ]);
    $this->batch = $this->competition->batches()->create([
        'name' => 'Batch 1', 'slug' => 'batch-bug-'.uniqid(),
        'start_date' => now(), 'end_date' => now()->addMonth(),
        'price' => 100000, 'quota' => 50, 'status' => BatchStatus::OPEN,
    ]);
    Registration::query()->create([
        'competition_id' => $this->competition->id,
        'batch_id' => $this->batch->id,
        'team_id' => $this->team->id,
        'status' => RegistrationStatus::WAITING_PAYMENT,
        'team_completed_at' => now(),
    ]);
});

test('finalizeMembers must preserve member ids when payload contains ids in different order (RED for sort_order bug)', function (): void {
    // Create 3 distinct members with known sort_order
    $m1 = $this->team->members()->create([
        'name' => 'Member One', 'role' => 'LEADER', 'email' => 'one@example.test',
        'student_id' => '111', 'sort_order' => 1,
    ]);
    $m2 = $this->team->members()->create([
        'name' => 'Member Two', 'role' => 'MEMBER', 'email' => 'two@example.test',
        'student_id' => '222', 'sort_order' => 2,
    ]);
    $m3 = $this->team->members()->create([
        'name' => 'Member Three', 'role' => 'MEMBER', 'email' => 'three@example.test',
        'student_id' => '333', 'sort_order' => 3,
    ]);

    // Payload reorders ids: M3 first, M1 second, M2 third with updated names to track movement
    $payload = [
        ['id' => $m3->id, 'name' => 'A Updated', 'role' => 'LEADER', 'email' => 'a@example.test', 'student_id' => '999'],
        ['id' => $m1->id, 'name' => 'B Updated', 'role' => 'MEMBER', 'email' => 'b@example.test', 'student_id' => '888'],
        ['id' => $m2->id, 'name' => 'C Updated', 'role' => 'MEMBER', 'email' => 'c@example.test', 'student_id' => '777'],
    ];

    $this->withToken($this->token)
        ->putJson('/api/registrations/me/members', ['members' => $payload])
        ->assertOk();

    $fresh = $this->team->fresh()->load(['members' => fn ($q) => $q->orderBy('sort_order')]);
    $orderedIds = $fresh->members->pluck('id')->toArray();
    $orderedNames = $fresh->members->pluck('name')->toArray();

    // Expected: ids follow payload order (M3, M1, M2) and names match payload order
    expect($orderedIds)->toBe([$m3->id, $m1->id, $m2->id]);
    expect($orderedNames)->toBe(['A Updated', 'B Updated', 'C Updated']);
});

test('finalizeMembers must retain existing photo when payload omits photo_file_id key', function (): void {
    $photo = File::query()->create([
        'file_id' => 'keep-photo-'.uniqid(),
        'url' => 'https://ik.imagekit.io/isac/keep.png',
        'purpose' => 'MEMBER_PHOTO',
        'uploaded_by' => $this->team->id,
    ]);

    $m1 = $this->team->members()->create([
        'name' => 'Leader', 'role' => 'LEADER', 'email' => 'leader@example.test',
        'student_id' => '111', 'photo_file_id' => $photo->id, 'sort_order' => 1,
    ]);
    $m2 = $this->team->members()->create([
        'name' => 'Two', 'role' => 'MEMBER', 'email' => 'two@example.test',
        'student_id' => '222', 'sort_order' => 2,
    ]);
    $m3 = $this->team->members()->create([
        'name' => 'Three', 'role' => 'MEMBER', 'email' => 'three@example.test',
        'student_id' => '333', 'sort_order' => 3,
    ]);

    // Send payload without photo_file_id key for first member — should retain photo
    $payload = [
        ['id' => $m1->id, 'name' => 'Leader Updated', 'role' => 'LEADER', 'email' => 'leader@example.test', 'student_id' => '111'],
        ['id' => $m2->id, 'name' => 'Two Updated', 'role' => 'MEMBER', 'email' => 'two@example.test', 'student_id' => '222'],
        ['id' => $m3->id, 'name' => 'Three Updated', 'role' => 'MEMBER', 'email' => 'three@example.test', 'student_id' => '333'],
    ];

    $this->withToken($this->token)
        ->putJson('/api/registrations/me/members', ['members' => $payload])
        ->assertOk();

    $freshM1 = $this->team->members()->whereKey($m1->id)->first();
    expect($freshM1->photo_file_id)->toBe($photo->id);
});
