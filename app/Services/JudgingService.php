<?php

namespace App\Services;

use App\Models\Admin;
use App\Models\AdminAuditLog;
use App\Models\Submission;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class JudgingService
{
    public function review(Admin $admin, Submission $submission, array $data, ?string $requestId = null): Submission
    {
        return DB::transaction(function () use ($admin, $submission, $data, $requestId): Submission {
            $locked = Submission::where('id', $submission->id)->lockForUpdate()->firstOrFail();
            $action = $data['action'];
            $current = $locked->status;
            $this->assertTransition($current, $action, $admin);

            $before = $locked->toArray();

            $locked->update([
                'status' => $action,
                'score' => $data['score'] ?? null,
                'feedback' => $data['feedback'] ?? null,
                'reviewed_by' => $admin->id,
                'reviewed_at' => now(),
            ]);

            $fresh = $locked->fresh()->load(['team', 'file', 'stage', 'reviewedBy']);

            AdminAuditLog::query()->create([
                'admin_id' => $admin->id,
                'action' => 'judging.review',
                'subject_type' => Submission::class,
                'subject_id' => $fresh->id,
                'before_data' => $before,
                'after_data' => $fresh->toArray(),
                'reason' => $data['feedback'] ?? null,
                'request_id' => $requestId,
                'created_at' => now(),
            ]);

            return $fresh;
        });
    }

    private function assertTransition(string $current, string $action, Admin $admin): void
    {
        if ($action === 'under_review') {
            return;
        }

        if ($action === 'approved') {
            if (! in_array($current, ['submitted', 'under_review'], true)) {
                throw ValidationException::withMessages(['status' => ['Transisi status tidak valid.']]);
            }
            return;
        }

        if (in_array($action, ['rejected', 'revision_requested'], true)) {
            if (in_array($current, ['submitted', 'under_review'], true)) {
                return;
            }
            if ($current === 'approved' && $action === 'revision_requested') {
                return;
            }
            throw ValidationException::withMessages(['status' => ['Transisi status tidak valid.']]);
        }

        throw ValidationException::withMessages(['status' => ['Transisi status tidak valid.']]);
    }
}
