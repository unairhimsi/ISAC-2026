<?php

namespace App\Services\Export;

use DateTimeInterface;

final readonly class ExportColumn
{
    public const FORMAT_DATETIME = 'dd/mm/yyyy hh:mm';

    public const FORMAT_MONEY = '#,##0';

    /**
     * @param  float  $width  Lebar kolom Excel (satuan karakter).
     * @param  string|null  $format  Format angka/tanggal Excel; null berarti General.
     * @param  bool  $inPdf  PDF dicetak di kertas, jadi kolom panjang (alamat, URL) boleh dilewati.
     */
    public function __construct(
        public string $key,
        public string $label,
        public float $width = 18,
        public ?string $format = null,
        public bool $inPdf = true,
    ) {}

    /** Representasi teks untuk PDF; Excel memakai nilai asli agar tetap bisa diurutkan dan dijumlahkan. */
    public function pdfText(mixed $value): string
    {
        return match (true) {
            $value === null || $value === '' => '-',
            $value instanceof DateTimeInterface => $value->format('d/m/Y H:i'),
            $this->format === self::FORMAT_MONEY && is_numeric($value) => 'Rp '.number_format((float) $value, 0, ',', '.'),
            default => (string) $value,
        };
    }
}
