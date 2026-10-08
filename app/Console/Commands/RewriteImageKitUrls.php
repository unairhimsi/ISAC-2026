<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;

class RewriteImageKitUrls extends Command
{
    protected $signature = 'imagekit:rewrite-urls {--dry-run : Hitung saja tanpa mengubah data} {--skip-check : Lewati pengecekan domain baru}';

    protected $description = 'Rewrite stored ImageKit file URLs from the legacy delivery endpoint to the configured one';

    public function handle(): int
    {
        $legacy = $this->normalize(config('services.imagekit.legacy_url_endpoint'));
        $current = $this->normalize(config('services.imagekit.url_endpoint'));

        if ($legacy === '' || $current === '') {
            $this->info('IMAGEKIT_LEGACY_URL_ENDPOINT atau IMAGEKIT_URL_ENDPOINT belum diisi. Tidak ada yang diubah.');

            return self::SUCCESS;
        }

        if ($legacy === $current) {
            $this->info('Endpoint lama dan endpoint saat ini sama. Tidak ada yang diubah.');

            return self::SUCCESS;
        }

        $oldPrefix = $legacy.'/';
        $newPrefix = $current.'/';

        $matches = DB::table('files')
            ->select('id', 'url')
            ->lazyById(500)
            ->filter(fn (object $file): bool => str_starts_with($file->url, $oldPrefix))
            ->collect();

        if ($matches->isEmpty()) {
            $this->info('Tidak ada URL file dengan endpoint lama. Tidak ada yang diubah.');

            return self::SUCCESS;
        }

        if ($this->option('dry-run')) {
            $this->info("{$matches->count()} URL akan diubah dari {$oldPrefix} ke {$newPrefix}.");

            return self::SUCCESS;
        }

        if (! $this->option('skip-check') && ! $this->newEndpointServesFiles($matches, $oldPrefix, $newPrefix)) {
            $this->error("Domain baru {$current} belum bisa melayani file. Tidak ada yang diubah.");

            return self::FAILURE;
        }

        DB::transaction(function () use ($matches, $oldPrefix, $newPrefix): void {
            foreach ($matches as $file) {
                DB::table('files')
                    ->where('id', $file->id)
                    ->update(['url' => $newPrefix.substr($file->url, strlen($oldPrefix))]);
            }
        });

        $this->info("Diubah {$matches->count()} URL dari {$oldPrefix} ke {$newPrefix}.");

        return self::SUCCESS;
    }

    private function newEndpointServesFiles(Collection $matches, string $oldPrefix, string $newPrefix): bool
    {
        foreach ($matches->shuffle()->take(3) as $file) {
            $candidate = $newPrefix.substr($file->url, strlen($oldPrefix));

            try {
                $response = Http::timeout(10)->withHeaders(['Range' => 'bytes=0-0'])->get($candidate);
            } catch (ConnectionException) {
                $this->warn("Tidak terhubung: {$candidate}");

                continue;
            }

            if ($response->successful()) {
                return true;
            }

            $this->warn("HTTP {$response->status()}: {$candidate}");
        }

        return false;
    }

    private function normalize(mixed $endpoint): string
    {
        return rtrim(trim((string) $endpoint), '/');
    }
}
