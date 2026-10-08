<?php

namespace App\Services\UploadThing;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Support\Facades\Http;

final class UploadThingClient
{
    public function __construct(private readonly UploadThingToken $token) {}

    public function registerRouteMetadata(array $fileKeys, array $metadata, string $callbackUrl, string $slug, string $frontendPackage): void
    {
        try {
            $response = $this->request($frontendPackage)->post($this->token->ingestUrl().'/route-metadata', [
                'fileKeys' => $fileKeys,
                'metadata' => $metadata,
                'isDev' => false,
                'callbackUrl' => $callbackUrl,
                'callbackSlug' => $slug,
                'awaitServerData' => true,
            ]);
        } catch (ConnectionException) {
            throw new UploadThingException('Layanan upload tidak dapat dihubungi. Coba lagi.', 502);
        }

        if (! $response->successful() || $response->json('ok') === false) {
            throw new UploadThingException('Gagal menyiapkan upload. Coba lagi.', 502);
        }
    }

    public function sendCallbackResult(string $origin, string $fileKey, ?array $callbackData, ?string $error = null): void
    {
        $payload = $error === null
            ? ['fileKey' => $fileKey, 'callbackData' => $callbackData]
            : ['fileKey' => $fileKey, 'error' => $error];

        try {
            $response = $this->request('unknown')->post(rtrim($origin, '/').'/callback-result', $payload);
        } catch (ConnectionException) {
            throw new UploadThingException('Hasil callback UploadThing tidak terkirim.', 502);
        }

        if (! $response->successful()) {
            throw new UploadThingException('Hasil callback UploadThing ditolak.', 502);
        }
    }

    private function request(string $frontendPackage): PendingRequest
    {
        return Http::timeout(15)->acceptJson()->withHeaders([
            'x-uploadthing-api-key' => $this->token->apiKey,
            'x-uploadthing-version' => (string) config('uploadthing.client_version'),
            'x-uploadthing-be-adapter' => 'laravel',
            'x-uploadthing-fe-package' => $frontendPackage,
        ]);
    }
}
