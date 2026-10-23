<?php

namespace App\Services\Export;

use App\Models\Competition;
use App\Models\Registration;
use App\Services\AdminRegistrationService;
use Generator;

/** Ekspor pembayaran: satu baris per registrasi yang sudah diwajibkan atau sudah mengirim bukti bayar. */
class PaymentsExport
{
    public function __construct(private readonly AdminRegistrationService $registrations) {}

    /** @param array<string, mixed> $filters */
    public function build(array $filters): TabularExport
    {
        return new TabularExport(
            title: 'Rekap Pembayaran ISAC 2026',
            filename: 'rekap-pembayaran-isac-2026',
            sheetName: 'Pembayaran',
            columns: self::columns(),
            rows: $this->rows($filters),
            summary: ExportLabels::describeFilters($filters),
        );
    }

    /** @return list<ExportColumn> */
    public static function columns(): array
    {
        return [
            new ExportColumn('kode_tim', 'Kode Tim', 14),
            new ExportColumn('nama_tim', 'Nama Tim', 26),
            new ExportColumn('email_tim', 'Email Tim', 30, inPdf: false),
            new ExportColumn('telepon_tim', 'Telepon Tim', 16, inPdf: false),
            new ExportColumn('institusi', 'Institusi', 28, inPdf: false),
            new ExportColumn('kompetisi', 'Kompetisi', 24),
            new ExportColumn('batch', 'Batch', 16),
            new ExportColumn('konteks', 'Pembayaran Untuk', 16, inPdf: false),
            new ExportColumn('tahap_tujuan', 'Tahap Tujuan', 18, inPdf: false),
            new ExportColumn('status', 'Status', 20),
            new ExportColumn('metode', 'Metode', 14),
            new ExportColumn('id_transaksi', 'ID Transaksi', 22, inPdf: false),
            new ExportColumn('harga_asli', 'Harga Asli (Rp)', 16, ExportColumn::FORMAT_MONEY, inPdf: false),
            new ExportColumn('kode_promo', 'Kode Promo', 14, inPdf: false),
            new ExportColumn('diskon_persen', 'Diskon (%)', 11, inPdf: false),
            new ExportColumn('diskon_rupiah', 'Diskon (Rp)', 14, ExportColumn::FORMAT_MONEY, inPdf: false),
            new ExportColumn('nominal_dibayar', 'Nominal Dibayar (Rp)', 18, ExportColumn::FORMAT_MONEY),
            new ExportColumn('diwajibkan_pada', 'Diwajibkan Pada', 18, ExportColumn::FORMAT_DATETIME, inPdf: false),
            new ExportColumn('bukti_dikirim', 'Bukti Dikirim', 18, ExportColumn::FORMAT_DATETIME),
            new ExportColumn('direview_pada', 'Direview Pada', 18, ExportColumn::FORMAT_DATETIME, inPdf: false),
            new ExportColumn('direview_oleh', 'Direview Oleh', 20),
            new ExportColumn('alasan', 'Catatan Penolakan/Revisi', 34, inPdf: false),
            new ExportColumn('bukti_url', 'Tautan Bukti Pembayaran', 40, inPdf: false),
        ];
    }

    /**
     * @param  array<string, mixed>  $filters
     * @return Generator<int, array<string, mixed>>
     */
    private function rows(array $filters): Generator
    {
        /** @var Registration $registration */
        foreach ($this->registrations->paymentsQuery($filters)->lazy(200) as $registration) {
            $team = $registration->team;
            $submitted = $registration->payment_submitted_at !== null;

            // Sama dengan AdminPaymentResource: setelah bukti dikirim, harga asli = dibayar + diskon.
            $originalAmount = $submitted
                ? (float) $registration->amount_paid + (float) $registration->discount_amount
                : (float) ($registration->batch?->price ?? 0);

            yield [
                'kode_tim' => $team->code,
                'nama_tim' => $team->name,
                'email_tim' => $team->email,
                'telepon_tim' => $team->phone,
                'institusi' => $team->institution_name,
                'kompetisi' => $registration->competition?->name,
                'batch' => $registration->batch?->name ?? 'Belum ditentukan',
                'konteks' => $registration->competition?->payment_flow === Competition::PAYMENT_UPFRONT ? 'Pendaftaran' : 'Semifinal',
                'tahap_tujuan' => $registration->paymentForStage?->name,
                'status' => ExportLabels::status($registration->status?->value),
                'metode' => $submitted ? ExportLabels::paymentMethod($registration->payment_method?->value) : null,
                'id_transaksi' => $registration->transaction_id,
                'harga_asli' => $originalAmount,
                'kode_promo' => $registration->promo_code,
                'diskon_persen' => $submitted ? (float) $registration->discount_percent : null,
                'diskon_rupiah' => $submitted ? (float) $registration->discount_amount : null,
                'nominal_dibayar' => $submitted ? (float) $registration->amount_paid : null,
                'diwajibkan_pada' => $registration->payment_required_at,
                'bukti_dikirim' => $registration->payment_submitted_at,
                'direview_pada' => $registration->payment_verified_at,
                'direview_oleh' => $registration->paymentVerifiedBy?->name,
                'alasan' => $registration->payment_rejection_reason,
                'bukti_url' => $registration->paymentProofFile?->url,
            ];
        }
    }
}
