<?php

namespace App\Http\Requests\Exam;

use Illuminate\Foundation\Http\FormRequest;

class SaveAnswersRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'answers' => ['required', 'array', 'max:50'],
            'answers.*.question_id' => ['required_without:answers.*.questionId', 'nullable', 'uuid', 'exists:exam_questions,id'],
            'answers.*.questionId' => ['required_without:answers.*.question_id', 'nullable', 'uuid', 'exists:exam_questions,id'],
            'answers.*.selected_options' => ['nullable'],
            'answers.*.selectedOptions' => ['nullable'],
            'answers.*.answer' => ['nullable', 'string', 'max:10000'],
            'answers.*.time_spent' => ['nullable', 'integer', 'min:0', 'max:3600'],
            'answers.*.timeSpent' => ['nullable', 'integer', 'min:0', 'max:3600'],
        ];
    }
}
