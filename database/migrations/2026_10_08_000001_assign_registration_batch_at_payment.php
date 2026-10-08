<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('registrations', function (Blueprint $table): void {
            $table->uuid('batch_id')->nullable()->change();
        });

        DB::transaction(function (): void {
            $unpaid = DB::table('registrations')
                ->whereNotNull('batch_id')
                ->whereNull('payment_submitted_at');

            $released = (clone $unpaid)
                ->selectRaw('batch_id, COUNT(*) as total')
                ->groupBy('batch_id')
                ->pluck('total', 'batch_id');

            foreach ($released as $batchId => $total) {
                $current = (int) DB::table('batches')->where('id', $batchId)->value('current_registrations');
                DB::table('batches')->where('id', $batchId)->update([
                    'current_registrations' => max(0, $current - (int) $total),
                ]);
            }

            $unpaid->update(['batch_id' => null]);
        });
    }

    public function down(): void
    {
        if (DB::table('registrations')->whereNull('batch_id')->exists()) {
            throw new RuntimeException(
                'Tidak bisa rollback: masih ada registrasi yang belum membayar sehingga batch_id-nya kosong.'
            );
        }

        Schema::table('registrations', function (Blueprint $table): void {
            $table->uuid('batch_id')->nullable(false)->change();
        });
    }
};
