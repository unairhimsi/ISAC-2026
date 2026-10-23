<?php

namespace App\Http\Controllers\Api;

use App\Enums\ExportFormat;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\ExportPaymentsRequest;
use App\Http\Requests\Admin\ExportTeamsRequest;
use App\Models\Admin;
use App\Models\Registration;
use App\Models\Team;
use App\Services\Export\PaymentsExport;
use App\Services\Export\TabularExport;
use App\Services\Export\TabularExporter;
use App\Services\Export\TeamsExport;
use App\Services\SecurityAuditService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Symfony\Component\HttpFoundation\Response;

/**
 * Unduhan Excel/PDF untuk daftar admin. Selalu memuat semua baris yang cocok dengan filter,
 * bukan hanya halaman yang sedang tampil di UI.
 */
class AdminExportController extends Controller
{
    public function __construct(
        private readonly TabularExporter $exporter,
        private readonly SecurityAuditService $audit,
    ) {}

    public function teams(ExportTeamsRequest $request, TeamsExport $export): Response
    {
        $admin = $this->authorizeExport($request, Team::class);

        return $this->deliver($admin, 'teams', $request->exportFormat(), $request->filters(), $export->build($request->filters()));
    }

    public function payments(ExportPaymentsRequest $request, PaymentsExport $export): Response
    {
        $admin = $this->authorizeExport($request, Registration::class);

        return $this->deliver($admin, 'payments', $request->exportFormat(), $request->filters(), $export->build($request->filters()));
    }

    /** @param class-string $subject */
    private function authorizeExport(Request $request, string $subject): Admin
    {
        /** @var Admin $admin */
        $admin = $request->user();
        Gate::forUser($admin)->authorize('export', $subject);

        return $admin;
    }

    /** @param array<string, mixed> $filters */
    private function deliver(Admin $admin, string $resource, ExportFormat $format, array $filters, TabularExport $export): Response
    {
        $generated = $this->exporter->generate($export, $format);

        // Ekspor massal memuat data pribadi peserta, jadi siapa/kapan/apa dicatat. Kata kunci
        // pencarian tidak ikut dicatat karena bisa berisi email atau nama peserta.
        $this->audit->record('admin.export', $admin, [
            'resource' => $resource,
            'format' => $format->value,
            'rows' => $generated->rows,
            'filters' => collect($filters)
                ->filter(fn (mixed $value): bool => filled($value))
                ->map(fn (mixed $value, string $key): string => $key === 'search' ? 'search=yes' : "{$key}={$value}")
                ->implode(';'),
        ]);

        return $generated->toResponse($export->filename.'-'.now()->format('Ymd-His'));
    }
}
