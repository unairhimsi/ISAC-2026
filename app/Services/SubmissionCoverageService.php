<?php

namespace App\Services;

use App\Models\Competition;
use App\Models\RegistrationStatus;
use App\Models\Stage;
use App\Models\Team;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Pagination\LengthAwarePaginator;

/**
 * Which verified BPC/BIC teams still owe a submission for a stage.
 *
 * A team is "missing" when it has no submission for the stage, or only a
 * draft (never submitted, or withdrawn back to draft). Submissions already
 * sent, under review, reviewed or sent back for revision all count as
 * submitted because the team has done its part.
 */
class SubmissionCoverageService
{
    public const STATE_NOT_STARTED = 'not_started';

    public const STATE_DRAFT = 'draft';

    public static function supports(Stage $stage): bool
    {
        $stage->loadMissing('competition:id,type');

        return in_array($stage->competition?->type, [Competition::TYPE_BUSINESS_PLAN, Competition::TYPE_BUSINESS_IT_CASE], true);
    }

    /** @return array{expected: int, submitted: int, missing: int, notStarted: int, draft: int} */
    public function summary(Stage $stage): array
    {
        $expected = $this->expectedTeams($stage)->count();
        $missing = $this->missingTeams($stage)->count();
        $notStarted = $this->missingTeams($stage)->whereDoesntHave('submissions', fn (Builder $query) => $query->where('stage_id', $stage->id))->count();

        return [
            'expected' => $expected,
            'submitted' => $expected - $missing,
            'missing' => $missing,
            'notStarted' => $notStarted,
            'draft' => $missing - $notStarted,
        ];
    }

    public function missing(Stage $stage, ?string $search, ?string $state, int $perPage): LengthAwarePaginator
    {
        return $this->missingTeams($stage)
            ->when($state === self::STATE_NOT_STARTED, fn (Builder $query) => $query->whereDoesntHave('submissions', fn (Builder $submissions) => $submissions->where('stage_id', $stage->id)))
            ->when($state === self::STATE_DRAFT, fn (Builder $query) => $query->whereHas('submissions', fn (Builder $submissions) => $submissions->where('stage_id', $stage->id)))
            ->when($search !== null && $search !== '', function (Builder $query) use ($search): void {
                $like = "%{$search}%";
                $query->where(fn (Builder $team) => $team->where('teams.code', 'like', $like)->orWhere('teams.name', 'like', $like)->orWhere('teams.email', 'like', $like));
            })
            ->with([
                'currentStage:id,name,order',
                'submissions' => fn ($query) => $query->where('stage_id', $stage->id)->with('file:id,url'),
            ])
            ->orderBy('teams.code')
            ->paginate($perPage);
    }

    /**
     * Verified teams of the stage's competition that have reached the stage
     * (current stage at or past it), the only ones expected to have delivered.
     *
     * @return Builder<Team>
     */
    private function expectedTeams(Stage $stage): Builder
    {
        return Team::query()
            ->where('teams.status', Team::STATUS_VERIFIED)
            ->whereHas('registration', fn (Builder $query) => $query
                ->where('competition_id', $stage->competition_id)
                ->where('status', RegistrationStatus::VERIFIED))
            ->whereHas('currentStage', fn (Builder $query) => $query
                ->where('competition_id', $stage->competition_id)
                ->where('order', '>=', $stage->order));
    }

    /** @return Builder<Team> */
    private function missingTeams(Stage $stage): Builder
    {
        return $this->expectedTeams($stage)->whereDoesntHave('submissions', fn (Builder $query) => $query
            ->where('stage_id', $stage->id)
            ->where('status', '!=', 'draft'));
    }
}
