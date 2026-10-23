<?php

use App\Models\Admin;
use App\Models\BatchStatus;
use App\Models\Competition;
use App\Models\Member;
use App\Models\PaymentMethod;
use App\Models\Registration;
use App\Models\RegistrationStatus;
use App\Models\Team;
use App\Services\Export\TabularExporter;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Log;
use OpenSpout\Reader\XLSX\Reader;

uses(LazilyRefreshDatabase::class);

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

function exportToken(string $role = 'admin_registration'): string
{
    app('auth')->forgetGuards();

    return Admin::factory()->create(['role' => $role, 'is_active' => true])->createToken('t')->plainTextToken;
}

/** Path berkas xlsx dari respons unduhan (berkas dihapus hanya saat respons benar-benar dikirim). */
function exportFilePath($response): string
{
    return $response->baseResponse->getFile()->getPathname();
}

/** @return array<string, list<list<mixed>>> baris mentah per nama sheet */
function exportSheets($response): array
{
    $reader = new Reader;
    $reader->open(exportFilePath($response));

    $sheets = [];
    foreach ($reader->getSheetIterator() as $sheet) {
        foreach ($sheet->getRowIterator() as $row) {
            $sheets[$sheet->getName()][] = array_map(fn ($cell) => $cell->getValue(), $row->getCells());
        }
    }
    $reader->close();

    return $sheets;
}

/** @return list<array<string, mixed>> baris data dengan kunci = judul kolom */
function exportRecords($response, string $sheet): array
{
    $rows = exportSheets($response)[$sheet];
    $header = array_shift($rows);

    return array_map(fn (array $row): array => array_combine($header, array_pad($row, count($header), null)), $rows);
}

/** @return array{0: Registration, 1: Team} */
function exportPayment(array $registration = [], array $team = []): array
{
    $competition = Competition::factory()->create([
        'status' => Competition::STATUS_REGISTRATION_OPEN,
        'type' => Competition::TYPE_OLIMPIADE,
        'payment_flow' => Competition::PAYMENT_UPFRONT,
        'name' => 'Olimpiade Sains',
    ]);
    $batch = $competition->batches()->create([
        'name' => 'Batch Ekspor',
        'slug' => 'batch-ekspor-'.fake()->unique()->numerify('#####'),
        'start_date' => now()->subDay(),
        'end_date' => now()->addMonth(),
        'price' => 150000,
        'quota' => 100,
        'status' => BatchStatus::OPEN,
    ]);
    $owner = Team::factory()->create(['name' => 'Tim Rekap', 'institution_name' => 'SMA Rekap', ...$team]);
    $payment = Registration::query()->create([
        'competition_id' => $competition->id,
        'batch_id' => $batch->id,
        'team_id' => $owner->id,
        'status' => RegistrationStatus::WAITING_PAYMENT,
        'payment_required_at' => now()->subHour(),
        ...$registration,
    ]);

    return [$payment, $owner];
}

test('team export contains every matching team, not just one page of the list', function (): void {
    Team::factory()->count(120)->create();
    $token = exportToken();

    $list = $this->withToken($token)->getJson('/api/admin/teams?per_page=15')->assertOk();
    expect($list->json('data.data'))->toHaveCount(15);

    $response = $this->withToken($token)->get('/api/admin/teams/export?format=xlsx')->assertOk();

    expect($response->headers->get('Content-Type'))->toBe(XLSX_MIME)
        ->and($response->headers->get('Content-Disposition'))->toMatch('/filename="?data-tim-isac-2026-\d{8}-\d{6}\.xlsx"?/')
        ->and($response->headers->get('Cache-Control'))->toContain('no-store')->toContain('private')->not->toContain('public')
        ->and(exportRecords($response, 'Tim & Peserta'))->toHaveCount(120);
});

test('team export defaults to xlsx and honours the same filters as the list', function (): void {
    $competition = Competition::factory()->create(['type' => Competition::TYPE_BUSINESS_PLAN]);
    $verified = Team::factory()->create(['code' => 'ISAC-V', 'name' => 'Tim Sama', 'status' => Team::STATUS_VERIFIED]);
    $waiting = Team::factory()->create(['code' => 'ISAC-W', 'name' => 'Tim Sama', 'status' => Team::STATUS_WAITING_VERIFICATION]);
    Team::factory()->create(['code' => 'ISAC-LAIN', 'name' => 'Tim Lain']);
    foreach ([$verified, $waiting] as $team) {
        Registration::query()->create(['team_id' => $team->id, 'competition_id' => $competition->id, 'status' => RegistrationStatus::WAITING_VERIFICATION]);
    }
    $token = exportToken();

    $codes = fn ($response): array => collect(exportRecords($response, 'Tim & Peserta'))->pluck('Kode Tim')->sort()->values()->all();

    $search = $this->withToken($token)->get('/api/admin/teams/export?search=Tim+Sama')->assertOk();
    expect($codes($search))->toBe(['ISAC-V', 'ISAC-W']);

    $status = $this->withToken($token)->get('/api/admin/teams/export?search=Tim+Sama&status=VERIFIED&competition_id='.$competition->id)->assertOk();
    expect($codes($status))->toBe(['ISAC-V']);

    $info = exportSheets($status)['Info'];
    expect(collect($info)->pluck(1, 0)->all())->toMatchArray(['Jumlah baris' => '1', 'Status' => 'Terverifikasi', 'Pencarian' => 'Tim Sama']);
});

test('team export writes one row per member and keeps teams without members', function (): void {
    $team = Team::factory()->create(['code' => 'ISAC-ANGGOTA', 'name' => 'Tim Anggota', 'phone' => '081234567890']);
    Member::query()->create(['team_id' => $team->id, 'name' => 'Kedua', 'role' => 'MEMBER', 'email' => 'dua@example.test', 'student_id' => '0123456789', 'sort_order' => 2]);
    Member::query()->create(['team_id' => $team->id, 'name' => 'Pertama', 'role' => 'LEADER', 'email' => 'satu@example.test', 'student_id' => '0987654321', 'sort_order' => 1]);
    Team::factory()->create(['code' => 'ISAC-KOSONG', 'name' => 'Tim Kosong']);

    $response = $this->withToken(exportToken())->get('/api/admin/teams/export')->assertOk();
    $records = collect(exportRecords($response, 'Tim & Peserta'))->groupBy('Kode Tim');

    expect($records['ISAC-ANGGOTA'])->toHaveCount(2)
        ->and($records['ISAC-ANGGOTA']->pluck('Nama Anggota')->all())->toBe(['Pertama', 'Kedua'])
        ->and($records['ISAC-ANGGOTA']->pluck('Peran')->all())->toBe(['Ketua', 'Anggota'])
        // Nol di depan harus bertahan: nilai ditulis sebagai teks, bukan angka.
        ->and($records['ISAC-ANGGOTA'][0]['Telepon Tim'])->toBe('081234567890')
        ->and($records['ISAC-ANGGOTA'][1]['NISN/NIM'])->toBe('0123456789')
        ->and($records['ISAC-KOSONG'])->toHaveCount(1)
        ->and($records['ISAC-KOSONG'][0]['Nama Anggota'])->toBeEmpty();
});

test('text that looks like a formula is stored as a plain string', function (): void {
    Team::factory()->create(['name' => '=HYPERLINK("http://evil.test","klik")', 'institution_name' => '+62812 @SUM(1)']);

    $response = $this->withToken(exportToken())->get('/api/admin/teams/export')->assertOk();

    $zip = new ZipArchive;
    $zip->open(exportFilePath($response));
    $sheet = $zip->getFromName('xl/worksheets/sheet1.xml');
    $zip->close();

    expect($sheet)->not->toContain('<f>')
        ->and($sheet)->toContain('=HYPERLINK(')
        ->and(exportRecords($response, 'Tim & Peserta')[0]['Nama Tim'])->toBe('=HYPERLINK("http://evil.test","klik")');
});

test('team export as pdf returns a real pdf document', function (): void {
    Team::factory()->create(['name' => 'Tim PDF']);

    $response = $this->withToken(exportToken())->get('/api/admin/teams/export?format=pdf')->assertOk();

    expect($response->headers->get('Content-Type'))->toBe('application/pdf')
        ->and($response->headers->get('Cache-Control'))->toContain('no-store')->toContain('private')->not->toContain('public')
        ->and($response->headers->get('Content-Disposition'))->toMatch('/\.pdf"?$/')
        ->and($response->getContent())->toStartWith('%PDF-');
});

test('pdf export refuses oversized data and points to excel instead of truncating it', function (): void {
    $this->app->instance(TabularExporter::class, new TabularExporter(pdfMaxRows: 2));
    Team::factory()->count(3)->create();
    $token = exportToken();

    $this->withToken($token)->getJson('/api/admin/teams/export?format=pdf')
        ->assertUnprocessable()
        ->assertJsonPath('error.code', 'VALIDATION_ERROR')
        ->assertJsonPath('error.details.format.0', fn (string $message): bool => str_contains($message, 'Excel'));

    $this->withToken($token)->get('/api/admin/teams/export?format=xlsx')->assertOk();
});

test('export rejects unknown format and filter values', function (): void {
    $token = exportToken();

    $this->withToken($token)->getJson('/api/admin/teams/export?format=csv')->assertUnprocessable();
    $this->withToken($token)->getJson('/api/admin/teams/export?status=BUKAN_STATUS')->assertUnprocessable();
    $this->withToken($token)->getJson('/api/admin/payments/export?payment_method=CASH')->assertUnprocessable();
});

test('payment export lists every payment with formatted amounts and dates', function (): void {
    [$submitted] = exportPayment([
        'status' => RegistrationStatus::WAITING_VERIFICATION,
        'payment_method' => PaymentMethod::BANK_TRANSFER,
        'amount_paid' => 135000,
        'discount_percent' => 10,
        'discount_amount' => 15000,
        'promo_code' => 'HEMAT10',
        'payment_submitted_at' => Carbon::parse('2026-10-24 15:30:00', config('app.timezone')),
    ], ['code' => 'ISAC-BAYAR']);
    exportPayment([], ['code' => 'ISAC-BELUM']);
    $token = exportToken('admin_payment');

    $response = $this->withToken($token)->get('/api/admin/payments/export')->assertOk();
    $records = collect(exportRecords($response, 'Pembayaran'))->keyBy('Kode Tim');

    expect($records)->toHaveCount(2)
        ->and($records['ISAC-BAYAR']['Status'])->toBe('Menunggu Verifikasi')
        ->and($records['ISAC-BAYAR']['Metode'])->toBe('Transfer Bank')
        ->and((float) $records['ISAC-BAYAR']['Harga Asli (Rp)'])->toBe(150000.0)
        ->and((float) $records['ISAC-BAYAR']['Nominal Dibayar (Rp)'])->toBe(135000.0)
        ->and((float) $records['ISAC-BAYAR']['Diskon (Rp)'])->toBe(15000.0)
        ->and($records['ISAC-BAYAR']['Kode Promo'])->toBe('HEMAT10')
        ->and($records['ISAC-BAYAR']['Bukti Dikirim']->format('Y-m-d H:i'))->toBe('2026-10-24 15:30')
        // Belum kirim bukti: harga batch tampil, tetapi metode dan nominal dibayar kosong.
        ->and((float) $records['ISAC-BELUM']['Harga Asli (Rp)'])->toBe(150000.0)
        ->and($records['ISAC-BELUM']['Metode'])->toBeEmpty()
        ->and($records['ISAC-BELUM']['Nominal Dibayar (Rp)'])->toBeEmpty()
        ->and($submitted->id)->not->toBeNull();

    $filtered = $this->withToken(exportToken('admin_payment'))->get('/api/admin/payments/export?status=WAITING_VERIFICATION')->assertOk();
    expect(exportRecords($filtered, 'Pembayaran'))->toHaveCount(1);

    $pdf = $this->withToken(exportToken('admin_payment'))->get('/api/admin/payments/export?format=pdf')->assertOk();
    expect($pdf->getContent())->toStartWith('%PDF-');
});

test('only registration and payment staff can export', function (): void {
    Team::factory()->create();

    foreach (['/api/admin/teams/export', '/api/admin/payments/export'] as $url) {
        foreach (['super_admin', 'admin_registration', 'admin_payment'] as $role) {
            $this->withToken(exportToken($role))->get($url)->assertOk();
        }

        $this->withToken(exportToken('judge'))->getJson($url)->assertForbidden()->assertJsonPath('error.code', 'FORBIDDEN');
    }

    app('auth')->forgetGuards();
    $this->flushHeaders();
    $this->getJson('/api/admin/teams/export')->assertUnauthorized();
    $this->getJson('/api/admin/payments/export')->assertUnauthorized();
});

test('every export is written to the security audit log without the search keyword', function (): void {
    Team::factory()->count(2)->create();
    Log::spy();

    $this->withToken(exportToken())->get('/api/admin/teams/export?format=xlsx&search=rahasia-peserta&status=INCOMPLETE')->assertOk();

    Log::shouldHaveReceived('info')->withArgs(function (string $message, array $context = []): bool {
        return $message === 'security.audit'
            && $context['event'] === 'admin.export'
            && $context['resource'] === 'teams'
            && $context['format'] === 'xlsx'
            && $context['rows'] === 0
            && $context['filters'] === 'search=yes;status=INCOMPLETE'
            && ! str_contains(json_encode($context), 'rahasia-peserta');
    })->once();
});

test('exports are rate limited per admin', function (): void {
    $token = exportToken();

    foreach (range(1, 6) as $attempt) {
        $this->withToken($token)->get('/api/admin/teams/export')->assertOk();
    }

    $this->withToken($token)->getJson('/api/admin/teams/export')->assertStatus(429);
});
