<?php

namespace App\Console\Commands;

use App\Models\Registration;
use Illuminate\Console\Command;

class AuditRegistrationBatches extends Command
{
    protected $signature = 'registrations:audit-batches';

    protected $description = 'Read-only: list registrations whose payment time falls outside the period of the batch they are assigned to';

    public function handle(): int
    {
        $mismatched = Registration::query()
            ->with('team:id,code,name', 'competition:id,name', 'batch:id,name,start_date,end_date,price')
            ->whereNotNull('payment_submitted_at')
            ->whereNotNull('batch_id')
            ->whereHas('batch', fn ($batch) => $batch
                ->withTrashed()
                ->where(fn ($period) => $period
                    ->whereColumn('batches.start_date', '>', 'registrations.payment_submitted_at')
                    ->orWhereColumn('batches.end_date', '<', 'registrations.payment_submitted_at')))
            ->orderBy('payment_submitted_at')
            ->get();

        if ($mismatched->isEmpty()) {
            $this->info('Semua pembayaran jatuh di dalam periode batch-nya.');

            return self::SUCCESS;
        }

        $this->table(
            ['Tim', 'Kompetisi', 'Batch terikat', 'Periode batch', 'Harga batch', 'Dibayar', 'Waktu bayar'],
            $mismatched->map(fn (Registration $registration): array => [
                $registration->team?->code.' '.$registration->team?->name,
                $registration->competition?->name,
                $registration->batch?->name,
                $registration->batch?->start_date?->format('Y-m-d H:i').' s/d '.$registration->batch?->end_date?->format('Y-m-d H:i'),
                $registration->batch?->price,
                $registration->amount_paid,
                $registration->payment_submitted_at?->format('Y-m-d H:i'),
            ])->all(),
        );
        $this->warn("{$mismatched->count()} registrasi dibayar di luar periode batch-nya. Command ini hanya melaporkan; tidak ada data yang diubah.");

        return self::SUCCESS;
    }
}
