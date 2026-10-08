<?php

use App\Models\Admin;
use App\Models\Team;
use App\Services\UploadThing\UploadThingSigner;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Testing\TestResponse;

uses(LazilyRefreshDatabase::class);

const UT_SECRET = 'sk_test_fixture_secret_value';
const UT_INGEST = 'https://sea1.ingest.uploadthing.com';

beforeEach(function (): void {
    config()->set('uploadthing.token', base64_encode(json_encode([
        'apiKey' => UT_SECRET,
        'appId' => 'zusgzhif20',
        'regions' => ['sea1'],
    ])));
    config()->set('app.url', 'https://isac.example.test');
    $this->signer = new UploadThingSigner;
    $this->team = Team::factory()->create();
    $this->teamToken = $this->team->createToken('auth-token')->plainTextToken;
});

function uploadRequest($test, string $token, string $slug, array $files): TestResponse
{
    app('auth')->forgetGuards();

    return $test->withToken($token)
        ->withHeaders(['x-uploadthing-package' => '@uploadthing/react'])
        ->postJson("/api/uploadthing?actionType=upload&slug={$slug}", ['input' => null, 'files' => $files]);
}

function pdfFile(array $overrides = []): array
{
    return array_merge(['name' => 'bukti bayar (1).pdf', 'size' => 150000, 'type' => 'application/pdf', 'lastModified' => 1699999999000], $overrides);
}

test('a team receives a signed presigned url and the route metadata is registered', function (): void {
    Http::fake([UT_INGEST.'/route-metadata' => Http::response(['ok' => true])]);

    $response = uploadRequest($this, $this->teamToken, 'paymentProof', [pdfFile()])->assertOk();

    $item = $response->json('0');
    expect($response->json())->toHaveCount(1)
        ->and($item['name'])->toBe('bukti bayar (1).pdf')
        ->and($item['customId'])->toBeNull()
        ->and($item['url'])->toStartWith(UT_INGEST.'/'.$item['key'].'?expires=')
        ->and($this->signer->keyBelongsToApp($item['key'], 'zusgzhif20'))->toBeTrue();

    [$unsigned, $signature] = explode('&signature=', $item['url']);
    expect($this->signer->verify($unsigned, urldecode($signature), UT_SECRET))->toBeTrue()
        ->and($unsigned)->toContain('x-ut-slug=paymentProof')
        ->and($unsigned)->toContain('x-ut-identifier=zusgzhif20')
        ->and($unsigned)->toContain('x-ut-file-size=150000');

    Http::assertSent(function (Request $request) use ($item): bool {
        return $request->url() === UT_INGEST.'/route-metadata'
            && $request->header('x-uploadthing-api-key')[0] === UT_SECRET
            && $request->header('x-uploadthing-fe-package')[0] === '@uploadthing/react'
            && $request['fileKeys'] === [$item['key']]
            && $request['metadata'] === ['slug' => 'paymentProof', 'purpose' => 'PAYMENT_PROOF', 'principal' => 'team', 'principalId' => $this->team->id]
            && $request['isDev'] === false
            && $request['callbackUrl'] === 'https://isac.example.test/api/uploadthing/hook'
            && $request['callbackSlug'] === 'paymentProof'
            && $request['awaitServerData'] === true;
    });
});

test('upload requires authentication and a verified team', function (): void {
    Http::fake();

    $this->postJson('/api/uploadthing?actionType=upload&slug=paymentProof', ['files' => [pdfFile()]])->assertUnauthorized();

    $unverified = Team::factory()->unverified()->create();
    uploadRequest($this, $unverified->createToken('t')->plainTextToken, 'paymentProof', [pdfFile()])->assertForbidden();

    Http::assertNothingSent();
});

test('each principal can only use the routes meant for it', function (): void {
    Http::fake([UT_INGEST.'/route-metadata' => Http::response(['ok' => true])]);
    $image = ['name' => 'foto.png', 'size' => 1000, 'type' => 'image/png'];
    $judge = Admin::factory()->create(['role' => 'judge', 'is_active' => true])->createToken('a')->plainTextToken;
    $registrar = Admin::factory()->create(['role' => 'admin_registration', 'is_active' => true])->createToken('a')->plainTextToken;

    uploadRequest($this, $this->teamToken, 'examImage', [$image])->assertForbidden();
    uploadRequest($this, $this->teamToken, 'batchModule', [pdfFile()])->assertForbidden();
    uploadRequest($this, $judge, 'memberPhoto', [$image])->assertForbidden();
    uploadRequest($this, $judge, 'paymentProof', [pdfFile()])->assertForbidden();

    uploadRequest($this, $this->teamToken, 'memberPhoto', [$image])->assertOk();
    uploadRequest($this, $judge, 'examImage', [$image])->assertOk();
    uploadRequest($this, $judge, 'batchModule', [pdfFile()])->assertOk();
    uploadRequest($this, $registrar, 'memberPhoto', [$image])->assertOk();
});

test('invalid requests are rejected before anything is sent to UploadThing', function (array $files, string $slug, int $status, string $message): void {
    Http::fake();

    uploadRequest($this, $this->teamToken, $slug, $files)
        ->assertStatus($status)
        ->assertJsonPath('message', $message);

    Http::assertNothingSent();
})->with([
    'wrong type' => [[['name' => 'a.exe', 'size' => 10, 'type' => 'application/x-msdownload']], 'paymentProof', 400, 'Tipe file tidak diizinkan. Gunakan JPEG, PNG, WEBP, PDF.'],
    'photo given a pdf' => [[['name' => 'a.pdf', 'size' => 10, 'type' => 'application/pdf']], 'memberPhoto', 400, 'Tipe file tidak diizinkan. Gunakan JPEG, PNG, WEBP.'],
    'too large payment proof' => [[['name' => 'a.pdf', 'size' => 10 * 1024 * 1024 + 1, 'type' => 'application/pdf']], 'paymentProof', 400, 'Ukuran file melebihi batas 10MB.'],
    'too large photo' => [[['name' => 'a.png', 'size' => 5 * 1024 * 1024 + 1, 'type' => 'image/png']], 'memberPhoto', 400, 'Ukuran file melebihi batas 5MB.'],
    'two files' => [[['name' => 'a.pdf', 'size' => 10, 'type' => 'application/pdf'], ['name' => 'b.pdf', 'size' => 10, 'type' => 'application/pdf']], 'paymentProof', 400, 'Unggah tepat satu file.'],
    'no files' => [[], 'paymentProof', 400, 'File belum dipilih.'],
    'unknown route' => [[['name' => 'a.pdf', 'size' => 10, 'type' => 'application/pdf']], 'doesNotExist', 404, 'Rute upload doesNotExist tidak ditemukan.'],
]);

test('only the upload action issues urls', function (): void {
    Http::fake();

    $this->withToken($this->teamToken)
        ->postJson('/api/uploadthing?actionType=failure&slug=paymentProof', ['files' => [pdfFile()]])
        ->assertOk();

    Http::assertNothingSent();
});

test('a failing or unreachable UploadThing makes the request fail cleanly', function (): void {
    Http::fake([UT_INGEST.'/route-metadata' => Http::response('boom', 500)]);
    uploadRequest($this, $this->teamToken, 'paymentProof', [pdfFile()])
        ->assertStatus(502)
        ->assertJsonPath('message', 'Gagal menyiapkan upload. Coba lagi.');

    Http::fake(fn () => throw new ConnectionException('down'));
    uploadRequest($this, $this->teamToken, 'paymentProof', [pdfFile()])
        ->assertStatus(502)
        ->assertJsonPath('message', 'Layanan upload tidak dapat dihubungi. Coba lagi.');
});

test('a missing token is reported as a server configuration error', function (): void {
    config()->set('uploadthing.token', null);
    Http::fake();

    uploadRequest($this, $this->teamToken, 'paymentProof', [pdfFile()])
        ->assertStatus(500)
        ->assertJsonPath('message', 'Konfigurasi UploadThing belum lengkap.');
});

test('the route config is public and lists every route with its limits', function (): void {
    $routes = collect($this->getJson('/api/uploadthing')->assertOk()->json())->keyBy('slug');

    expect($routes->keys()->all())->toBe(['paymentProof', 'memberPhoto', 'submission', 'batchModule', 'examImage'])
        ->and($routes['paymentProof']['config']['pdf']['maxFileSize'])->toBe('10MB')
        ->and($routes['paymentProof']['config']['image']['maxFileCount'])->toBe(1)
        ->and($routes['memberPhoto']['config'])->not->toHaveKey('pdf')
        ->and($routes['submission']['config']['pdf']['maxFileSize'])->toBe('20MB');
});
