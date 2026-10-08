<?php

use App\Models\File;
use App\Models\Team;
use App\Services\RichTextSanitizer;
use App\Services\UploadThing\UploadThingSigner;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

uses(LazilyRefreshDatabase::class);

const HOOK_SECRET = 'sk_test_fixture_secret_value';
const HOOK_ORIGIN = 'https://sea1.ingest.uploadthing.com';

beforeEach(function (): void {
    config()->set('uploadthing.token', base64_encode(json_encode([
        'apiKey' => HOOK_SECRET,
        'appId' => 'zusgzhif20',
        'regions' => ['sea1'],
    ])));
    $this->team = Team::factory()->create();
    $this->signer = new UploadThingSigner;
    Http::fake([HOOK_ORIGIN.'/callback-result' => Http::response(['ok' => true])]);
});

function callbackPayload(Team $team, array $file = [], array $metadata = [], array $top = [], string $appId = 'zusgzhif20'): array
{
    $key = (new UploadThingSigner)->generateKey($appId, ['name' => 'bukti.pdf', 'size' => 150000, 'type' => 'application/pdf']);

    return array_merge([
        'status' => 'uploaded',
        'metadata' => array_merge(['slug' => 'paymentProof', 'purpose' => 'PAYMENT_PROOF', 'principal' => 'team', 'principalId' => $team->id], $metadata),
        'file' => array_merge([
            'name' => 'bukti.pdf',
            'size' => 150000,
            'type' => 'application/pdf',
            'customId' => null,
            'lastModified' => 1700000000000,
            'key' => $key,
            'url' => "https://utfs.io/f/{$key}",
            'appUrl' => "https://utfs.io/a/zusgzhif20/{$key}",
            'ufsUrl' => "https://zusgzhif20.ufs.sh/f/{$key}",
            'fileHash' => 'abc123',
        ], $file),
        'origin' => HOOK_ORIGIN,
    ], $top);
}

function hookCall($test, array|string $payload, string $slug = 'paymentProof', string $hook = 'callback', ?string $signature = null)
{
    $body = is_array($payload) ? json_encode($payload) : $payload;

    return $test->call('POST', "/api/uploadthing/hook?slug={$slug}", [], [], [], array_filter([
        'CONTENT_TYPE' => 'application/json',
        'HTTP_UPLOADTHING_HOOK' => $hook,
        'HTTP_X_UPLOADTHING_SIGNATURE' => $signature ?? (new UploadThingSigner)->sign($body, HOOK_SECRET),
    ]), $body);
}

test('a signed callback registers the file and returns the result to UploadThing', function (): void {
    $payload = callbackPayload($this->team);

    hookCall($this, $payload)->assertOk()->assertContent('null');

    $file = File::query()->where('file_id', $payload['file']['key'])->firstOrFail();
    expect($file->url)->toBe($payload['file']['ufsUrl'])
        ->and($file->purpose)->toBe('PAYMENT_PROOF')
        ->and($file->uploaded_by)->toBe($this->team->id);

    Http::assertSent(fn (Request $request): bool => $request->url() === HOOK_ORIGIN.'/callback-result'
        && $request->header('x-uploadthing-api-key')[0] === HOOK_SECRET
        && $request['fileKey'] === $payload['file']['key']
        && $request['callbackData'] === ['id' => $file->id, 'fileId' => $payload['file']['key'], 'url' => $payload['file']['ufsUrl'], 'purpose' => 'PAYMENT_PROOF']);
});

test('a file uploaded by an admin has no team owner', function (): void {
    $payload = callbackPayload(
        $this->team,
        ['name' => 'foto.png', 'type' => 'image/png', 'size' => 1000],
        ['slug' => 'memberPhoto', 'purpose' => 'MEMBER_PHOTO', 'principal' => 'admin', 'principalId' => (string) Str::uuid()],
    );

    hookCall($this, $payload, 'memberPhoto')->assertOk();

    expect(File::query()->where('file_id', $payload['file']['key'])->firstOrFail()->uploaded_by)->toBeNull();
});

test('repeated callbacks for the same file create a single record', function (): void {
    $payload = callbackPayload($this->team);

    hookCall($this, $payload)->assertOk();
    hookCall($this, $payload)->assertOk();

    expect(File::query()->count())->toBe(1);
    Http::assertSentCount(2);
});

test('callbacks without a valid signature are rejected and have no effect', function (?string $signature, bool $send): void {
    $payload = callbackPayload($this->team);
    $body = json_encode($payload);

    $response = $send ? hookCall($this, $body, 'paymentProof', 'callback', $signature) : $this->call('POST', '/api/uploadthing/hook?slug=paymentProof', [], [], [], [
        'CONTENT_TYPE' => 'application/json',
        'HTTP_UPLOADTHING_HOOK' => 'callback',
    ], $body);

    $response->assertStatus(400)->assertJsonPath('message', 'Invalid signature');
    expect(File::query()->count())->toBe(0);
    Http::assertNothingSent();
})->with([
    'missing header' => [null, false],
    'wrong secret' => [(new UploadThingSigner)->sign('{"x":1}', 'another-secret'), true],
    'signature of another body' => [(new UploadThingSigner)->sign('{"x":1}', HOOK_SECRET), true],
    'no prefix' => ['deadbeef', true],
]);

test('callbacks claiming a foreign origin are rejected even when correctly signed', function (string $origin): void {
    hookCall($this, callbackPayload($this->team, top: ['origin' => $origin]))
        ->assertStatus(400)
        ->assertJsonPath('message', 'Callback UploadThing tidak valid.');

    expect(File::query()->count())->toBe(0);
    Http::assertNothingSent();
})->with([
    'https://evil.example.com',
    'http://sea1.ingest.uploadthing.com',
    'https://ingest.uploadthing.com.evil.test',
    'https://sea1.ingest.uploadthing.com.evil.test',
    '',
]);

test('files that do not satisfy the route are not registered and the error goes back to UploadThing', function (array $file, array $metadata, string $appId, string $message): void {
    $payload = callbackPayload($this->team, $file, $metadata, appId: $appId);

    hookCall($this, $payload)->assertOk();

    expect(File::query()->count())->toBe(0);
    Http::assertSent(fn (Request $request): bool => $request->url() === HOOK_ORIGIN.'/callback-result'
        && $request['error'] === $message
        && ! isset($request['callbackData']));
})->with([
    'purpose mismatch' => [[], ['purpose' => 'SUBMISSION'], 'zusgzhif20', 'Rute upload tidak cocok.'],
    'key from another app' => [[], [], 'otherapp01', 'File tidak berasal dari aplikasi ini.'],
    'foreign file host' => [['ufsUrl' => 'https://evil.example.com/f/abc'], [], 'zusgzhif20', 'File tidak berasal dari aplikasi ini.'],
    'disallowed type' => [['type' => 'application/x-msdownload'], [], 'zusgzhif20', 'File tidak memenuhi syarat tipe atau ukuran.'],
    'too large' => [['size' => 10 * 1024 * 1024 + 1], [], 'zusgzhif20', 'File tidak memenuhi syarat tipe atau ukuran.'],
    'unknown uploader' => [[], ['principalId' => '00000000-0000-0000-0000-000000000000'], 'zusgzhif20', 'Pengunggah tidak ditemukan.'],
]);

test('error hooks are accepted only when signed', function (): void {
    $body = json_encode(['fileKey' => 'abc', 'error' => 'upload failed']);

    hookCall($this, $body, hook: 'error')->assertOk()->assertContent('null');
    hookCall($this, $body, hook: 'error', signature: 'hmac-sha256=00')->assertStatus(400);
    hookCall($this, $body, hook: 'unknown')->assertOk()->assertContent('null');

    expect(File::query()->count())->toBe(0);
    Http::assertNothingSent();
});

test('a failure while returning the result does not undo the registered file', function (): void {
    Http::fake([HOOK_ORIGIN.'/callback-result' => Http::response('boom', 500)]);

    hookCall($this, callbackPayload($this->team))->assertOk();

    expect(File::query()->count())->toBe(1);
});

test('rich text keeps images served by this UploadThing app and drops everything else', function (): void {
    $clean = app(RichTextSanitizer::class)->clean(implode('', [
        '<img src="https://zusgzhif20.ufs.sh/f/keep1" alt="a">',
        '<img src="https://utfs.io/f/keep2" alt="b">',
        '<img src="https://otherapp.ufs.sh/f/drop1" alt="c">',
        '<img src="https://ik.imagekit.io/30naqgqqj/drop2.png" alt="d">',
        '<img src="https://zusgzhif20.ufs.sh.evil.test/f/drop3" alt="e">',
        '<img src="http://zusgzhif20.ufs.sh/f/drop4" alt="f">',
    ]));

    expect($clean)->toContain('keep1')->toContain('keep2')
        ->not->toContain('drop1')->not->toContain('drop2')->not->toContain('drop3')->not->toContain('drop4');
});

test('the production webhook url that UploadThing builds with a doubled slug query still registers the file', function (): void {
    $payload = callbackPayload($this->team);
    $body = json_encode($payload);

    $this->call('POST', '/api/uploadthing/hook?slug=paymentProof?slug=paymentProof', [], [], [], [
        'CONTENT_TYPE' => 'application/json',
        'HTTP_UPLOADTHING_HOOK' => 'callback',
        'HTTP_X_UPLOADTHING_SIGNATURE' => (new UploadThingSigner)->sign($body, HOOK_SECRET),
    ], $body)->assertOk()->assertContent('null');

    expect(File::query()->where('file_id', $payload['file']['key'])->exists())->toBeTrue();
    Http::assertSent(fn (Request $request): bool => isset($request['callbackData']) && ! isset($request['error']));
});

test('the route is taken from the signed metadata and not from the query string', function (): void {
    $payload = callbackPayload($this->team);
    $body = json_encode($payload);

    $this->call('POST', '/api/uploadthing/hook?slug=submission', [], [], [], [
        'CONTENT_TYPE' => 'application/json',
        'HTTP_UPLOADTHING_HOOK' => 'callback',
        'HTTP_X_UPLOADTHING_SIGNATURE' => (new UploadThingSigner)->sign($body, HOOK_SECRET),
    ], $body)->assertOk();

    expect(File::query()->where('file_id', $payload['file']['key'])->firstOrFail()->purpose)->toBe('PAYMENT_PROOF');
});

test('a rejected callback is logged with its reason', function (): void {
    Log::spy();

    hookCall($this, callbackPayload($this->team, [], ['purpose' => 'SUBMISSION']))->assertOk();

    Log::shouldHaveReceived('warning')->withArgs(fn (string $message, array $context): bool => $message === 'UploadThing callback ditolak' && $context['reason'] === 'Rute upload tidak cocok.');
});
