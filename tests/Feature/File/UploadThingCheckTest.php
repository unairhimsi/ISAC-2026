<?php

use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Illuminate\Support\Facades\Http;

uses(LazilyRefreshDatabase::class);

beforeEach(function (): void {
    config()->set('uploadthing.token', base64_encode(json_encode(['apiKey' => 'sk_test_fixture_secret_value', 'appId' => 'zusgzhif20', 'regions' => ['sea1']])));
    config()->set('uploadthing.is_dev', false);
    config()->set('app.url', 'https://isac.example.test');
});

test('every check passes when configuration and connectivity are healthy', function (): void {
    Http::fake([
        'https://sea1.ingest.uploadthing.com/' => Http::response('', 404),
        'https://api.uploadthing.com/v6/listFiles' => Http::response(['files' => []]),
        'https://isac.example.test/api/uploadthing/hook*' => Http::response(['message' => 'Invalid signature'], 400),
    ]);

    $this->artisan('uploadthing:check')
        ->expectsOutputToContain('[ OK    ] UPLOADTHING_TOKEN - appId=zusgzhif20')
        ->expectsOutputToContain('[ OK    ] URL callback yang dikirim ke UploadThing - https://isac.example.test/api/uploadthing/hook?slug=<route>')
        ->expectsOutputToContain('[ OK    ] Server menjangkau URL callback sendiri - HTTP 400')
        ->expectsOutputToContain('Semua pemeriksaan lolos.')
        ->assertSuccessful();
});

test('failures are reported per check and the exit code is non zero', function (): void {
    Http::fake([
        'https://sea1.ingest.uploadthing.com/' => Http::response('', 404),
        'https://api.uploadthing.com/v6/listFiles' => Http::response(['error' => 'bad key'], 401),
        'https://isac.example.test/api/uploadthing/hook*' => Http::response('blocked', 403),
    ]);

    $this->artisan('uploadthing:check')
        ->expectsOutputToContain('[ GAGAL ] API key valid (api.uploadthing.com) - HTTP 401')
        ->expectsOutputToContain('[ GAGAL ] Server menjangkau URL callback sendiri - HTTP 403')
        ->expectsOutputToContain('2 pemeriksaan gagal.')
        ->assertFailed();
});

test('a wrong callback url or a missing token is flagged without leaking the key', function (): void {
    config()->set('uploadthing.callback_url', 'http://localhost/wrong');
    Http::fake(['*' => Http::response('', 404)]);

    $this->artisan('uploadthing:check')
        ->expectsOutputToContain('[ GAGAL ] URL callback yang dikirim ke UploadThing - http://localhost/wrong?slug=<route>')
        ->doesntExpectOutputToContain('sk_test_fixture_secret_value')
        ->assertFailed();

    config()->set('uploadthing.token', null);
    $this->artisan('uploadthing:check')
        ->expectsOutputToContain('[ GAGAL ] UPLOADTHING_TOKEN - Konfigurasi UploadThing belum lengkap.')
        ->assertFailed();
});
