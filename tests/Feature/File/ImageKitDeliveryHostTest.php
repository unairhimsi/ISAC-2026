<?php

use App\Models\Team;
use App\Services\RichTextSanitizer;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;

uses(LazilyRefreshDatabase::class);

beforeEach(function (): void {
    config()->set('services.imagekit.url_endpoint', 'https://img.himsiunair.com');
    $this->team = Team::factory()->create();
    $this->token = $this->team->createToken('auth-token')->plainTextToken;
});

function registerFileUrl($test, string $url, string $fileId)
{
    return $test->withToken($test->token)->postJson('/api/files', [
        'file_id' => $fileId,
        'url' => $url,
        'purpose' => 'PAYMENT_PROOF',
    ]);
}

test('file url on the configured custom delivery domain is accepted', function (): void {
    registerFileUrl($this, 'https://img.himsiunair.com/payment-proofs/bukti_AbC.png', 'custom-1')
        ->assertCreated()
        ->assertJsonPath('data.url', 'https://img.himsiunair.com/payment-proofs/bukti_AbC.png');
});

test('file url on the default blocked imagekit domain is rejected once a custom domain is configured', function (): void {
    registerFileUrl($this, 'https://ik.imagekit.io/30naqgqqj/payment-proofs/bukti_AbC.png', 'default-1')
        ->assertUnprocessable()
        ->assertJsonPath('error.code', 'VALIDATION_ERROR');
});

test('lookalike hosts of the configured domain are rejected', function (string $url): void {
    registerFileUrl($this, $url, 'lookalike-'.md5($url))->assertUnprocessable();
})->with([
    'https://img.himsiunair.com.evil.test/a.png',
    'https://evilimg.himsiunair.com/a.png',
    'https://himsiunair.com/a.png',
]);

test('rich text keeps images on the configured domain and drops images on the old domain', function (): void {
    $clean = app(RichTextSanitizer::class)->clean(
        '<p>Soal</p><img src="https://img.himsiunair.com/exams/a.png" alt="a"><img src="https://ik.imagekit.io/30naqgqqj/exams/b.png" alt="b">'
    );

    expect($clean)
        ->toContain('https://img.himsiunair.com/exams/a.png')
        ->not->toContain('ik.imagekit.io');
});
