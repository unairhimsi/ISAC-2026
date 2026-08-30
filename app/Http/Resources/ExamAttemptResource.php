<?php

namespace App\Http\Resources;

use App\Models\Admin;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ExamAttemptResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $metadata = $this->metadata ?? [];
        $questionOrder = $metadata['questionOrder'] ?? $metadata['question_order'] ?? null;

        $data = [
            'id' => $this->id,
            'examId' => $this->exam_id,
            'teamId' => $this->team_id,
            'reviewedBy' => $this->reviewed_by,
            'totalScore' => $this->total_score,
            'maxPossibleScore' => $this->max_possible_score,
            'startTime' => $this->start_time?->toISOString(),
            'endTime' => $this->end_time?->toISOString(),
            'finished' => (bool) $this->finished,
            'flagged' => (bool) $this->flagged,
            'cheatCount' => $this->cheat_count,
            'suspiciousScore' => $this->suspicious_score,
            'deviceId' => $this->device_id,
            'metadata' => $metadata,
            'questionOrder' => $questionOrder,
            'question_order' => $questionOrder,
            'createdAt' => $this->created_at?->toISOString(),
            'updatedAt' => $this->updated_at?->toISOString(),
        ];

        if ($request->user() instanceof Admin) {
            $data['team'] = $this->whenLoaded('team', function () {
                return $this->team ? [
                    'id' => $this->team->id,
                    'name' => $this->team->name,
                    'code' => $this->team->code,
                    'email' => $this->team->email,
                ] : null;
            });
            $data['exam'] = $this->whenLoaded('exam', function () {
                return $this->exam ? [
                    'id' => $this->exam->id,
                    'title' => $this->exam->title,
                ] : null;
            });
        }

        return $data;
    }
}
