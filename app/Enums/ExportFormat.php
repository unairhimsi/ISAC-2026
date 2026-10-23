<?php

namespace App\Enums;

enum ExportFormat: string
{
    case XLSX = 'xlsx';
    case PDF = 'pdf';

    public function mimeType(): string
    {
        return match ($this) {
            self::XLSX => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            self::PDF => 'application/pdf',
        };
    }
}
