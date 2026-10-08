<?php

use App\Services\UploadThing\UploadThingSigner;

beforeEach(function (): void {
    $this->signer = new UploadThingSigner;
    $this->vectors = json_decode(file_get_contents(__DIR__.'/../Fixtures/uploadthing-vectors.json'), true);
    $this->secret = 'sk_test_fixture_secret_value';
});

test('string hash matches the official implementation', function (): void {
    foreach ($this->vectors['hash'] as $input => $expected) {
        expect($this->signer->hash((string) $input))->toBe($expected);
    }
});

test('generated keys match the official implementation for every app id and file', function (): void {
    foreach ($this->vectors['keys'] as $vector) {
        expect($this->signer->generateKey($vector['appId'], $vector['file'], $this->vectors['now']))->toBe($vector['key']);
    }
});

test('presigned urls match the official implementation byte for byte', function (): void {
    foreach ($this->vectors['signed'] as $vector) {
        $file = $vector['file'];
        $url = $this->signer->signedUrl(
            'https://sea1.ingest.uploadthing.com/'.$vector['key'],
            $this->secret,
            [
                'x-ut-identifier' => $this->vectors['appId'],
                'x-ut-file-name' => $file['name'],
                'x-ut-file-size' => $file['size'],
                'x-ut-file-type' => $file['type'],
                'x-ut-slug' => 'paymentProof',
                'x-ut-custom-id' => null,
                'x-ut-content-disposition' => 'inline',
                'x-ut-acl' => null,
            ],
            3600,
            $this->vectors['now'],
        );

        expect($url)->toBe($vector['url']);
    }
});

test('signatures match the official implementation and reject tampering', function (): void {
    foreach ($this->vectors['sig'] as $vector) {
        expect($this->signer->sign($vector['payload'], $this->secret))->toBe($vector['signature'])
            ->and($this->signer->verify($vector['payload'], $vector['signature'], $this->secret))->toBeTrue()
            ->and($this->signer->verify($vector['payload'].'x', $vector['signature'], $this->secret))->toBeFalse();
    }
});

test('verify rejects missing, malformed and wrongly keyed signatures', function (): void {
    $payload = '{"a":1}';
    $signature = $this->signer->sign($payload, $this->secret);

    expect($this->signer->verify($payload, null, $this->secret))->toBeFalse()
        ->and($this->signer->verify($payload, '', $this->secret))->toBeFalse()
        ->and($this->signer->verify($payload, 'hmac-sha256=', $this->secret))->toBeFalse()
        ->and($this->signer->verify($payload, substr($signature, 12), $this->secret))->toBeFalse()
        ->and($this->signer->verify($payload, $signature, 'another-secret'))->toBeFalse();
});

test('a generated key is recognised as belonging to its app only', function (): void {
    $key = $this->signer->generateKey('zusgzhif20', ['name' => 'a.png', 'size' => 1, 'type' => 'image/png']);

    expect($this->signer->keyBelongsToApp($key, 'zusgzhif20'))->toBeTrue()
        ->and($this->signer->keyBelongsToApp($key, 'otherapp01'))->toBeFalse()
        ->and(strlen($key))->toBeGreaterThanOrEqual(48);
});
