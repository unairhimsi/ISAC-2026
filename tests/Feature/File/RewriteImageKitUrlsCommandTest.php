<?php

use App\Models\File;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;

uses(LazilyRefreshDatabase::class);

beforeEach(function (): void {
    config()->set('services.imagekit.legacy_url_endpoint', 'https://ik.imagekit.io/30naqgqqj');
    config()->set('services.imagekit.url_endpoint', 'https://img.himsiunair.com');
});

function seedImageKitFile(string $fileId, string $url): File
{
    return File::query()->create(['file_id' => $fileId, 'url' => $url, 'purpose' => 'PAYMENT_PROOF']);
}

function seedLegacyAndModernFiles(): array
{
    return [
        'legacy_a' => seedImageKitFile('f1', 'https://ik.imagekit.io/30naqgqqj/payment-proofs/a_AbC.png'),
        'legacy_b' => seedImageKitFile('f2', 'https://ik.imagekit.io/30naqgqqj/submissions/karya (1).pdf'),
        'modern' => seedImageKitFile('f3', 'https://img.himsiunair.com/already.png'),
        'foreign' => seedImageKitFile('f4', 'https://ik.imagekit.io/otheraccount/x.png'),
        'other_case' => seedImageKitFile('f5', 'https://ik.imagekit.io/30NAQGQQJ/UPPER.png'),
    ];
}

test('rewrites only urls under the legacy endpoint and is idempotent', function (): void {
    Http::fake(['img.himsiunair.com/*' => Http::response('', 206)]);
    $files = seedLegacyAndModernFiles();

    $this->artisan('imagekit:rewrite-urls')->expectsOutputToContain('Diubah 2 URL')->assertSuccessful();

    expect($files['legacy_a']->fresh()->url)->toBe('https://img.himsiunair.com/payment-proofs/a_AbC.png')
        ->and($files['legacy_b']->fresh()->url)->toBe('https://img.himsiunair.com/submissions/karya (1).pdf')
        ->and($files['modern']->fresh()->url)->toBe('https://img.himsiunair.com/already.png')
        ->and($files['foreign']->fresh()->url)->toBe('https://ik.imagekit.io/otheraccount/x.png')
        ->and($files['other_case']->fresh()->url)->toBe('https://ik.imagekit.io/30NAQGQQJ/UPPER.png');

    $this->artisan('imagekit:rewrite-urls')
        ->expectsOutputToContain('Tidak ada URL file dengan endpoint lama')
        ->assertSuccessful();
});

test('checks the new domain with a real sample file before changing anything', function (): void {
    Http::fake(['img.himsiunair.com/*' => Http::response('', 200)]);
    seedLegacyAndModernFiles();

    $this->artisan('imagekit:rewrite-urls')->assertSuccessful();

    Http::assertSent(fn (Request $request): bool => str_starts_with($request->url(), 'https://img.himsiunair.com/')
        && ! str_contains($request->url(), '30naqgqqj')
        && $request->hasHeader('Range'));
});

test('refuses to rewrite when the new domain answers with an error', function (): void {
    Http::fake(['img.himsiunair.com/*' => Http::response('', 404)]);
    $files = seedLegacyAndModernFiles();

    $this->artisan('imagekit:rewrite-urls')
        ->expectsOutputToContain('belum bisa melayani file')
        ->assertFailed();

    expect($files['legacy_a']->fresh()->url)->toBe('https://ik.imagekit.io/30naqgqqj/payment-proofs/a_AbC.png')
        ->and($files['legacy_b']->fresh()->url)->toBe('https://ik.imagekit.io/30naqgqqj/submissions/karya (1).pdf');
});

test('refuses to rewrite when the new domain cannot be reached', function (): void {
    Http::fake(fn () => throw new ConnectionException('unreachable'));
    $files = seedLegacyAndModernFiles();

    $this->artisan('imagekit:rewrite-urls')->assertFailed();

    expect($files['legacy_a']->fresh()->url)->toBe('https://ik.imagekit.io/30naqgqqj/payment-proofs/a_AbC.png');
});

test('dry run reports the count and changes nothing', function (): void {
    Http::fake();
    $files = seedLegacyAndModernFiles();

    $this->artisan('imagekit:rewrite-urls --dry-run')
        ->expectsOutputToContain('2 URL akan diubah')
        ->assertSuccessful();

    Http::assertNothingSent();
    expect($files['legacy_a']->fresh()->url)->toBe('https://ik.imagekit.io/30naqgqqj/payment-proofs/a_AbC.png');
});

test('skip check rewrites without contacting the new domain', function (): void {
    Http::fake();
    seedLegacyAndModernFiles();

    $this->artisan('imagekit:rewrite-urls --skip-check')->expectsOutputToContain('Diubah 2 URL')->assertSuccessful();

    Http::assertNothingSent();
});

test('does nothing when the legacy endpoint is not configured', function (): void {
    config()->set('services.imagekit.legacy_url_endpoint', null);
    $files = seedLegacyAndModernFiles();

    $this->artisan('imagekit:rewrite-urls')->assertSuccessful();

    expect($files['legacy_a']->fresh()->url)->toBe('https://ik.imagekit.io/30naqgqqj/payment-proofs/a_AbC.png');
});

test('does nothing when the legacy and current endpoints are the same', function (): void {
    config()->set('services.imagekit.url_endpoint', 'https://ik.imagekit.io/30naqgqqj/');
    $files = seedLegacyAndModernFiles();

    $this->artisan('imagekit:rewrite-urls')->assertSuccessful();

    expect($files['legacy_a']->fresh()->url)->toBe('https://ik.imagekit.io/30naqgqqj/payment-proofs/a_AbC.png');
});

test('an alternate endpoint that keeps the account id in its path is mapped correctly', function (): void {
    config()->set('services.imagekit.url_endpoint', 'https://alt.example.net/30naqgqqj');
    Http::fake(['alt.example.net/*' => Http::response('', 200)]);
    $file = seedImageKitFile('f9', 'https://ik.imagekit.io/30naqgqqj/exams/b.png');

    $this->artisan('imagekit:rewrite-urls')->assertSuccessful();

    expect($file->fresh()->url)->toBe('https://alt.example.net/30naqgqqj/exams/b.png');
});
