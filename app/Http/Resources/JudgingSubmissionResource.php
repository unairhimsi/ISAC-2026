<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class JudgingSubmissionResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'teamId' => $this->team_id,
            'stageId' => $this->stage_id,
            'title' => $this->title,
            'description' => $this->description,
            'status' => $this->status,
            'score' => $this->score,
            'feedback' => $this->feedback,
            'submittedAt' => $this->submitted_at?->toISOString(),
            'reviewedAt' => $this->reviewed_at?->toISOString(),
            'reviewedBy' => $this->reviewed_by,
            'team' => $this->whenLoaded('team', function () {
                return $this->team ? [
                    'id' => $this->team->id,
                    'code' => $this->team->code,
                    'name' => $this->team->name,
                ] : null;
            }),
            'stage' => $this->whenLoaded('stage', function () {
                return $this->stage ? [
                    'id' => $this->stage->id,
                    'name' => $this->stage->name,
                    'type' => $this->stage->type,
                    'order' => $this->stage->order,
                ] : null;
            }),
            'file' => $this->whenLoaded('file', function () {
                return $this->file ? [
                    'id' => $this->file->id,
                    'fileId' => $this->file->file_id,
                    'url' => $this->file->url,
                ] : null;
            }),
            'reviewedByAdmin' => $this->whenLoaded('reviewedBy', function () {
                return $this->reviewedBy ? [
                    'id' => $this->reviewedBy->id,
                    'name' => $this->reviewedBy->name,
                    'email' => $this->reviewedBy->email,
                ] : null;
            }),
            'createdAt' => $this->created_at?->toISOString(),
            'updatedAt' => $this->updated_at?->toISOString(),
        ];
    }
}
