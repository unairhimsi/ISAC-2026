<?php

namespace App\Services;

use App\Services\UploadThing\UploadThingException;
use App\Services\UploadThing\UploadThingToken;
use Illuminate\Support\Str;

class RichTextSanitizer
{
    public function clean(?string $html): ?string
    {
        if ($html === null) {
            return null;
        }

        $html = trim(strip_tags($html, '<p><br><strong><em><u><s><ul><ol><li><blockquote><code><pre><h2><h3><a><img>'));
        $html = preg_replace_callback('/<(a|img)\\b([^>]*)>/i', function (array $matches): string {
            $tag = strtolower($matches[1]);
            $attributes = $matches[2];

            if ($tag === 'a') {
                preg_match('/href\\s*=\\s*(["\\\'])(.*?)\\1/i', $attributes, $href);

                return isset($href[2]) && $this->isSafeUrl($href[2])
                    ? '<a href="'.e($href[2]).'" rel="noopener noreferrer" target="_blank">'
                    : '<a>';
            }

            preg_match('/src\\s*=\\s*(["\\\'])(.*?)\\1/i', $attributes, $src);
            preg_match('/alt\\s*=\\s*(["\\\'])(.*?)\\1/i', $attributes, $alt);

            if (! isset($src[2]) || ! $this->isUploadedImageUrl($src[2])) {
                return '';
            }

            return '<img src="'.e($src[2]).'" alt="'.e($alt[2] ?? '').'">';
        }, $html) ?? '';

        return trim($html);
    }

    public function hasContent(?string $html): bool
    {
        return trim(strip_tags((string) $html)) !== '' || Str::contains((string) $html, '<img ');
    }

    private function isSafeUrl(string $url): bool
    {
        return filter_var($url, FILTER_VALIDATE_URL)
            && strtolower((string) parse_url($url, PHP_URL_SCHEME)) === 'https';
    }

    private function isUploadedImageUrl(string $url): bool
    {
        if (! $this->isSafeUrl($url)) {
            return false;
        }

        return in_array(strtolower((string) parse_url($url, PHP_URL_HOST)), $this->uploadHosts(), true);
    }

    /** @return list<string> */
    private function uploadHosts(): array
    {
        $hosts = ['utfs.io'];

        try {
            $hosts[] = UploadThingToken::fromConfig()->ufsHost();
        } catch (UploadThingException) {
        }

        return $hosts;
    }
}
