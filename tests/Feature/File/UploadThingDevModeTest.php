<?php

use App\Models\Team;
use App\Services\UploadThing\UploadThingDevRelay;
use Database\Seeders\DummyUploadTestSeeder;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;

uses(LazilyRefreshDatabase::class);

beforeEach(function (): void {
    config()->set('uploadthing.token', base64_encode(json_encode([
        'apiKey' => 'sk_test_fixture_secret_value',
        'appId' => 'zusgzhif20',
        'regions' => ['sea1'],
    ])));
});

test('the dev flag is ignored outside the local environment and the normal registration is used', function (): void {
    config()->set('uploadthing.is_dev', true);
    Http::fake(['https://sea1.ingest.uploadthing.com/route-metadata' => Http::response(['ok' => true])]);
    $team = Team::factory()->create();

    $this->withToken($team->createToken('t')->plainTextToken)
        ->postJson('/api/uploadthing?actionType=upload&slug=paymentProof', ['files' => [['name' => 'a.pdf', 'size' => 100, 'type' => 'application/pdf']]])
        ->assertOk();

    Http::assertSent(fn (Request $request): bool => str_ends_with($request->url(), '/route-metadata') && $request['isDev'] === false);
});

test('the relay command refuses to run outside local development', function (bool $flag): void {
    config()->set('uploadthing.is_dev', $flag);

    $marker = sys_get_temp_dir().'/relay-marker-'.uniqid('', true);

    $this->artisan('uploadthing:relay', ['payload' => base64_encode('{}'), 'marker' => $marker])
        ->expectsOutputToContain('Relay hanya untuk pengembangan lokal')
        ->assertFailed();

    expect(file_exists($marker))->toBeFalse();
})->with([true, false]);

test('the dummy seeder creates verified accounts at the expected registration steps', function (): void {
    $this->seed(DummyUploadTestSeeder::class);

    $start = Team::query()->where('email', 'dummy.start@isac.test')->firstOrFail();
    $biodata = Team::query()->where('email', 'dummy.biodata@isac.test')->firstOrFail();
    $payment = Team::query()->where('email', 'dummy.payment@isac.test')->firstOrFail();
    $submission = Team::query()->where('email', 'dummy.submission@isac.test')->firstOrFail();

    expect($start->isEmailVerified())->toBeTrue()
        ->and($start->registration)->toBeNull()
        ->and($biodata->registration->team_completed_at)->not->toBeNull()
        ->and($biodata->registration->members_completed_at)->toBeNull()
        ->and($biodata->registration->batch_id)->toBeNull()
        ->and($payment->registration->documents_completed_at)->not->toBeNull()
        ->and($payment->members()->count())->toBe(1)
        ->and($submission->status)->toBe(Team::STATUS_VERIFIED)
        ->and($submission->current_stage_id)->not->toBeNull()
        ->and($submission->registration->batch_id)->not->toBeNull()
        ->and($submission->currentStage->start_date->isPast())->toBeTrue()
        ->and($submission->currentStage->end_date->isFuture())->toBeTrue();

    $this->seed(DummyUploadTestSeeder::class);
    expect(Team::query()->where('email', 'like', 'dummy.%@isac.test')->count())->toBe(4);
});

test('the dev relay forwards to the hook url with the route as a query parameter', function (): void {
    $forward = fn (string $url) => UploadThingDevRelay::forwardUrl(['callbackUrl' => $url, 'slug' => 'memberPhoto']);

    expect($forward('http://nginx/api/uploadthing/hook'))->toBe('http://nginx/api/uploadthing/hook?slug=memberPhoto')
        ->and($forward('http://nginx/hook?token=1'))->toBe('http://nginx/hook?token=1&slug=memberPhoto');
});
