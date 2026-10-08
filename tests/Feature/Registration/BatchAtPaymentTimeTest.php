<?php

use App\Models\Admin;
use App\Models\BatchStatus;
use App\Models\Competition;
use App\Models\File;
use App\Models\Registration;
use App\Models\RegistrationStatus;
use App\Models\Team;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;

uses(LazilyRefreshDatabase::class);

beforeEach(function (): void {
    config()->set('registration.promo.code', 'ISAXOP');
    config()->set('registration.promo.discount_percent', 15);

    $this->team = Team::factory()->create();
    $this->token = $this->team->createToken('auth-token')->plainTextToken;
    $this->competition = Competition::factory()->create([
        'status' => Competition::STATUS_REGISTRATION_OPEN,
        'type' => Competition::TYPE_OLIMPIADE,
    ]);
    // Early Bird berlaku sekarang s/d 5 hari lagi; Reguler baru mulai 6 hari lagi.
    $this->batch1 = $this->competition->batches()->create([
        'name' => 'Early Bird', 'slug' => 'early-bird',
        'start_date' => now()->subDay(), 'end_date' => now()->addDays(5),
        'price' => 100000, 'quota' => 10, 'status' => BatchStatus::OPEN,
    ]);
    $this->batch2 = $this->competition->batches()->create([
        'name' => 'Reguler', 'slug' => 'reguler',
        'start_date' => now()->addDays(6), 'end_date' => now()->addDays(30),
        'price' => 150000, 'quota' => 10, 'status' => BatchStatus::OPEN,
    ]);
});

/** Daftar lewat API lalu lengkapi data tim sampai tahap pembayaran. */
function registerUpToPayment($test): Registration
{
    $test->withToken($test->token)
        ->putJson('/api/registrations/me/selection', ['competition_id' => $test->competition->id])
        ->assertOk();

    $registration = $test->team->registration()->firstOrFail();
    $registration->update([
        'team_completed_at' => now(),
        'members_completed_at' => now(),
        'documents_completed_at' => now(),
    ]);

    return $registration;
}

function newPaymentProof(Team $team): File
{
    return File::query()->create([
        'file_id' => 'proof-'.fake()->unique()->numerify('#####'),
        'url' => 'https://ik.imagekit.io/isac/proof.pdf',
        'uploaded_by' => $team->id,
        'purpose' => 'PAYMENT_PROOF',
    ]);
}

function payNow($test, ?File $proof = null, array $extra = [])
{
    return $test->withToken($test->token)->postJson('/api/registrations/me/payment', [
        'payment_proof_file_id' => ($proof ?? newPaymentProof($test->team))->id,
        'payment_method' => 'BANK_TRANSFER',
        ...$extra,
    ]);
}

test('a team that registers in Batch 1 but pays in Batch 2 is placed in Batch 2', function (): void {
    $registration = registerUpToPayment($this);
    expect($registration->fresh()->batch_id)->toBeNull();

    $this->travelTo(now()->addDays(10));
    payNow($this)->assertOk();

    $registration = $registration->fresh();
    expect($registration->batch_id)->toBe($this->batch2->id)
        ->and($registration->amount_paid)->toBe('150000.00')
        ->and($this->batch1->fresh()->current_registrations)->toBe(0)
        ->and($this->batch2->fresh()->current_registrations)->toBe(1);
});

test('a team that pays while Batch 1 is active is placed in Batch 1', function (): void {
    $registration = registerUpToPayment($this);

    payNow($this)->assertOk();

    expect($registration->fresh()->batch_id)->toBe($this->batch1->id)
        ->and($registration->fresh()->amount_paid)->toBe('100000.00');
});

test('the price quote follows the batch active at quoting time, not at registration', function (): void {
    registerUpToPayment($this);

    $quote = fn () => $this->withToken($this->token)
        ->postJson('/api/registrations/me/payment/quote', ['promo_code' => 'isaxop'])
        ->assertOk();

    $quote()->assertJsonPath('data.originalAmount', 100000)->assertJsonPath('data.amount', 85000);

    $this->travelTo(now()->addDays(10));

    $quote()->assertJsonPath('data.originalAmount', 150000)->assertJsonPath('data.amount', 127500);
    $this->withToken($this->token)->getJson('/api/registrations/me/payment')
        ->assertOk()
        ->assertJsonPath('data.batch.name', 'Reguler')
        ->assertJsonPath('data.batchLocked', false)
        ->assertJsonPath('data.originalAmount', 150000);
});

test('quota is consumed when payment is submitted, not at registration', function (): void {
    $registration = registerUpToPayment($this);
    expect($this->batch1->fresh()->current_registrations)->toBe(0);

    payNow($this)->assertOk();

    expect($this->batch1->fresh()->current_registrations)->toBe(1);
    $this->withToken($this->token)->getJson('/api/registrations/me/payment')
        ->assertOk()
        ->assertJsonPath('data.batch.name', 'Early Bird')
        ->assertJsonPath('data.batchLocked', true);
});

test('resubmitting after a revision keeps the original batch and does not use extra quota', function (): void {
    $registration = registerUpToPayment($this);
    payNow($this)->assertOk();
    $registration->fresh()->update(['status' => RegistrationStatus::REVISION_REQUIRED]);

    $this->travelTo(now()->addDays(10));
    payNow($this)->assertOk();

    $registration = $registration->fresh();
    expect($registration->batch_id)->toBe($this->batch1->id)
        ->and($registration->amount_paid)->toBe('100000.00')
        ->and($registration->status)->toBe(RegistrationStatus::WAITING_VERIFICATION)
        ->and($this->batch1->fresh()->current_registrations)->toBe(1)
        ->and($this->batch2->fresh()->current_registrations)->toBe(0);
});

test('repeating the same payment does not consume quota twice', function (): void {
    registerUpToPayment($this);
    $proof = newPaymentProof($this->team);

    payNow($this, $proof)->assertOk();
    payNow($this, $proof)->assertOk();
    expect($this->batch1->fresh()->current_registrations)->toBe(1);

    // Bukti lain setelah pembayaran terkirim ditolak dan juga tidak menambah kuota.
    payNow($this)->assertUnprocessable();
    expect($this->batch1->fresh()->current_registrations)->toBe(1);
});

test('payment is refused and nothing changes when no batch is active at payment time', function (): void {
    $registration = registerUpToPayment($this);
    $this->travelTo(now()->addDays(40));

    payNow($this)
        ->assertUnprocessable()
        ->assertJsonPath('error.details.payment.0', 'Belum ada Batch aktif dengan kuota tersedia untuk pembayaran saat ini.');
    $this->withToken($this->token)->postJson('/api/registrations/me/payment/quote', ['promo_code' => 'isaxop'])
        ->assertUnprocessable();

    $registration = $registration->fresh();
    expect($registration->batch_id)->toBeNull()
        ->and($registration->status)->toBe(RegistrationStatus::WAITING_PAYMENT)
        ->and($registration->payment_submitted_at)->toBeNull()
        ->and($this->team->fresh()->status)->toBe($this->team->status)
        ->and($this->batch1->fresh()->current_registrations)->toBe(0)
        ->and($this->batch2->fresh()->current_registrations)->toBe(0);
});

test('a batch that filled up before payment is skipped until the next batch opens', function (): void {
    $registration = registerUpToPayment($this);
    // Kursi Early Bird diambil tim lain yang membayar lebih dulu.
    $this->batch1->update(['current_registrations' => 10]);

    payNow($this)->assertUnprocessable();
    expect($registration->fresh()->batch_id)->toBeNull();

    $this->travelTo(now()->addDays(10));
    payNow($this)->assertOk();
    expect($registration->fresh()->batch_id)->toBe($this->batch2->id);
});

test('read endpoints work for a team that has not paid yet and has no batch', function (): void {
    $registration = registerUpToPayment($this);
    $headers = ['Authorization' => 'Bearer '.$this->token];

    $this->withHeaders($headers)->getJson('/api/registrations/me/context')
        ->assertOk()->assertJsonPath('data.registration.batch', null);
    $this->withHeaders($headers)->getJson('/api/registrations/me/summary')
        ->assertOk()->assertJsonPath('data.registration.batch', null);
    $this->withHeaders($headers)->getJson('/api/dashboard/summary')
        ->assertOk()->assertJsonPath('data.payment.originalAmount', 100000);

    $admin = Admin::factory()->create(['role' => 'super_admin', 'is_active' => true]);
    $adminToken = $admin->createToken('admin')->plainTextToken;
    $this->withToken($adminToken)->getJson('/api/admin/payments')
        ->assertOk()->assertJsonPath('data.data.0.batch', null);
    $this->withToken($adminToken)->getJson('/api/admin/payments/'.$registration->id)
        ->assertOk()->assertJsonPath('data.batch', null);
    $this->withToken($adminToken)->getJson('/api/admin/teams')->assertOk();
});

test('migration releases batch and quota of registrations that have not paid, and leaves paid ones alone', function (): void {
    $unpaidTeam = Team::factory()->create();
    $paidTeam = Team::factory()->create();
    $unpaid = Registration::query()->create([
        'competition_id' => $this->competition->id, 'batch_id' => $this->batch1->id, 'team_id' => $unpaidTeam->id,
        'status' => RegistrationStatus::WAITING_PAYMENT, 'payment_required_at' => now(),
    ]);
    $paid = Registration::query()->create([
        'competition_id' => $this->competition->id, 'batch_id' => $this->batch1->id, 'team_id' => $paidTeam->id,
        'status' => RegistrationStatus::WAITING_VERIFICATION, 'payment_required_at' => now(),
        'payment_submitted_at' => now(), 'amount_paid' => 100000,
    ]);
    $this->batch1->update(['current_registrations' => 2]);

    (require database_path('migrations/2026_10_08_000001_assign_registration_batch_at_payment.php'))->up();

    expect($unpaid->fresh()->batch_id)->toBeNull()
        ->and($paid->fresh()->batch_id)->toBe($this->batch1->id)
        ->and($this->batch1->fresh()->current_registrations)->toBe(1);
});

test('audit command reports payments that fall outside their batch period and changes nothing', function (): void {
    $this->artisan('registrations:audit-batches')
        ->expectsOutputToContain('Semua pembayaran jatuh di dalam periode batch-nya.')
        ->assertSuccessful();

    // Daftar di Early Bird, tapi bukti bayar masuk setelah Early Bird berakhir (bug lama).
    Registration::query()->create([
        'competition_id' => $this->competition->id, 'batch_id' => $this->batch1->id, 'team_id' => $this->team->id,
        'status' => RegistrationStatus::WAITING_VERIFICATION, 'payment_required_at' => now(),
        'payment_submitted_at' => now()->addDays(10), 'amount_paid' => 100000,
    ]);

    $this->artisan('registrations:audit-batches')
        ->expectsOutputToContain('1 registrasi dibayar di luar periode batch-nya')
        ->assertSuccessful();

    expect(Registration::query()->first()->batch_id)->toBe($this->batch1->id);
});
