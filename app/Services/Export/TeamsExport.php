<?php

namespace App\Services\Export;

use App\Models\Team;
use App\Services\AdminRegistrationService;
use Generator;

/**
 * Ekspor tim: satu baris per anggota (data tim diulang) sehingga tabel tetap datar dan
 * bisa difilter atau di-pivot di Excel. Tim tanpa anggota tetap muncul sebagai satu baris.
 */
class TeamsExport
{
    public function __construct(private readonly AdminRegistrationService $registrations) {}

    /** @param array<string, mixed> $filters */
    public function build(array $filters): TabularExport
    {
        return new TabularExport(
            title: 'Data Tim & Peserta ISAC 2026',
            filename: 'data-tim-isac-2026',
            sheetName: 'Tim & Peserta',
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
            new ExportColumn('institusi', 'Institusi', 30),
            new ExportColumn('alamat_institusi', 'Alamat Institusi', 36, inPdf: false),
            new ExportColumn('kompetisi', 'Kompetisi', 24),
            new ExportColumn('batch', 'Batch', 16),
            new ExportColumn('tahap', 'Tahap Saat Ini', 18, inPdf: false),
            new ExportColumn('status_tim', 'Status Tim', 18),
            new ExportColumn('status_registrasi', 'Status Registrasi', 18),
            new ExportColumn('tanggal_daftar', 'Tanggal Daftar', 18, ExportColumn::FORMAT_DATETIME, inPdf: false),
            new ExportColumn('tanggal_submit', 'Tanggal Submit', 18, ExportColumn::FORMAT_DATETIME, inPdf: false),
            new ExportColumn('nama_anggota', 'Nama Anggota', 26),
            new ExportColumn('peran_anggota', 'Peran', 11),
            new ExportColumn('email_anggota', 'Email Anggota', 30),
            new ExportColumn('nisn_nim', 'NISN/NIM', 16),
            new ExportColumn('jurusan', 'Jurusan', 22, inPdf: false),
            new ExportColumn('fakultas', 'Fakultas', 22, inPdf: false),
        ];
    }

    /**
     * @param  array<string, mixed>  $filters
     * @return Generator<int, array<string, mixed>>
     */
    private function rows(array $filters): Generator
    {
        $teams = $this->registrations->teamsQuery($filters)
            ->with([
                'members' => fn ($query) => $query->orderBy('sort_order'),
                'registration.competition',
                'registration.batch',
                'currentStage',
            ])
            ->lazy(200);

        /** @var Team $team */
        foreach ($teams as $team) {
            $registration = $team->registration;
            $base = [
                'kode_tim' => $team->code,
                'nama_tim' => $team->name,
                'email_tim' => $team->email,
                'telepon_tim' => $team->phone,
                'institusi' => $team->institution_name,
                'alamat_institusi' => $team->institution_address,
                'kompetisi' => $registration?->competition?->name,
                'batch' => $registration === null ? null : ($registration->batch?->name ?? 'Belum ditentukan'),
                'tahap' => $team->currentStage?->name,
                'status_tim' => ExportLabels::status($team->status),
                'status_registrasi' => ExportLabels::status($registration?->status?->value),
                'tanggal_daftar' => $team->created_at,
                'tanggal_submit' => $registration?->submitted_at,
            ];

            if ($team->members->isEmpty()) {
                yield $base;

                continue;
            }

            foreach ($team->members as $member) {
                yield $base + [
                    'nama_anggota' => $member->name,
                    'peran_anggota' => $member->role === 'LEADER' ? 'Ketua' : 'Anggota',
                    'email_anggota' => $member->email,
                    'nisn_nim' => $member->student_id,
                    'jurusan' => $member->major,
                    'fakultas' => $member->faculty,
                ];
            }
        }
    }
}
