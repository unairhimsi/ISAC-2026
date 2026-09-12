<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class SubmissionResource extends JsonResource
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
            'file' => $this->whenLoaded('file', function () {
                if ($this->file === null) {
                    return null;
                }

                return [
                    'id' => $this->file->id,
                    'fileId' => $this->file->file_id,
                    'url' => $this->file->url,
                ];
            }, $this->file ? [
                'id' => $this->file->id,
                'fileId' => $this->file->file_id,
                'url' => $this->file->url,
            ] : null),
            'createdAt' => $this->created_at?->toISOString(),
            'updatedAt' => $this->updated_at?->toISOString(),
        ];
    }
}
