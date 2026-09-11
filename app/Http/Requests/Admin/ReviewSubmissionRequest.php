<?php

namespace App\Http\Requests\Admin;

use App\Models\Submission;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

class ReviewSubmissionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return Gate::allows('review', Submission::class);
    }

    public function rules(): array
    {
        return [
            'action' => ['required', 'string', Rule::in(['approved', 'rejected', 'revision_requested', 'under_review'])],
            'score' => ['nullable', 'integer', 'min:0', 'max:100', Rule::requiredIf(fn () => $this->input('action') === 'approved')],
            'feedback' => ['nullable', 'string', 'max:2000', Rule::requiredIf(fn () => in_array($this->input('action'), ['rejected', 'revision_requested'], true))],
        ];
    }

    protected function prepareForValidation(): void
    {
        if ($this->has('feedback') && is_string($this->input('feedback'))) {
            $this->merge(['feedback' => trim((string) $this->input('feedback'))]);
        }
    }
}
