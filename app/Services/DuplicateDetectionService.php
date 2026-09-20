<?php

namespace App\Services;

use App\Models\Member;
use App\Models\Team;
use App\Services\Mail\TransactionalMailService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Cross-team / cross-account duplicate detection.
 *
 * Member.email and Member.student_id are unique only inside a single team
 * (via Laravel's `distinct` rule). This service widens the check so the
 * same person cannot be enrolled in two different teams for the same
 * competition batch — which would let one student bypass the per-team
 * limit on submissions and exam attempts.
 *
 * It also dispatches a notification to the existing team so the admin
 * and the other team leader both become aware of the conflict.
 */
class DuplicateDetectionService
{
    public function __construct(
        private readonly TransactionalMailService $mail,
    ) {}

    /**
     * @param  array<int, array<string, mixed>>  $incomingMembers
     * @return array{email: array<string, array<int, array{team_id: string, team_code: string, team_name: string}>>, student_id: array<string, array<int, array{team_id: string, team_code: string, team_name: string}>>>}
     */
    public function findMemberDuplicates(Team $team, array $incomingMembers): array
    {
        $emails = [];
        $studentIds = [];
        $excludeIds = [];

        foreach ($incomingMembers as $payload) {
            if (! empty($payload['email'])) {
                $emails[strtolower(trim((string) $payload['email']))] = true;
            }
            if (! empty($payload['student_id'])) {
                $studentIds[Str::upper(trim((string) $payload['student_id']))] = true;
            }
            if (! empty($payload['id'])) {
                $excludeIds[] = $payload['id'];
            }
        }

        $emailDuplicates = [];
        $studentIdDuplicates = [];

        if ($emails !== []) {
            $rows = Member::query()
                ->where('team_id', '!=', $team->id)
                ->whereIn(DB::raw('LOWER(email)'), array_keys($emails))
                ->whereNotIn('id', $excludeIds === [] ? [''] : $excludeIds)
                ->with('team:id,code,name')
                ->get();

            foreach ($rows as $row) {
                $emailDuplicates[strtolower($row->email)][] = [
                    'team_id' => $row->team_id,
                    'team_code' => $row->team?->code ?? '-',
                    'team_name' => $row->team?->name ?? '-',
                ];
            }
        }

        if ($studentIds !== []) {
            $rows = Member::query()
                ->where('team_id', '!=', $team->id)
                ->whereIn(DB::raw('UPPER(student_id)'), array_keys($studentIds))
                ->whereNotIn('id', $excludeIds === [] ? [''] : $excludeIds)
                ->with('team:id,code,name')
                ->get();

            foreach ($rows as $row) {
                $studentIdDuplicates[Str::upper($row->student_id)][] = [
                    'team_id' => $row->team_id,
                    'team_code' => $row->team?->code ?? '-',
                    'team_name' => $row->team?->name ?? '-',
                ];
            }
        }

        return [
            'email' => $emailDuplicates,
            'student_id' => $studentIdDuplicates,
        ];
    }

    /**
     * Detect a Team email colliding with an Admin email (or vice versa).
     *
     * Returns the existing accounts so the caller can notify the owner.
     *
     * @return array{team: ?Team, admin: ?Admin}
     */
    public function findAmbiguousAccount(string $email): array
    {
        $normalized = strtolower(trim($email));
        if ($normalized === '') {
            return ['team' => null, 'admin' => null];
        }

        return [
            'team' => Team::query()->where('email', $normalized)->first(),
            'admin' => \App\Models\Admin::query()->where('email', $normalized)->first(),
        ];
    }

    /**
     * Send notification to the existing teams that hold a duplicate member.
     *
     * Best-effort — failures are swallowed so the registration flow is
     * not blocked by mail transport issues.
     *
     * @param  array<int, array{team_id: string, team_code: string, team_name: string}>  $existingTeams
     */
    public function notifyExistingTeamOfDuplicate(
        Team $existingTeam,
        Team $incomingTeam,
        string $conflictKind,
        string $conflictValue,
    ): void {
        try {
            $this->mail->sendDuplicateMemberWarning(
                recipientEmail: $existingTeam->email,
                existingTeamCode: $existingTeam->code,
                existingTeamName: $existingTeam->name,
                incomingTeamCode: $incomingTeam->code,
                incomingTeamName: $incomingTeam->name,
                conflictKind: $conflictKind,
                conflictValue: $conflictValue,
            );
        } catch (\Throwable $exception) {
            report($exception);
        }
    }

    /**
     * Notify the holder of a Team or Admin account when the same email
     * is being used by the other principal type (cross-table collision).
     */
    public function notifyAmbiguousAccount(string $email): void
    {
        $normalized = strtolower(trim($email));
        if ($normalized === '') {
            return;
        }

        try {
            $this->mail->sendAmbiguousAccountWarning($normalized);
        } catch (\Throwable $exception) {
            report($exception);
        }
    }
}
