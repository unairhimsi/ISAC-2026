<?php

namespace App\Services;

use App\Models\RegistrationStatus;
use App\Models\Stage;
use App\Models\Team;
use Illuminate\Database\Eloquent\Builder;

/**
 * The pool an admin picks from when moving BPC/BIC teams on from a stage: every team
 * that is at the stage (or already past it), optionally limited to one batch. Review
 * results are shown as information only; the admin decides who goes through.
 * AdminRegistrationService::advanceStage stays the final arbiter.
 */
class StageAdvancementService
{
    public const STATE_ELIGIBLE = 'eligible';

    public const STATE_ADVANCED = 'advanced';

    public const STATE_BLOCKED = 'blocked';

    /** Same ceiling as one admin operation (RunAdminOperationRequest). */
    private const MAX_TEAMS = 500;

    /** @return array<string, mixed> */
    public function overview(Stage $stage, ?string $batchId): array
    {
        $next = Stage::query()
            ->where('competition_id', $stage->competition_id)
            ->where('order', (int) $stage->order + 1)
            ->first();

        $pool = Team::query()
            ->whereHas('registration', fn (Builder $query) => $query
                ->where('competition_id', $stage->competition_id)
                ->when($batchId, fn (Builder $registration) => $registration->where('batch_id', $batchId)))
            ->whereHas('currentStage', fn (Builder $query) => $query
                ->where('competition_id', $stage->competition_id)
                ->where('order', '>=', $stage->order));

        $total = (clone $pool)->count();

        $teams = $pool
            ->with([
                'currentStage:id,name,order',
                'registration:id,team_id,batch_id,status',
                'registration.batch:id,name',
                'submissions' => fn ($query) => $query->where('stage_id', $stage->id)->select(['id', 'team_id', 'stage_id', 'status', 'score', 'submitted_at']),
            ])
            ->orderBy('code')
            ->limit(self::MAX_TEAMS)
            ->get()
            ->map(fn (Team $team): array => $this->row($team, $stage, $next))
            // Highest score first so the strongest teams are at the top; unscored teams keep code order.
            ->sortBy([fn (array $a, array $b) => ($b['submission']['score'] ?? -1) <=> ($a['submission']['score'] ?? -1)])
            ->values();

        return [
            'nextStage' => $next === null ? null : [
                'id' => $next->id,
                'name' => $next->name,
                'type' => $next->type,
                'order' => $next->order,
                'startDate' => $next->start_date?->toISOString(),
                'endDate' => $next->end_date?->toISOString(),
            ],
            'summary' => [
                'total' => $total,
                'eligible' => $teams->where('state', self::STATE_ELIGIBLE)->count(),
                'advanced' => $teams->where('state', self::STATE_ADVANCED)->count(),
                'blocked' => $teams->where('state', self::STATE_BLOCKED)->count(),
            ],
            'truncated' => $total > self::MAX_TEAMS,
            'teams' => $teams->all(),
        ];
    }

    /** @return array<string, mixed> */
    private function row(Team $team, Stage $stage, ?Stage $next): array
    {
        [$state, $reason] = $this->classify($team, $stage, $next);
        $submission = $team->submissions->first();

        return [
            'team' => [
                'id' => $team->id,
                'code' => $team->code,
                'name' => $team->name,
                'email' => $team->email,
            ],
            'batch' => $team->registration?->batch === null ? null : [
                'id' => $team->registration->batch->id,
                'name' => $team->registration->batch->name,
            ],
            'currentStage' => $team->currentStage === null ? null : [
                'id' => $team->currentStage->id,
                'name' => $team->currentStage->name,
                'order' => $team->currentStage->order,
            ],
            'submission' => $submission === null ? null : [
                'id' => $submission->id,
                'status' => $submission->status,
                'score' => $submission->score,
                'submittedAt' => $submission->submitted_at?->toISOString(),
            ],
            'state' => $state,
            'reason' => $reason,
        ];
    }

    /** @return array{0: string, 1: string|null} */
    private function classify(Team $team, Stage $stage, ?Stage $next): array
    {
        $current = $team->currentStage;

        if ($next !== null && $current !== null && (int) $current->order >= (int) $next->order) {
            return [self::STATE_ADVANCED, null];
        }
        if ($next === null) {
            return [self::STATE_BLOCKED, 'Tidak ada tahap berikutnya.'];
        }
        if ($team->status !== Team::STATUS_VERIFIED) {
            return [self::STATE_BLOCKED, 'Tim belum terverifikasi.'];
        }
        if ($team->registration?->status !== RegistrationStatus::VERIFIED) {
            return [self::STATE_BLOCKED, 'Pembayaran belum terverifikasi.'];
        }
        if ($team->current_stage_id !== $stage->id) {
            return [self::STATE_BLOCKED, 'Tim tidak berada di tahap ini.'];
        }

        return [self::STATE_ELIGIBLE, null];
    }
}
