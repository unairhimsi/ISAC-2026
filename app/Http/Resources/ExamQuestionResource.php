<?php

namespace App\Http\Resources;

use App\Models\Admin;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ExamQuestionResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $isAdmin = $request->user() && $request->user() instanceof Admin;
        $canViewTryout = (bool) $request->attributes->get('canViewResult', false);
        $options = $this->options;

        if (is_array($options) && $this->exam && $this->exam->shuffle_options && ! $isAdmin) {
            $options = collect($options)->shuffle()->values()->all();
        }

        $data = [
            'id' => $this->id,
            'examId' => $this->exam_id,
            'question' => $this->question,
            'explanation' => ($isAdmin || $canViewTryout) ? $this->explanation : null,
            'type' => $this->type,
            'options' => $options,
            'order' => $this->order,
            'difficulty' => $this->difficulty,
            'category' => $this->category,
            'tags' => $this->tags,
            'isActive' => $this->is_active,
        ];

        if ($isAdmin || $canViewTryout) {
            $data['correctAnswer'] = $this->correct_answer;
            $data['correctScore'] = $this->correct_score;
            $data['wrongScore'] = $this->wrong_score;
            $data['emptyScore'] = $this->empty_score;
        }

        return $data;
    }
}
