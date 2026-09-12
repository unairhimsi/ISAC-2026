<?php

namespace Database\Seeders;

use App\Models\Batch;
use App\Models\BatchStatus;
use App\Models\Competition;
use App\Models\Exam;
use App\Models\Stage;
use Carbon\CarbonImmutable;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class Isac2026TimelineSeeder extends Seeder
{
    private const TIMEZONE = 'Asia/Jakarta';

    public function run(): void
    {
        DB::transaction(function (): void {
            $competitions = [
                'iso' => $this->upsertCompetition([
                    'name' => 'IS Olympiad',
                    'slug' => 'is-olympiad',
                    'description' => 'Information System Olympiad (ISO) ISAC 2026 adalah ajang olimpiade tingkat nasional yang menantang siswa/i SMA/SMK/sederajat untuk menguji dan memperdalam wawasan di persimpangan Teknologi Informasi dan Bisnis. Bukan sekadar soal hafalan teori, ISO menguji logika algoritmik dan kejelian melihat bagaimana teknologi menjadi fondasi operasional bisnis modern — membentuk kerangka berpikir analitis yang krusial bagi talenta muda ekosistem digital masa depan. Berkompetisi secara individu melalui rangkaian Elimination, Semifinal, hingga Final & STA Awarding, para juara terbaik akan memperebutkan total hadiah hingga Rp4.500.000. Jadikan ISO 2026 batu loncatan pertamamu untuk unjuk gigi di kancah kompetisi Sistem Informasi tingkat nasional.',
                    'type' => Competition::TYPE_OLIMPIADE,
                    'payment_flow' => Competition::PAYMENT_UPFRONT,
                ]),
                'bpc' => $this->upsertCompetition([
                    'name' => 'Business Plan Competition',
                    'slug' => 'business-plan-competition',
                    'description' => 'Business Plan Competition (BPC) ISAC 2026 adalah wadah strategis bagi siswa/i SMA/SMK/sederajat untuk mengasah insting kewirausahaan, inovasi, dan kemampuan perancangan bisnis sejak dini. Berkompetisi dalam tim beranggotakan 3 orang, peserta ditantang merumuskan ide bisnis di bidang IT yang realistis, komprehensif, berkelanjutan, serta punya nilai ekonomi dan dampak sosial positif — mulai dari identifikasi peluang dan analisis pasar, hingga penyusunan strategi pemasaran dan keuangan. Melalui tahapan Preliminary, Semifinal, hingga Final & Awarding, tim terbaik akan memperebutkan total hadiah hingga Rp4.500.000, sekaligus membangun portofolio kewirausahaan kompetitif sebagai bekal menuju pendidikan tinggi dan kompetisi tingkat lanjut.',
                    'type' => Competition::TYPE_BUSINESS_PLAN,
                    'payment_flow' => Competition::PAYMENT_SEMIFINAL,
                ]),
                'bic' => $this->upsertCompetition([
                    'name' => 'Business IT Case Competition',
                    'slug' => 'business-it-case-competition',
                    'description' => 'Business IT Case Competition (BIC) ISAC 2026 hadir di tengah dinamika ekosistem bisnis yang makin kompleks, menguji ketajaman analitis mahasiswa aktif dalam membedah business case nyata dari sebuah perusahaan. Berkompetisi dalam tim beranggotakan 3 orang, peserta merumuskan solusi strategis yang mengintegrasikan teknologi, pemrosesan data, dan inovasi bisnis untuk permasalahan industri yang sesungguhnya. Melalui rangkaian Preliminary, Semifinal, hingga Final Presentation, BIC mempersiapkan calon pemimpin masa depan untuk beradaptasi, mengambil keputusan presisi, dan menciptakan nilai tambah bagi industri — memperebutkan total hadiah tertinggi di ISAC 2026, mencapai Rp6.000.000.',
                    'type' => Competition::TYPE_BUSINESS_IT_CASE,
                    'payment_flow' => Competition::PAYMENT_SEMIFINAL,
                ]),
            ];

            $prices = [
                'iso' => [60000, 80000],
                'bpc' => [70000, 90000],
                'bic' => [80000, 100000],
            ];

            foreach ($competitions as $key => $competition) {
                $this->upsertBatch($competition, 1, '2026-08-26', '2026-09-20', $prices[$key][0]);
                $this->upsertBatch($competition, 2, '2026-09-21', '2026-10-14', $prices[$key][1]);
            }

            $this->seedOlympiadTimeline($competitions['iso']);
            $this->seedBusinessPlanTimeline($competitions['bpc']);
            $this->seedBusinessItCaseTimeline($competitions['bic']);
        });
    }

    /** @param array<string, string> $data */
    private function upsertCompetition(array $data): Competition
    {
        $competition = Competition::withTrashed()->firstOrNew(['slug' => $data['slug']]);
        if ($competition->trashed()) {
            $competition->restore();
        }

        $competition->fill([
            ...$data,
            'start_date' => '2026-08-26',
            'end_date' => '2026-11-22',
            'status' => Competition::STATUS_REGISTRATION_OPEN,
        ])->save();

        return $competition;
    }

    private function upsertBatch(Competition $competition, int $number, string $start, string $end, int $price): Batch
    {
        $batch = Batch::withTrashed()->firstOrNew([
            'competition_id' => $competition->id,
            'slug' => "batch-{$number}",
        ]);
        if ($batch->trashed()) {
            $batch->restore();
        }

        $batch->fill([
            'name' => "Batch {$number}",
            'description' => "Gelombang {$number} pendaftaran {$competition->name} ISAC 2026.",
            // The official source is date-only. These boundaries are technical
            // representations, not official event times.
            'start_date' => $this->startOfDay($start),
            'end_date' => $this->endOfDay($end),
            'price' => $price,
            'status' => BatchStatus::OPEN,
        ])->save();

        return $batch;
    }

    private function seedOlympiadTimeline(Competition $competition): void
    {
        // Official 2026 timeline per competition-specific table:
        // Try Out 16-23 Okt, Penyisihan 25 Okt, Semifinal 7 Nov, Final 22 Nov.
        // TM dates (15 Okt, 14 Nov) and announcements (28 Okt, 9 Nov) are administrative
        // and not modeled as progression Stages.
        $tryout = $this->upsertStage($competition, [
            'name' => 'Tryout',
            'type' => 'exam',
            'description' => 'Try Out Olimpiade ISAC 2026 — simulasi pengerjaan soal sebelum penyisihan.',
            'order' => 1,
            'start' => '2026-10-16',
            'end' => '2026-10-23',
        ]);
        $elimination = $this->upsertStage($competition, [
            'name' => 'Elimination',
            'type' => 'exam',
            'description' => 'Penyisihan Olimpiade ISAC 2026. Pengumuman semifinal tercatat pada 28 Oktober 2026 dan tidak dimodelkan sebagai Stage terpisah.',
            'order' => 2,
            'start' => '2026-10-25',
            'end' => '2026-10-25',
        ]);
        $semifinal = $this->upsertStage($competition, [
            'name' => 'Semifinal',
            'type' => 'exam',
            'description' => 'Semifinal Olimpiade ISAC 2026. Pengumuman final tercatat pada 9 November 2026 dan tidak dimodelkan sebagai Stage terpisah.',
            'order' => 3,
            'start' => '2026-11-07',
            'end' => '2026-11-07',
        ]);
        $final = $this->upsertStage($competition, [
            'name' => 'Final',
            'type' => 'final',
            'description' => 'Final Olimpiade dan Awarding ISAC 2026.',
            'order' => 4,
            'start' => '2026-11-22',
            'end' => '2026-11-22',
        ]);

        // Duration and max attempts are intentionally omitted. The database
        // applies its existing technical defaults because the source gives no values.
        // Exam type: tryout for Tryout stage, OLIMPIADE for competitive exams.
        $this->upsertExam($tryout, 'Tryout Olimpiade', 'Try Out Olimpiade ISAC 2026.', '2026-10-16', '2026-10-23', 'tryout');
        $this->upsertExam($elimination, 'Ujian Eliminasi', 'Ujian Penyisihan Olimpiade ISAC 2026.', '2026-10-25', '2026-10-25', 'OLIMPIADE');
        $this->upsertExam($semifinal, 'Ujian Semifinal', 'Ujian Semifinal Olimpiade ISAC 2026.', '2026-11-07', '2026-11-07', 'OLIMPIADE');
        $this->upsertExam($final, 'Ujian Final', 'Ujian Final Olimpiade ISAC 2026.', '2026-11-22', '2026-11-22', 'OLIMPIADE');
    }

    private function seedBusinessPlanTimeline(Competition $competition): void
    {
        // Official BPC timeline: Preliminary 16-23 Okt, Semifinal 27 Okt-10 Nov, Final 22 Nov.
        // TM (15 Okt, 27 Okt, 15 Nov), Penjurian (24-26 Okt, 11-13 Nov) and announcements (26 Okt, 14 Nov)
        // are administrative/judging periods not modeled as Team Stages.
        $this->upsertStage($competition, [
            'name' => 'Preliminary',
            'type' => 'submission',
            'description' => 'Preliminary Business Plan Competition — submission Business Model Canvas. Periode penjurian 24–26 Oktober tidak dimodelkan sebagai Team Stage.',
            'order' => 1,
            'start' => '2026-10-16',
            'end' => '2026-10-23',
        ]);
        $this->upsertStage($competition, [
            'name' => 'Semifinal',
            'type' => 'submission',
            'description' => 'Tahap Semifinal Business Plan Competition (27 Okt–10 Nov) dan target payment checkpoint existing. Penjurian final 11–13 November tidak dimodelkan sebagai Team Stage.',
            'order' => 2,
            'start' => '2026-10-27',
            'end' => '2026-11-10',
        ]);
        $this->upsertStage($competition, [
            'name' => 'Final',
            'type' => 'final',
            'description' => 'Final Business Plan Competition pada 22 November 2026. TM Final 15 November adalah administratif dan tidak dimodelkan sebagai Stage terpisah.',
            'order' => 3,
            'start' => '2026-11-22',
            'end' => '2026-11-22',
        ]);
    }

    private function seedBusinessItCaseTimeline(Competition $competition): void
    {
        // Official BIC timeline (identik BPC): Preliminary 16-23 Okt, Semifinal 27 Okt-10 Nov, Final 22 Nov.
        // TM (15 Okt, 27 Okt, 15 Nov), Penjurian (24-26 Okt, 11-13 Nov) and announcements (26 Okt, 14 Nov)
        // are administrative/judging not modeled as Stages.
        $this->upsertStage($competition, [
            'name' => 'Preliminary',
            'type' => 'submission',
            'description' => 'Preliminary Business IT Case — Case Release dan Preliminary Submission. Periode penjurian 24–26 Oktober tidak dimodelkan sebagai Team Stage.',
            'order' => 1,
            'start' => '2026-10-16',
            'end' => '2026-10-23',
        ]);
        $this->upsertStage($competition, [
            'name' => 'Semifinal',
            'type' => 'selection',
            'description' => 'Tahap Semifinal Business IT Case (27 Okt–10 Nov) — payment checkpoint untuk payment_flow SEMIFINAL. Penjurian final 11–13 November tidak dimodelkan sebagai Team Stage.',
            'order' => 2,
            'start' => '2026-10-27',
            'end' => '2026-11-10',
        ]);
        $this->upsertStage($competition, [
            'name' => 'Final',
            'type' => 'final',
            'description' => 'Final Presentation Business IT Case ISAC 2026 pada 22 November 2026. TM Final 15 November adalah administratif.',
            'order' => 3,
            'start' => '2026-11-22',
            'end' => '2026-11-22',
        ]);
    }

    private function removeStage(Competition $competition, string $name): void
    {
        $stage = Stage::where('competition_id', $competition->id)
            ->where('name', $name)
            ->first();

        if ($stage === null) {
            return;
        }

        Exam::where('stage_id', $stage->id)->delete();
        $stage->delete();
    }

    /** @param array{name: string, type: string, description: string, order: int, start: string, end: string} $data */
    private function upsertStage(Competition $competition, array $data): Stage
    {
        $stage = Stage::withTrashed()->firstOrNew([
            'competition_id' => $competition->id,
            'name' => $data['name'],
        ]);
        if ($stage->trashed()) {
            $stage->restore();
        }

        $stage->fill([
            'type' => $data['type'],
            'description' => $data['description'],
            'order' => $data['order'],
            'start_date' => $this->startOfDay($data['start']),
            'end_date' => $this->endOfDay($data['end']),
            // In the current service this flag means eligible for progression;
            // the first active ordered Stage becomes a verified Team's entry Stage.
            'is_active' => true,
        ])->save();

        return $stage;
    }

    private function upsertExam(Stage $stage, string $title, string $description, string $start, string $end, string $type = 'multiple_choice'): Exam
    {
        $exam = Exam::withTrashed()->firstOrNew([
            'stage_id' => $stage->id,
            'title' => $title,
        ]);
        if ($exam->trashed()) {
            $exam->restore();
        }
        if (! $exam->exists) {
            // UUID is assigned only on first creation; natural keys above drive idempotency.
            $exam->id = (string) Str::uuid();
        }

        $exam->fill([
            'description' => $description,
            'start_date' => $this->startOfDay($start),
            'end_date' => $this->endOfDay($end),
            'type' => $type,
        ])->save();

        return $exam;
    }

    private function startOfDay(string $date): CarbonImmutable
    {
        return CarbonImmutable::parse($date, self::TIMEZONE)->startOfDay();
    }

    private function endOfDay(string $date): CarbonImmutable
    {
        return CarbonImmutable::parse($date, self::TIMEZONE)->endOfDay();
    }
}
