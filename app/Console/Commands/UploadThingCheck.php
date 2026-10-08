<?php

namespace App\Console\Commands;

use App\Models\File;
use App\Services\UploadThing\UploadThingException;
use App\Services\UploadThing\UploadThingToken;
use Closure;
use Illuminate\Console\Command;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Throwable;

class UploadThingCheck extends Command
{
    protected $signature = 'uploadthing:check';

    protected $description = 'Check UploadThing configuration and connectivity from this server (prints no secrets)';

    private int $failures = 0;

    public function handle(): int
    {
        try {
            $token = UploadThingToken::fromConfig();
        } catch (UploadThingException $e) {
            $this->row('UPLOADTHING_TOKEN', false, $e->getMessage());

            return self::FAILURE;
        }

        $this->row('UPLOADTHING_TOKEN', true, "appId={$token->appId}, region=".implode(',', $token->regions));
        $this->row('Ekstensi bcmath atau gmp', extension_loaded('bcmath') || extension_loaded('gmp'), 'dibutuhkan library sqids');

        $appUrl = rtrim((string) config('app.url'), '/');
        $callback = (string) (config('uploadthing.callback_url') ?: $appUrl.'/api/uploadthing/hook');
        $this->row('APP_URL', str_starts_with($appUrl, 'https://') && ! str_contains($appUrl, 'localhost'), $appUrl);
        $this->row('URL callback yang dikirim ke UploadThing', str_starts_with($callback, 'https://') && str_ends_with($callback, '/api/uploadthing/hook'), $callback.'?slug=<route>');
        $this->row('Mode dev UploadThing nonaktif', ! config('uploadthing.is_dev'), 'UPLOADTHING_IS_DEV='.var_export((bool) config('uploadthing.is_dev'), true).', APP_ENV='.app()->environment());

        $this->timed('Koneksi keluar ke ingest '.$token->ingestUrl(), fn (): Response => $this->http()->get($token->ingestUrl().'/'), fn (Response $r): bool => $r->status() < 500);
        $this->timed('API key valid (api.uploadthing.com)', fn (): Response => $this->http()->withHeaders(['x-uploadthing-api-key' => $token->apiKey])->post('https://api.uploadthing.com/v6/listFiles', ['limit' => 1]), fn (Response $r): bool => $r->successful());
        $this->timed('Server menjangkau URL callback sendiri', fn (): Response => $this->http()->withHeaders(['uploadthing-hook' => 'callback', 'x-uploadthing-signature' => 'hmac-sha256=00'])->post($callback.'?slug=paymentProof', ['probe' => true]), fn (Response $r): bool => $r->status() === 400 && $r->json('message') === 'Invalid signature');

        $this->databaseCheck();

        $this->newLine();
        $this->line($this->failures === 0 ? 'Semua pemeriksaan lolos.' : "{$this->failures} pemeriksaan gagal.");

        return $this->failures === 0 ? self::SUCCESS : self::FAILURE;
    }

    private function http(): PendingRequest
    {
        return Http::connectTimeout(5)->timeout(15)->acceptJson();
    }

    private function timed(string $name, Closure $call, Closure $accept): void
    {
        $started = microtime(true);

        try {
            $response = $call();
            $ok = $accept($response);
            $detail = 'HTTP '.$response->status();
        } catch (ConnectionException $e) {
            $ok = false;
            $detail = 'tidak terhubung: '.Str::limit($e->getMessage(), 120);
        }

        $this->row($name, $ok, $detail.' ('.round((microtime(true) - $started) * 1000).' ms)');
    }

    private function databaseCheck(): void
    {
        try {
            DB::beginTransaction();
            File::query()->create(['file_id' => 'check-'.Str::uuid(), 'url' => 'https://example.test/check', 'purpose' => 'PAYMENT_PROOF']);
            DB::rollBack();
            $this->row('Database dapat menulis ke tabel files', true, 'uji tulis lalu dibatalkan');
        } catch (Throwable $e) {
            DB::rollBack();
            $this->row('Database dapat menulis ke tabel files', false, Str::limit($e->getMessage(), 140));
        }
    }

    private function row(string $name, bool $ok, string $detail): void
    {
        if (! $ok) {
            $this->failures++;
        }

        $this->line(($ok ? '[ OK    ] ' : '[ GAGAL ] ').$name.' - '.$detail);
    }
}
