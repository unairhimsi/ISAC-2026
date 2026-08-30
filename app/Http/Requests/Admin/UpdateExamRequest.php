<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

class UpdateExamRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    public function rules(): array
    {
        return [
            'title' => ['sometimes', 'string', 'max:255'],
            'description' => ['sometimes', 'nullable', 'string', 'max:60000'],
            'start_date' => ['sometimes', 'date'],
            'startDate' => ['sometimes', 'date'],
            'end_date' => ['sometimes', 'date'],
            'endDate' => ['sometimes', 'date'],
            'duration' => ['sometimes', 'integer', 'min:1', 'max:480'],
            'max_attempts' => ['sometimes', 'integer', 'min:1', 'max:5'],
            'maxAttempts' => ['sometimes', 'integer', 'min:1', 'max:5'],
            'shuffle_questions' => ['sometimes', 'boolean'],
            'shuffleQuestions' => ['sometimes', 'boolean'],
            'shuffle_options' => ['sometimes', 'boolean'],
            'shuffleOptions' => ['sometimes', 'boolean'],
            'show_result_immediately' => ['sometimes', 'boolean'],
            'showResultImmediately' => ['sometimes', 'boolean'],
            'passing_score' => ['sometimes', 'nullable', 'integer', 'min:0', 'max:1000'],
            'passingScore' => ['sometimes', 'nullable', 'integer', 'min:0', 'max:1000'],
        ];
    }
}
