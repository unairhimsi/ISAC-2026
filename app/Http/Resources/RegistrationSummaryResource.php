<?php

namespace App\Http\Resources;
use App\Models\AdminAuditLog;
use App\Models\Competition;

use App\Models\Team;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @property-read Team $resource */
class RegistrationSummaryResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $this->resource->loadMissing('members.photoFile', 'registration.competition', 'registration.batch', 'currentStage');

        $registration = $this->resource->registration;

        $auditLogs = AdminAuditLog::query()
            ->where(function ($q) use ($registration): void {
                $q->where('subject_type', Team::class)->where('subject_id', $this->resource->id);
                if ($registration) {
                    $q->orWhere(function ($qq) use ($registration): void {
                        $qq->where('subject_type', \App\Models\Registration::class)->where('subject_id', $registration->id);
                    });
                }
            })
            ->whereNotNull('reason')
            ->where('reason', '!=', '')
            ->with('admin:id,name')
            ->orderByDesc('created_at')
            ->limit(5)
            ->get()
            ->map(fn (AdminAuditLog $log) => [
                'id' => $log->id,
                'action' => $log->action,
                'reason' => $log->reason,
                'requestId' => $log->request_id,
                'adminName' => $log->admin?->name ?? 'Sistem',
                'createdAt' => $log->created_at?->toISOString(),
            ])->values()->all();

        return [
            'team' => new TeamFormResource($this->resource),
            'members' => MembersFormResource::collection($this->resource->members),
            'registration' => $registration !== null
                ? [
                    'id' => $registration->id,
                    'status' => $registration->status?->value,
                    'teamCompletedAt' => $registration->team_completed_at?->toISOString(),
                    'membersCompletedAt' => $registration->members_completed_at?->toISOString(),
                    'documentsCompletedAt' => $registration->documents_completed_at?->toISOString(),
                    'submittedAt' => $registration->submitted_at?->toISOString(),
                    'paymentAvailable' => $registration->competition->payment_flow === Competition::PAYMENT_UPFRONT
                        || $registration->payment_required_at !== null,
                    'paymentRequiredAt' => $registration->payment_required_at?->toISOString(),
                    'paymentSubmittedAt' => $registration->payment_submitted_at?->toISOString(),
                    'competition' => new CompetitionResource($registration->competition),
                    'batch' => new BatchResource($registration->batch),
                ]
                : null,
            'auditLogs' => $auditLogs,
            'verificationNote' => $this->resource->verification_note,
            'revisionStep' => $this->resource->revision_step,
            'currentStage' => $this->resource->currentStage ? [
                'id' => $this->resource->currentStage->id,
                'name' => $this->resource->currentStage->name,
                'order' => $this->resource->currentStage->order,
                'type' => $this->resource->currentStage->type,
            ] : null,
        ];
    }
}
