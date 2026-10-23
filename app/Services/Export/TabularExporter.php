<?php

namespace App\Services\Export;

use App\Enums\ExportFormat;
use Dompdf\Dompdf;
use Dompdf\Options as DompdfOptions;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use OpenSpout\Common\Entity\Cell;
use OpenSpout\Common\Entity\Cell\DateTimeCell;
use OpenSpout\Common\Entity\Cell\EmptyCell;
use OpenSpout\Common\Entity\Cell\NumericCell;
use OpenSpout\Common\Entity\Cell\StringCell;
use OpenSpout\Common\Entity\Row;
use OpenSpout\Common\Entity\Style\CellVerticalAlignment;
use OpenSpout\Common\Entity\Style\Color;
use OpenSpout\Common\Entity\Style\Style;
use OpenSpout\Writer\AutoFilter;
use OpenSpout\Writer\XLSX\Options;
use OpenSpout\Writer\XLSX\Writer;
use Throwable;

class TabularExporter
{
    /**
     * Dompdf menyimpan seluruh pohon dokumen di memori dan tumbuh lebih cepat dari linear.
     * Terukur dengan data tim realistis (11 kolom): 200 baris +94 MB, 400 baris +206 MB, 600 baris
     * +366 MB. Karena itu PDF dibatasi dan lebih besar dari itu harus diunduh sebagai Excel
     * (ditulis baris-per-baris, tanpa batas).
     */
    public const PDF_MAX_ROWS = 300;

    /** Cukup untuk PDF_MAX_ROWS beserta dasar memori Laravel; bawaan php-fpm hanya 128M. */
    private const PDF_MEMORY_LIMIT = '256M';

    public function __construct(private readonly int $pdfMaxRows = self::PDF_MAX_ROWS) {}

    public function generate(TabularExport $export, ExportFormat $format): GeneratedExport
    {
        return match ($format) {
            ExportFormat::XLSX => $this->xlsx($export),
            ExportFormat::PDF => $this->pdf($export),
        };
    }

    private function xlsx(TabularExport $export): GeneratedExport
    {
        $path = sys_get_temp_dir().'/isac_export_'.Str::uuid().'.xlsx';
        $columns = $export->columns;

        $options = new Options;
        foreach ($columns as $index => $column) {
            $options->setColumnWidth($column->width, $index + 1);
        }

        $writer = new Writer($options);
        $writer->setCreator((string) config('app.name'));

        try {
            $writer->openToFile($path);

            $sheet = $writer->getCurrentSheet();
            $sheet->setName($export->sheetName);
            // Sengaja tanpa SheetView/freeze pane: OpenSpout 4.28 (rilis terakhir yang mendukung PHP 8.2)
            // menulis atribut "showZeroes" yang bukan bagian skema OOXML ("showZeros") sehingga
            // pembaca ketat menolak berkas. Diperbaiki di 4.32 yang mensyaratkan PHP 8.3.

            $headerStyle = (new Style)
                ->setFontBold()
                ->setFontColor(Color::WHITE)
                ->setBackgroundColor('1F2937')
                ->setShouldWrapText()
                ->setCellVerticalAlignment(CellVerticalAlignment::CENTER);
            $writer->addRow(new Row(array_map(
                fn (ExportColumn $column): Cell => new StringCell($column->label, $headerStyle),
                $columns,
            )));

            $bodyStyles = [];
            foreach ($columns as $column) {
                $style = (new Style)->setShouldWrapText()->setCellVerticalAlignment(CellVerticalAlignment::TOP);
                $bodyStyles[$column->key] = $column->format === null ? $style : $style->setFormat($column->format);
            }

            $count = 0;
            foreach ($export->rows as $row) {
                $writer->addRow(new Row(array_map(
                    fn (ExportColumn $column): Cell => $this->cell($row[$column->key] ?? null, $bodyStyles[$column->key]),
                    $columns,
                )));
                $count++;
            }

            if ($count > 0) {
                $sheet->setAutoFilter(new AutoFilter(0, 1, count($columns) - 1, $count + 1));
            }

            $this->writeInfoSheet($writer, $export, $count);
            $writer->close();
        } catch (Throwable $exception) {
            File::delete($path);

            throw $exception;
        }

        return new GeneratedExport(ExportFormat::XLSX, $count, path: $path);
    }

    /**
     * Teks selalu ditulis sebagai StringCell. `Cell::fromValue()` mengubah string berawalan "="
     * menjadi rumus, padahal nama tim atau alamat diisi sendiri oleh peserta.
     */
    private function cell(mixed $value, Style $style): Cell
    {
        return match (true) {
            $value === null || $value === '' => new EmptyCell(null, $style),
            $value instanceof \DateTimeInterface => new DateTimeCell($value, $style),
            is_int($value) || is_float($value) => new NumericCell($value, $style),
            default => new StringCell((string) $value, $style),
        };
    }

    private function writeInfoSheet(Writer $writer, TabularExport $export, int $count): void
    {
        $writer->addNewSheetAndMakeItCurrent()->setName('Info');

        $label = (new Style)->setFontBold()->setCellVerticalAlignment(CellVerticalAlignment::TOP);
        $value = (new Style)->setShouldWrapText()->setCellVerticalAlignment(CellVerticalAlignment::TOP);

        $lines = [
            ['Laporan', $export->title],
            ['Diekspor pada', now()->format('d/m/Y H:i:s').' ('.config('app.timezone').')'],
            ['Jumlah baris', (string) $count],
            ...$export->summary,
        ];

        foreach ($lines as [$name, $text]) {
            $writer->addRow(new Row([new StringCell($name, $label), new StringCell($text, $value)]));
        }
    }

    private function pdf(TabularExport $export): GeneratedExport
    {
        $this->ensureMemoryLimit(self::PDF_MEMORY_LIMIT);

        $columns = array_values(array_filter($export->columns, fn (ExportColumn $column): bool => $column->inPdf));

        $rows = [];
        foreach ($export->rows as $row) {
            if (count($rows) >= $this->pdfMaxRows) {
                throw ValidationException::withMessages([
                    'format' => 'Data terlalu banyak untuk PDF (lebih dari '.number_format($this->pdfMaxRows, 0, ',', '.').' baris). Unduh dalam format Excel untuk mendapatkan semua data.',
                ]);
            }

            $rows[] = array_map(fn (ExportColumn $column): string => $column->pdfText($row[$column->key] ?? null), $columns);
        }

        $html = view('exports.table', [
            'title' => $export->title,
            'generatedAt' => now()->format('d/m/Y H:i'),
            'timezone' => config('app.timezone'),
            'summary' => $export->summary,
            'columns' => $columns,
            'rows' => $rows,
            'totalWidth' => array_sum(array_map(fn (ExportColumn $column): float => $column->width, $columns)),
        ])->render();

        $dompdf = new Dompdf($this->dompdfOptions());
        $dompdf->loadHtml($html, 'UTF-8');
        $dompdf->setPaper('a4', 'landscape');
        $dompdf->render();

        $canvas = $dompdf->getCanvas();
        $canvas->page_text(
            $canvas->get_width() - 90,
            $canvas->get_height() - 24,
            'Hal {PAGE_NUM} / {PAGE_COUNT}',
            $dompdf->getFontMetrics()->getFont('DejaVu Sans'),
            7,
            [0.42, 0.45, 0.5],
        );

        return new GeneratedExport(ExportFormat::PDF, count($rows), content: $dompdf->output());
    }

    /** Menaikkan memory_limit untuk request ini saja; tidak pernah menurunkan atau membatasi nilai yang sudah lebih besar. */
    private function ensureMemoryLimit(string $minimum): void
    {
        $current = ini_parse_quantity((string) ini_get('memory_limit'));

        if ($current !== -1 && $current < ini_parse_quantity($minimum)) {
            ini_set('memory_limit', $minimum);
        }
    }

    private function dompdfOptions(): DompdfOptions
    {
        // Berkas sementara dompdf (cache font) ditulis ke storage, bukan ke direktori vendor.
        $cache = storage_path('framework/cache/dompdf');
        File::ensureDirectoryExists($cache);

        $options = new DompdfOptions;
        $options->set('defaultFont', 'DejaVu Sans');
        $options->set('isRemoteEnabled', false);
        $options->set('isPhpEnabled', false);
        $options->set('isHtml5ParserEnabled', true);
        $options->set('tempDir', $cache);
        $options->set('fontCache', $cache);
        $options->set('chroot', [resource_path('views/exports')]);

        return $options;
    }
}
