<?php

namespace App\Http\Resources;

use App\Models\Stage;
use App\Services\SubmissionCoverageService;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** One team that still owes a submission for the given stage. */
class MissingSubmissionTeamResource extends JsonResource
{
    public function __construct($resource, private readonly Stage $stage)
    {
        parent::__construct($resource);
    }

    public function toArray(Request $request): array
    {
        $draft = $this->submissions->first();
        $stageEnded = $this->stage->end_date !== null && now()->gt($this->stage->end_date);
        $advancedPast = $this->currentStage !== null && (int) $this->currentStage->order > (int) $this->stage->order;

        return [
            'id' => $this->id,
            'code' => $this->code,
            'name' => $this->name,
            'email' => $this->email,
            'phone' => $this->phone,
            'institutionName' => $this->institution_name,
            'currentStage' => $this->currentStage === null ? null : [
                'id' => $this->currentStage->id,
                'name' => $this->currentStage->name,
                'order' => $this->currentStage->order,
            ],
            'state' => $draft === null ? SubmissionCoverageService::STATE_NOT_STARTED : SubmissionCoverageService::STATE_DRAFT,
            // Past the stage, or its window closed: the team can no longer deliver on its own.
            'lapsed' => $advancedPast || $stageEnded,
            'advancedPast' => $advancedPast,
            'submission' => $draft === null ? null : [
                'id' => $draft->id,
                'title' => $draft->title,
                'hasFile' => $draft->file_id !== null,
                'fileUrl' => $draft->file?->url,
                'withdrawn' => $draft->submitted_at !== null,
                'updatedAt' => $draft->updated_at?->toISOString(),
            ],
        ];
    }
}
