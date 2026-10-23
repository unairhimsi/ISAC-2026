<?php

namespace App\Services\Export;

use App\Enums\ExportFormat;
use Symfony\Component\HttpFoundation\Response;

final readonly class GeneratedExport
{
    public function __construct(
        public ExportFormat $format,
        public int $rows,
        private ?string $path = null,
        private ?string $content = null,
    ) {}

    public function toResponse(string $basename): Response
    {
        $filename = "{$basename}.{$this->format->value}";
        // Berisi data pribadi peserta: jangan biarkan proxy atau browser menyimpannya.
        $headers = [
            'Content-Type' => $this->format->mimeType(),
            'Cache-Control' => 'no-store, private',
            'X-Content-Type-Options' => 'nosniff',
        ];

        if ($this->path !== null) {
            // BinaryFileResponse menandai dirinya `public` secara bawaan; untuk data pribadi harus `private`.
            return response()->download($this->path, $filename, $headers)->deleteFileAfterSend(true)->setPrivate();
        }

        return response((string) $this->content, 200, $headers + [
            'Content-Disposition' => 'attachment; filename="'.$filename.'"',
        ]);
    }
}
