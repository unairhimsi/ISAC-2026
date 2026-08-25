<?php

namespace App\Services;

use App\Models\Competition;
use App\Models\ExamAttempt;
use App\Models\Registration;
use App\Models\Stage;
use App\Models\Submission;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class AdminStageService
{
    /** @return Collection<int, Stage> */
    public function list(?string $competitionId = null): Collection
    {
        return Stage::query()
            ->with('competition:id,name,type')
            ->withCount(['exams', 'submissions', 'teams'])
            ->when($competitionId, fn ($query) => $query->where('competition_id', $competitionId))
            ->orderBy('competition_id')
            ->orderBy('order')
            ->get();
    }

    public function detail(Stage $stage): Stage
    {
        return $stage->load('competition:id,name,type')->loadCount(['exams', 'submissions', 'teams']);
    }

    /** @param array<string, mixed> $data */
    public function create(array $data): Stage
    {
        return DB::transaction(fn (): Stage => $this->detail(Stage::query()->create($data)));
    }

    /** @param array<string, mixed> $data */
    public function update(Stage $stage, array $data): Stage
    {
        return DB::transaction(function () use ($stage, $data): Stage {
            $stage->update($data);

            return $this->detail($stage->fresh());
        });
    }

    public function delete(Stage $stage): void
    {
        DB::transaction(function () use ($stage): void {
            $stage = Stage::query()->lockForUpdate()->findOrFail($stage->id);
            $isInUse = $stage->exams()->exists()
                || $stage->submissions()->exists()
                || $stage->teams()->exists()
                || Registration::query()->where('payment_for_stage_id', $stage->id)->exists();

            if ($isInUse) {
                throw ValidationException::withMessages([
                    'stage' => ['Tahap yang sudah memiliki ujian, pengumpulan, tim, atau checkpoint pembayaran tidak dapat dihapus.'],
                ]);
            }

            $stage->delete();
        });
    }

    /**
     * Per-team scores for one stage, adaptive to the competition mode:
     * OLIMPIADE aggregates finished exam attempts, other competition types
     * read the reviewed submission score for the stage.
     *
     * @return array<string, mixed>
     */
    public function scores(Stage $stage): array
    {
        $stage->loadMissing('competition:id,type');
        $isExamMode = $stage->competition?->type === Competition::TYPE_OLIMPIADE;

        return [
            'mode' => $isExamMode ? 'exam' : 'submission',
            'stage' => [
                'id' => $stage->id,
                'name' => $stage->name,
                'order' => $stage->order,
                'type' => $stage->type,
            ],
            'scores' => $isExamMode
                ? $this->examScores($stage)
                : $this->submissionScores($stage),
        ];
    }

    /** @return list<array<string, mixed>> */
    private function examScores(Stage $stage): array
    {
        return ExamAttempt::query()
            ->select(['team_id', 'total_score', 'max_possible_score', 'finished', 'flagged'])
            ->whereHas('exam', fn ($query) => $query->where('stage_id', $stage->id))
            ->get()
            ->groupBy('team_id')
            ->map(fn ($attempts, $teamId): array => $this->examScoreEntry($teamId, $attempts))
            ->values()
            ->all();
    }

    /**
     * @param  Collection<int, ExamAttempt>  $attempts
     * @return array<string, mixed>
     */
    private function examScoreEntry(string $teamId, Collection $attempts): array
    {
        $finished = $attempts->where('finished', true)->values();

        return [
            'teamId' => $teamId,
            'score' => $finished->isNotEmpty() ? (int) $finished->sum('total_score') : null,
            'maxScore' => $finished->isNotEmpty() ? (int) $finished->sum('max_possible_score') : null,
            'finishedAttempts' => $finished->count(),
            'attemptCount' => $attempts->count(),
            'flagged' => $attempts->contains(fn (ExamAttempt $attempt): bool => (bool) $attempt->flagged),
        ];
    }

    /** @return list<array<string, mixed>> */
    private function submissionScores(Stage $stage): array
    {
        return Submission::query()
            ->select(['team_id', 'score', 'status'])
            ->where('stage_id', $stage->id)
            ->orderBy('submitted_at')
            ->get()
            ->groupBy('team_id')
            ->map(fn (Collection $submissions, string $teamId): array => [
                'teamId' => $teamId,
                'score' => $submissions->last()?->score,
                'submissionStatus' => $submissions->last()?->status,
            ])
            ->values()
            ->all();
    }
}
