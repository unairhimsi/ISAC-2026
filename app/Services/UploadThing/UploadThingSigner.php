<?php

namespace App\Services\UploadThing;

use Sqids\Sqids;

final class UploadThingSigner
{
    private const SIGNATURE_PREFIX = 'hmac-sha256=';

    public function hash(string $value): int
    {
        $hash = 5381;
        $units = $value === '' ? [] : array_values(unpack('n*', mb_convert_encoding($value, 'UTF-16BE', 'UTF-8')));

        for ($i = count($units) - 1; $i >= 0; $i--) {
            $hash = $this->toInt32($hash * 33) ^ $units[$i];
        }

        $unsigned = $hash & 0xFFFFFFFF;

        return $this->toInt32(($unsigned & 0xBFFFFFFF) | (($unsigned >> 1) & 0x40000000));
    }

    public function shuffle(string $alphabet, string $seed): string
    {
        $chars = str_split($alphabet);
        $count = count($chars);
        $seedNumber = $this->hash($seed);

        for ($i = 0; $i < $count; $i++) {
            $j = (($seedNumber % ($i + 1)) + $i) % $count;
            [$chars[$i], $chars[$j]] = [$chars[$j], $chars[$i]];
        }

        return implode('', $chars);
    }

    public function generateKey(string $appId, array $file, ?int $nowMs = null): string
    {
        $this->assertMathExtension();
        $now = $nowMs ?? $this->nowMs();
        $parts = json_encode(
            [$file['name'], $file['size'], $file['type'], $file['lastModified'] ?? $now, $now],
            JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES,
        );
        $alphabet = $this->shuffle(Sqids::DEFAULT_ALPHABET, $appId);

        $encodedFileSeed = (new Sqids($alphabet, 36))->encode([abs($this->hash($parts))]);
        $encodedAppId = (new Sqids($alphabet, 12))->encode([abs($this->hash($appId))]);

        return $encodedAppId.$encodedFileSeed;
    }

    public function keyBelongsToApp(string $key, string $appId): bool
    {
        $this->assertMathExtension();
        $alphabet = $this->shuffle(Sqids::DEFAULT_ALPHABET, $appId);

        return str_starts_with($key, (new Sqids($alphabet, 12))->encode([abs($this->hash($appId))]));
    }

    public function sign(string $payload, string $secret): string
    {
        return self::SIGNATURE_PREFIX.hash_hmac('sha256', $payload, $secret);
    }

    public function verify(string $payload, ?string $signature, string $secret): bool
    {
        if ($signature === null || ! str_starts_with($signature, self::SIGNATURE_PREFIX)) {
            return false;
        }

        $provided = substr($signature, strlen(self::SIGNATURE_PREFIX));

        return $provided !== '' && hash_equals(hash_hmac('sha256', $payload, $secret), strtolower($provided));
    }

    public function signedUrl(string $url, string $secret, array $data, int $ttlSeconds = 3600, ?int $nowMs = null): string
    {
        $pairs = [['expires', (string) (($nowMs ?? $this->nowMs()) + $ttlSeconds * 1000)]];

        foreach ($data as $name => $value) {
            if ($value === null) {
                continue;
            }
            $pairs[] = [$name, $this->encodeUriComponent((string) $value)];
        }

        $query = implode('&', array_map(
            fn (array $pair): string => $this->formEncode($pair[0]).'='.$this->formEncode($pair[1]),
            $pairs,
        ));
        $unsigned = $url.'?'.$query;

        return $unsigned.'&signature='.$this->formEncode($this->sign($unsigned, $secret));
    }

    private function assertMathExtension(): void
    {
        if (! extension_loaded('gmp') && ! extension_loaded('bcmath')) {
            throw new UploadThingException('Server belum mendukung upload: aktifkan ekstensi PHP bcmath atau gmp.', 500);
        }
    }

    private function encodeUriComponent(string $value): string
    {
        return strtr(rawurlencode($value), ['%21' => '!', '%27' => "'", '%28' => '(', '%29' => ')', '%2A' => '*']);
    }

    private function formEncode(string $value): string
    {
        return str_replace('%2A', '*', urlencode($value));
    }

    private function toInt32(int|float $value): int
    {
        $masked = (int) fmod((float) $value, 4294967296.0);
        $masked = $masked & 0xFFFFFFFF;

        return $masked >= 0x80000000 ? $masked - 0x100000000 : $masked;
    }

    private function nowMs(): int
    {
        return (int) floor(microtime(true) * 1000);
    }
}
