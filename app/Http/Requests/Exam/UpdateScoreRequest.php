<?php

namespace App\Http\Requests\Exam;

use Illuminate\Foundation\Http\FormRequest;

class UpdateScoreRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'total_score' => ['required', 'integer', 'min:0'],
            'totalScore' => ['nullable', 'integer', 'min:0'],
            'reason' => ['required', 'string', 'min:1', 'max:2000'],
        ];
    }
}
