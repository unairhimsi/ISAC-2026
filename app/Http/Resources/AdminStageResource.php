<?php

namespace App\Http\Resources;

use App\Models\Stage;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @property-read Stage $resource */
class AdminStageResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        $this->resource->loadMissing('competition');

        return [
            'id' => $this->id,
            'competitionId' => $this->competition_id,
            'competition' => [
                'id' => $this->competition->id,
                'name' => $this->competition->name,
                'type' => $this->competition->type,
            ],
            'name' => $this->name,
            'type' => $this->type,
            'description' => $this->description,
            'order' => $this->order,
            'startDate' => $this->start_date?->toISOString(),
            'endDate' => $this->end_date?->toISOString(),
            'isActive' => $this->is_active,
            'criteria' => $this->criteria,
            'examCount' => (int) ($this->exams_count ?? 0),
            'submissionCount' => (int) ($this->submissions_count ?? 0),
            'teamCount' => (int) ($this->teams_count ?? 0),
            'createdAt' => $this->created_at?->toISOString(),
            'updatedAt' => $this->updated_at?->toISOString(),
        ];
    }
}
