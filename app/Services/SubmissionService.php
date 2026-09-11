<?php

namespace App\Services;

use App\Models\Competition;
use App\Models\File;
use App\Models\Stage;
use App\Models\Submission;
use App\Models\Team;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class SubmissionService
{
    public function upsertDraft(Team $team, Stage $stage, array $data): Submission
    {
        $this->assertCanAccess($team, $stage);
        $this->assertWindowOpen($stage);

        $fileId = $data['file_id'] ?? $data['fileId'] ?? null;
        if ($fileId !== null && $fileId !== '') {
            $this->assertOwnedFile($team, $fileId);
        } else {
            $fileId = null;
        }

        return DB::transaction(function () use ($team, $stage, $data, $fileId): Submission {
            $submission = Submission::where('team_id', $team->id)
                ->where('stage_id', $stage->id)
                ->lockForUpdate()
                ->first();

            if ($submission !== null && ! in_array($submission->status, ['draft', 'revision_requested', 'rejected'], true)) {
                throw ValidationException::withMessages(['submission' => ['Sudah terkumpul, tidak dapat diubah.']]);
            }

            if ($submission === null) {
                $submission = Submission::create([
                    'id' => (string) Str::uuid(),
                    'team_id' => $team->id,
                    'stage_id' => $stage->id,
                    'title' => $data['title'],
                    'description' => $data['description'] ?? null,
                    'file_id' => $fileId,
                    'status' => 'draft',
                    'metadata' => ['version' => 1],
                ]);
            } else {
                $metadata = $submission->metadata ?? [];
                $metadata['version'] = (int) ($metadata['version'] ?? 1) + 1;
                $submission->update([
                    'title' => $data['title'],
                    'description' => $data['description'] ?? $submission->description,
                    'file_id' => $fileId ?? $submission->file_id,
                    'metadata' => $metadata,
                ]);
            }

            return $submission->fresh()->load('file');
        });
    }

    public function submit(Team $team, Stage $stage, ?string $idempotencyKey = null): Submission
    {
        $this->assertCanAccess($team, $stage);
        $this->assertWindowOpen($stage);

        if ($idempotencyKey !== null && $idempotencyKey !== '') {
            $cacheKey = 'submission:submit:' . $team->id . ':' . $stage->id . ':' . $idempotencyKey;
            $cachedId = Cache::get($cacheKey);
            if ($cachedId !== null) {
                $cached = Submission::where('id', $cachedId)->with('file')->first();
                if ($cached !== null && $cached->team_id === $team->id && $cached->stage_id === $stage->id) {
                    return $cached;
                }
            }
        }

        return DB::transaction(function () use ($team, $stage, $idempotencyKey): Submission {
            $submission = Submission::where('team_id', $team->id)
                ->where('stage_id', $stage->id)
                ->lockForUpdate()
                ->first();

            if ($submission === null) {
                throw ValidationException::withMessages(['file_id' => ['File wajib diunggah sebelum mengumpulkan.']]);
            }

            if ($submission->file_id === null) {
                throw ValidationException::withMessages(['file_id' => ['File wajib diunggah sebelum mengumpulkan.']]);
            }

            if (! in_array($submission->status, ['draft', 'revision_requested', 'rejected'], true)) {
                throw ValidationException::withMessages(['submission' => ['Sudah terkumpul.']]);
            }

            $metadata = $submission->metadata ?? [];
            $metadata['submittedCount'] = (int) ($metadata['submittedCount'] ?? 0) + 1;
            $metadata['lastSubmittedAt'] = now()->toISOString();

            $submission->update([
                'status' => 'submitted',
                'submitted_at' => now(),
                'metadata' => $metadata,
            ]);

            $fresh = $submission->fresh()->load('file');

            if ($idempotencyKey !== null && $idempotencyKey !== '') {
                $cacheKey = 'submission:submit:' . $team->id . ':' . $stage->id . ':' . $idempotencyKey;
                Cache::put($cacheKey, $fresh->id, 300);
            }

            return $fresh;
        });
    }

    public function unsubmit(Team $team, Stage $stage): Submission
    {
        $this->assertCanAccess($team, $stage);
        $this->assertWindowOpen($stage);

        return DB::transaction(function () use ($team, $stage): Submission {
            $submission = Submission::where('team_id', $team->id)
                ->where('stage_id', $stage->id)
                ->lockForUpdate()
                ->firstOrFail();

            if ($submission->status !== 'submitted') {
                throw ValidationException::withMessages(['submission' => ['Hanya submission yang sudah terkumpul dapat ditarik.']]);
            }

            if ($submission->reviewed_at !== null) {
                throw ValidationException::withMessages(['submission' => ['Tidak dapat menarik submission yang sudah dinilai.']]);
            }

            $submission->update([
                'status' => 'draft',
            ]);

            return $submission->fresh()->load('file');
        });
    }

    private function assertCanAccess(Team $team, Stage $stage): void
    {
        $team->loadMissing('registration.competition', 'currentStage');
        $registration = $team->registration;

        $isBusiness = $registration !== null && in_array($registration->competition->type, [Competition::TYPE_BUSINESS_PLAN, Competition::TYPE_BUSINESS_IT_CASE], true);
        $isCurrentStage = $team->current_stage_id === $stage->id;
        $sameCompetition = $registration !== null && $stage->competition_id === $registration->competition_id;

        if (! $isBusiness || ! $isCurrentStage || ! $sameCompetition) {
            abort(403, 'Tahap tidak tersedia untuk Team ini.');
        }
    }

    private function assertWindowOpen(Stage $stage): void
    {
        $now = now();
        $start = $stage->start_date;
        $end = $stage->end_date;

        if ($start !== null && $now->lt($start)) {
            throw ValidationException::withMessages(['window' => ['Periode pengumpulan belum dibuka.']]);
        }

        if ($end !== null && $now->gt($end)) {
            throw ValidationException::withMessages(['window' => ['Periode pengumpulan telah berakhir.']]);
        }
    }

    private function assertOwnedFile(Team $team, string $fileId): File
    {
        $file = File::where('id', $fileId)->first();

        if ($file === null || $file->uploaded_by !== $team->id || $file->purpose !== 'SUBMISSION') {
            throw ValidationException::withMessages(['file_id' => ['File tidak valid atau bukan milik Team ini.']]);
        }

        return $file;
    }
}
