<?php

namespace App\Services\UploadThing;

use App\Models\Admin;
use App\Models\File;
use App\Models\Team;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;

class UploadThingUploadService
{
    public function __construct(private readonly UploadThingSigner $signer) {}

    public function routeConfig(): array
    {
        $routes = [];

        foreach ((array) config('uploadthing.routes') as $slug => $route) {
            $limit = $this->formatSize((int) $route['max_size']);
            $config = [];

            if (array_filter($route['types'], fn (string $type): bool => str_starts_with($type, 'image/')) !== []) {
                $config['image'] = ['maxFileSize' => $limit, 'maxFileCount' => 1, 'minFileCount' => 1];
            }
            if (in_array('application/pdf', $route['types'], true)) {
                $config['pdf'] = ['maxFileSize' => $limit, 'maxFileCount' => 1, 'minFileCount' => 1];
            }

            $routes[] = ['slug' => $slug, 'config' => $config];
        }

        return $routes;
    }

    public function prepare(?Model $user, string $slug, array $input, string $frontendPackage): array
    {
        $route = $this->route($slug);
        $principal = $this->principal($user, $route);
        $files = $this->validatedFiles($input, $route);

        $token = UploadThingToken::fromConfig();
        $ingestUrl = $token->ingestUrl();

        $presigned = array_map(function (array $file) use ($token, $ingestUrl, $slug): array {
            $key = $this->signer->generateKey($token->appId, $file);

            return [
                'url' => $this->signer->signedUrl("{$ingestUrl}/{$key}", $token->apiKey, [
                    'x-ut-identifier' => $token->appId,
                    'x-ut-file-name' => $file['name'],
                    'x-ut-file-size' => $file['size'],
                    'x-ut-file-type' => $file['type'],
                    'x-ut-slug' => $slug,
                    'x-ut-custom-id' => null,
                    'x-ut-content-disposition' => 'inline',
                    'x-ut-acl' => null,
                ], (int) config('uploadthing.presigned_ttl', 3600)),
                'key' => $key,
                'name' => $file['name'],
                'customId' => null,
            ];
        }, $files);

        (new UploadThingClient($token))->registerRouteMetadata(
            array_column($presigned, 'key'),
            ['slug' => $slug, 'purpose' => $route['purpose'], 'principal' => $principal['type'], 'principalId' => $principal['id']],
            $this->callbackUrl($slug),
            $slug,
            $frontendPackage,
        );

        return $presigned;
    }

    public function complete(string $slug, array $payload): void
    {
        $token = UploadThingToken::fromConfig();
        $origin = (string) ($payload['origin'] ?? '');
        $file = $payload['file'] ?? null;

        if (! is_array($file) || ! is_string($file['key'] ?? null) || ! $token->isIngestOrigin($origin)) {
            throw new UploadThingException('Callback UploadThing tidak valid.', 400);
        }

        $client = new UploadThingClient($token);
        $key = $file['key'];

        try {
            $registered = $this->register($token, $slug, $file, (array) ($payload['metadata'] ?? []));
        } catch (UploadThingException $e) {
            $this->report($client, $origin, $key, null, $e->getMessage());

            return;
        }

        $this->report($client, $origin, $key, [
            'id' => $registered->id,
            'fileId' => $registered->file_id,
            'url' => $registered->url,
            'purpose' => $registered->purpose,
        ], null);
    }

    private function route(string $slug): array
    {
        $route = config("uploadthing.routes.{$slug}");

        if (! is_array($route)) {
            throw new UploadThingException("Rute upload {$slug} tidak ditemukan.", 404);
        }

        return $route;
    }

    private function principal(?Model $user, array $route): array
    {
        if ($user instanceof Team && $route['team'] === true) {
            return ['type' => 'team', 'id' => (string) $user->getKey()];
        }

        if ($user instanceof Admin && in_array($user->role, $route['admin_roles'], true)) {
            return ['type' => 'admin', 'id' => (string) $user->getKey()];
        }

        throw new UploadThingException('Anda tidak berhak mengunggah jenis file ini.', 403);
    }

    private function validatedFiles(array $input, array $route): array
    {
        $validator = Validator::make($input, [
            'files' => ['required', 'array', 'size:1'],
            'files.*.name' => ['required', 'string', 'max:255'],
            'files.*.size' => ['required', 'integer', 'min:1'],
            'files.*.type' => ['required', 'string', 'max:127'],
            'files.*.lastModified' => ['nullable', 'numeric'],
        ], [
            'files.size' => 'Unggah tepat satu file.',
            'files.required' => 'File belum dipilih.',
        ]);

        if ($validator->fails()) {
            throw new UploadThingException((string) $validator->errors()->first(), 400);
        }

        $files = array_values($validator->validated()['files']);

        foreach ($files as $file) {
            if (! in_array($file['type'], $route['types'], true)) {
                throw new UploadThingException('Tipe file tidak diizinkan. Gunakan '.$this->describeTypes($route['types']).'.', 400);
            }
            if ($file['size'] > $route['max_size']) {
                throw new UploadThingException('Ukuran file melebihi batas '.$this->formatSize((int) $route['max_size']).'.', 400);
            }
        }

        return $files;
    }

    private function register(UploadThingToken $token, string $slug, array $file, array $metadata): File
    {
        $route = config("uploadthing.routes.{$slug}");
        $key = (string) $file['key'];
        $url = (string) ($file['ufsUrl'] ?? '');
        $host = strtolower((string) parse_url($url, PHP_URL_HOST));

        if (! is_array($route) || ($metadata['purpose'] ?? null) !== $route['purpose']) {
            throw new UploadThingException('Rute upload tidak cocok.', 400);
        }
        if (! $this->signer->keyBelongsToApp($key, $token->appId) || ! in_array($host, [$token->ufsHost(), 'utfs.io'], true)) {
            throw new UploadThingException('File tidak berasal dari aplikasi ini.', 400);
        }
        if (! in_array($file['type'] ?? null, $route['types'], true) || (int) ($file['size'] ?? 0) > $route['max_size']) {
            throw new UploadThingException('File tidak memenuhi syarat tipe atau ukuran.', 400);
        }

        $uploadedBy = null;
        if (($metadata['principal'] ?? null) === 'team') {
            $uploadedBy = Team::query()->whereKey($metadata['principalId'] ?? null)->value('id');
            if ($uploadedBy === null) {
                throw new UploadThingException('Pengunggah tidak ditemukan.', 400);
            }
        }

        return File::query()->firstOrCreate(
            ['file_id' => $key],
            ['url' => $url, 'purpose' => $route['purpose'], 'uploaded_by' => $uploadedBy],
        );
    }

    private function report(UploadThingClient $client, string $origin, string $key, ?array $callbackData, ?string $error): void
    {
        try {
            $client->sendCallbackResult($origin, $key, $callbackData, $error);
        } catch (UploadThingException $e) {
            Log::warning('UploadThing callback result gagal dikirim', ['key' => $key, 'reason' => $e->getMessage()]);
        }
    }

    private function callbackUrl(string $slug): string
    {
        $base = config('uploadthing.callback_url') ?: rtrim((string) config('app.url'), '/').'/api/uploadthing/hook';

        return $base.(str_contains($base, '?') ? '&' : '?').'slug='.rawurlencode($slug);
    }

    private function describeTypes(array $types): string
    {
        $labels = [];

        foreach ($types as $type) {
            $labels[] = $type === 'application/pdf' ? 'PDF' : strtoupper(substr($type, strpos($type, '/') + 1));
        }

        return implode(', ', array_unique($labels));
    }

    private function formatSize(int $bytes): string
    {
        return ($bytes / 1048576).'MB';
    }
}
