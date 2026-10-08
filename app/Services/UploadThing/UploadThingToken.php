<?php

namespace App\Services\UploadThing;

final class UploadThingToken
{
    public function __construct(
        public readonly string $apiKey,
        public readonly string $appId,
        public readonly array $regions,
        public readonly string $ingestHost = 'ingest.uploadthing.com',
    ) {}

    public static function fromConfig(): self
    {
        return self::decode((string) config('uploadthing.token'));
    }

    public static function decode(string $encoded): self
    {
        $json = base64_decode(trim($encoded, " \t\n\r\0\x0B'\""), true);
        $data = $json === false ? null : json_decode($json, true);

        if (! is_array($data)
            || ! is_string($data['apiKey'] ?? null) || $data['apiKey'] === ''
            || ! is_string($data['appId'] ?? null) || $data['appId'] === ''
            || ! is_array($data['regions'] ?? null) || $data['regions'] === []) {
            throw new UploadThingException('Konfigurasi UploadThing belum lengkap.', 500);
        }

        return new self(
            $data['apiKey'],
            $data['appId'],
            array_values(array_map('strval', $data['regions'])),
            is_string($data['ingestHost'] ?? null) && $data['ingestHost'] !== '' ? $data['ingestHost'] : 'ingest.uploadthing.com',
        );
    }

    public function ingestUrl(?string $region = null): string
    {
        $selected = $region !== null && in_array($region, $this->regions, true) ? $region : $this->regions[0];

        return "https://{$selected}.{$this->ingestHost}";
    }

    public function isIngestOrigin(string $origin): bool
    {
        $parts = parse_url($origin);
        $host = strtolower((string) ($parts['host'] ?? ''));

        return ($parts['scheme'] ?? '') === 'https'
            && $host !== ''
            && str_ends_with($host, '.'.strtolower($this->ingestHost));
    }

    public function ufsHost(): string
    {
        return strtolower($this->appId).'.ufs.sh';
    }
}
