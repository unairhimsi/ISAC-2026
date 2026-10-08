<?php

namespace App\Services\UploadThing;

use Illuminate\Support\Str;
use Symfony\Component\Process\PhpExecutableFinder;

final class UploadThingDevRelay
{
    public function start(array $registration): void
    {
        $php = (new PhpExecutableFinder)->find(false);

        if ($php === false) {
            throw new UploadThingException('PHP CLI tidak ditemukan untuk relay dev UploadThing.', 500);
        }

        $marker = storage_path('framework/cache/uploadthing-relay-'.Str::uuid().'.state');

        exec(sprintf(
            'nohup %s %s uploadthing:relay %s %s >> %s 2>&1 &',
            escapeshellarg($php),
            escapeshellarg(base_path('artisan')),
            escapeshellarg(base64_encode((string) json_encode($registration))),
            escapeshellarg($marker),
            escapeshellarg(storage_path('logs/uploadthing-relay.log')),
        ));

        $deadline = microtime(true) + 20;

        while (microtime(true) < $deadline) {
            if (is_file($marker) && filesize($marker) > 0) {
                $state = (string) file_get_contents($marker);
                @unlink($marker);

                if ($state === 'ok') {
                    usleep(1000000);

                    return;
                }

                throw new UploadThingException($state, 502);
            }

            usleep(100000);
        }

        throw new UploadThingException('Relay dev UploadThing tidak siap.', 502);
    }
}
