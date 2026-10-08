<?php

namespace App\Console\Commands;

use App\Services\UploadThing\UploadThingToken;
use GuzzleHttp\Client;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;
use Throwable;

class UploadThingRelay extends Command
{
    protected $signature = 'uploadthing:relay {payload} {marker}';

    protected $description = 'Forward UploadThing dev callbacks to the local hook route (local development only)';

    public function handle(): int
    {
        if (! config('uploadthing.is_dev') || ! app()->environment('local')) {
            $this->error('Relay hanya untuk pengembangan lokal (UPLOADTHING_IS_DEV=true dan APP_ENV=local).');

            return self::FAILURE;
        }

        $registration = json_decode((string) base64_decode((string) $this->argument('payload')), true);
        $marker = (string) $this->argument('marker');

        if (! is_array($registration)) {
            file_put_contents($marker, 'Payload relay tidak valid.');

            return self::FAILURE;
        }

        $token = UploadThingToken::fromConfig();

        file_put_contents($marker, 'ok');

        try {
            $response = (new Client(['http_errors' => false]))->post($token->ingestUrl().'/route-metadata', [
                'headers' => [
                    'x-uploadthing-api-key' => $token->apiKey,
                    'x-uploadthing-version' => (string) config('uploadthing.client_version'),
                    'x-uploadthing-be-adapter' => 'laravel',
                    'x-uploadthing-fe-package' => (string) $registration['frontendPackage'],
                ],
                'json' => [
                    'fileKeys' => $registration['fileKeys'],
                    'metadata' => $registration['metadata'],
                    'isDev' => true,
                    'callbackUrl' => $registration['callbackUrl'],
                    'callbackSlug' => $registration['slug'],
                    'awaitServerData' => true,
                ],
                'stream' => true,
                'read_timeout' => 5,
                'timeout' => 900,
            ]);
        } catch (Throwable $e) {
            $this->error('Relay gagal terhubung: '.$e->getMessage());

            return self::FAILURE;
        }

        if ($response->getStatusCode() !== 200) {
            $this->error('Relay ditolak UploadThing: HTTP '.$response->getStatusCode());

            return self::FAILURE;
        }

        $this->info('Relay terhubung ke UploadThing, menunggu callback.');

        $pending = count($registration['fileKeys']);
        $buffer = '';
        $lastData = time();
        $body = $response->getBody();

        while ($pending > 0 && time() - $lastData < 600) {
            $chunk = $body->read(8192);

            if ($chunk === '') {
                if ($body->eof()) {
                    break;
                }
                usleep(200000);

                continue;
            }

            $lastData = time();
            $buffer .= $chunk;

            while (($position = strpos($buffer, "\n")) !== false) {
                $line = json_decode(trim(substr($buffer, 0, $position)), true);
                $buffer = substr($buffer, $position + 1);

                if (is_array($line) && isset($line['payload'], $line['hook'])) {
                    $this->forward((string) $registration['callbackUrl'], $line);
                    $pending--;
                }
            }
        }

        return self::SUCCESS;
    }

    private function forward(string $url, array $line): void
    {
        try {
            Http::timeout(60)
                ->withHeaders(['uploadthing-hook' => (string) $line['hook'], 'x-uploadthing-signature' => (string) ($line['signature'] ?? '')])
                ->withBody((string) $line['payload'], 'application/json')
                ->post($url);
        } catch (Throwable $e) {
            $this->error('Gagal meneruskan callback: '.$e->getMessage());
        }
    }
}
