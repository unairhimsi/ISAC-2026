<?php

namespace App\Services\Export;

use App\Models\Batch;
use App\Models\Competition;

/**
 * Label berbahasa Indonesia untuk isi ekspor. Dijaga sama dengan `adminStatusLabel` di
 * resources/js/features/admin/components/AdminStatusBadge.tsx supaya angka dan istilah di
 * file ekspor sama dengan yang dilihat admin di layar.
 */
final class ExportLabels
{
    private const STATUS = [
        'VERIFIED' => 'Terverifikasi',
        'WAITING_VERIFICATION' => 'Menunggu Verifikasi',
        'WAITING_PAYMENT' => 'Menunggu Pembayaran',
        'REVISION_REQUIRED' => 'Perlu Revisi',
        'REJECTED' => 'Ditolak',
        'CANCELLED' => 'Dibatalkan',
        'INCOMPLETE' => 'Belum Lengkap',
    ];

    private const PAYMENT_METHOD = [
        'BANK_TRANSFER' => 'Transfer Bank',
        'QRIS' => 'QRIS',
    ];

    public static function status(?string $status): ?string
    {
        return $status === null ? null : (self::STATUS[$status] ?? str_replace('_', ' ', $status));
    }

    public static function paymentMethod(?string $method): ?string
    {
        return $method === null ? null : (self::PAYMENT_METHOD[$method] ?? $method);
    }

    /**
     * Ringkasan filter aktif untuk subjudul PDF dan sheet Info, supaya file yang sudah
     * diunduh tetap menjelaskan himpunan data yang dimuatnya.
     *
     * @param  array<string, mixed>  $filters
     * @return list<array{0: string, 1: string}>
     */
    public static function describeFilters(array $filters): array
    {
        $lines = [];

        if (filled($filters['search'] ?? null)) {
            $lines[] = ['Pencarian', (string) $filters['search']];
        }
        if (filled($filters['status'] ?? null)) {
            $lines[] = ['Status', self::status((string) $filters['status']) ?? ''];
        }
        if (filled($filters['competition_id'] ?? null)) {
            $lines[] = ['Kompetisi', Competition::query()->whereKey($filters['competition_id'])->value('name') ?? (string) $filters['competition_id']];
        }
        if (filled($filters['batch_id'] ?? null)) {
            $lines[] = ['Batch', Batch::query()->whereKey($filters['batch_id'])->value('name') ?? (string) $filters['batch_id']];
        }
        if (filled($filters['payment_method'] ?? null)) {
            $lines[] = ['Metode', self::paymentMethod((string) $filters['payment_method']) ?? ''];
        }

        return $lines === [] ? [['Filter', 'Tidak ada (semua data)']] : $lines;
    }
}
