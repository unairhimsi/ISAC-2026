<?php

namespace App\Services\Export;

/**
 * Deskripsi tabel yang siap diekspor ke Excel maupun PDF.
 *
 * `rows` sengaja iterable (biasanya generator di atas query lazy) supaya semua baris hasil filter
 * bisa ditulis tanpa memuat seluruh tabel ke memori. Iterable ini hanya boleh dibaca satu kali.
 */
final readonly class TabularExport
{
    /**
     * @param  list<ExportColumn>  $columns
     * @param  iterable<array<string, mixed>>  $rows  Kunci mengikuti `ExportColumn::$key`.
     * @param  list<array{0: string, 1: string}>  $summary  Pasangan label/nilai (filter aktif) untuk subjudul PDF dan sheet Info.
     */
    public function __construct(
        public string $title,
        public string $filename,
        public string $sheetName,
        public array $columns,
        public iterable $rows,
        public array $summary = [],
    ) {}
}
