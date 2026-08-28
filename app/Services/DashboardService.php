<?php

namespace App\Services;

use App\Models\Competition;
use App\Models\Exam;
use App\Models\RegistrationStatus;
use App\Models\Stage;
use App\Models\Team;
use Illuminate\Auth\Access\AuthorizationException;

class DashboardService
{
    public function getSummary(Team $team): Team
    {
        return $team->load([
            'members',
            'registration.competition',
            'registration.batch',
            'registration.paymentProofFile',
            'registration.paymentForStage',
            'currentStage.exams' => fn ($query) => $query
                ->select([
                    'id', 'stage_id', 'title', 'description', 'start_date',
                    'end_date', 'duration', 'max_attempts',
                ])
                ->orderBy('start_date'),
        ]);
    }

    /** @return array<string, mixed> */
    public function getExamShell(Team $team, Exam $exam): array
    {
        $team->loadMissing('registration.competition', 'registration.batch', 'currentStage');
        $exam->loadMissing('stage');

        $registration = $team->registration;
        $canAccess = $registration !== null
            && $registration->competition->type === Competition::TYPE_OLIMPIADE
            && $exam->stage->competition_id === $registration->competition_id
            && $team->current_stage_id === $exam->stage_id;

        if (! $canAccess) {
            throw new AuthorizationException('Ujian tidak tersedia untuk tahap Team ini.');
        }

        return [
            'exam' => $this->examMetadata($exam),
            'stage' => $this->stageMetadata($exam->stage),
            'competition' => [
                'id' => $registration->competition->id,
                'name' => $registration->competition->name,
                'type' => $registration->competition->type,
            ],
            'batch' => [
                'id' => $registration->batch->id,
                'name' => $registration->batch->name,
                'price' => (float) $registration->batch->price,
            ],
        ];
    }

    /** @return array<string, mixed> */
    public function getSubmissionShell(Team $team, Stage $stage): array
    {
        $team->loadMissing(
            'registration.competition',
            'registration.batch',
            'currentStage',
        );

        $registration = $team->registration;
        $isBusinessCompetition = $registration !== null
            && in_array($registration->competition->type, [
                Competition::TYPE_BUSINESS_PLAN,
                Competition::TYPE_BUSINESS_IT_CASE,
            ], true);
        $isCurrentStage = $team->current_stage_id === $stage->id;

        // Direktori baru: semua lomba UPFRONT di registrasi awal, submission langsung tanpa payment gate
        $canAccess = $isBusinessCompetition
            && $stage->competition_id === $registration->competition_id
            && $isCurrentStage;

        if (! $canAccess) {
            throw new AuthorizationException('Tahap pengumpulan tidak tersedia untuk Team ini.');
        }

        $now = now();
        $start = $stage->start_date;
        $end = $stage->end_date;
        $isOpen = true;
        if ($start !== null && $now->lt($start)) {
            $isOpen = false;
        }
        if ($end !== null && $now->gt($end)) {
            $isOpen = false;
        }
        $isOverdue = $end !== null && $now->gt($end);
        $remainingMs = null;
        if ($end !== null && $isOpen) {
            $remainingMs = (int) max(0, ($end->getTimestamp() - $now->getTimestamp()) * 1000);
        }

        $submission = \App\Models\Submission::query()
            ->where('team_id', $team->id)
            ->where('stage_id', $stage->id)
            ->with('file:id,file_id,url')
            ->first();

        $canSubmit = $isOpen;

        return [
            'stage' => $this->stageMetadata($stage),
            'competition' => [
                'id' => $registration->competition->id,
                'name' => $registration->competition->name,
                'type' => $registration->competition->type,
            ],
            'batch' => [
                'id' => $registration->batch->id,
                'name' => $registration->batch->name,
                'price' => (float) $registration->batch->price,
            ],
            'window' => [
                'isOpen' => $isOpen,
                'isOverdue' => $isOverdue,
                'remainingMs' => $remainingMs,
                'startDate' => $start?->toISOString(),
                'endDate' => $end?->toISOString(),
            ],
            'submission' => $submission === null ? null : [
                'id' => $submission->id,
                'title' => $submission->title,
                'description' => $submission->description,
                'status' => $submission->status,
                'score' => $submission->score,
                'feedback' => $submission->feedback,
                'submittedAt' => $submission->submitted_at?->toISOString(),
                'reviewedAt' => $submission->reviewed_at?->toISOString(),
                'file' => $submission->file === null ? null : [
                    'id' => $submission->file->id,
                    'fileId' => $submission->file->file_id,
                    'url' => $submission->file->url,
                ],
            ],
            'canSubmit' => $canSubmit,
        ];
    }

    /** @return array<string, mixed> */
    private function examMetadata(Exam $exam): array
    {
        return [
            'id' => $exam->id,
            'title' => $exam->title,
            'description' => $exam->description,
            'startDate' => $exam->start_date?->toISOString(),
            'endDate' => $exam->end_date?->toISOString(),
            'duration' => $exam->duration,
            'maxAttempts' => $exam->max_attempts,
        ];
    }

    /** @return array<string, mixed> */
    private function stageMetadata(Stage $stage): array
    {
        return [
            'id' => $stage->id,
            'name' => $stage->name,
            'type' => $stage->type,
            'order' => $stage->order,
            'description' => $stage->description,
            'startDate' => $stage->start_date?->toISOString(),
            'endDate' => $stage->end_date?->toISOString(),
        ];
    }

    private function paymentState(?RegistrationStatus $status, bool $isPaymentTarget, bool $hasSubmittedPayment): string
    {
        if (! $isPaymentTarget) {
            return 'NOT_REQUIRED';
        }

        return match (true) {
            $status === RegistrationStatus::REVISION_REQUIRED => 'REVISION_REQUIRED',
            $status === RegistrationStatus::WAITING_VERIFICATION && $hasSubmittedPayment => 'WAITING_VERIFICATION',
            default => 'PAYMENT_REQUIRED',
        };
    }
}
