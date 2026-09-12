<?php

namespace App\Http\Requests\Submission;

use Illuminate\Foundation\Http\FormRequest;

class StoreSubmissionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'title' => ['required', 'string', 'min:3', 'max:180'],
            'description' => ['nullable', 'string', 'max:5000'],
            'file_id' => ['nullable', 'uuid', 'exists:files,id'],
            'fileId' => ['nullable', 'uuid', 'exists:files,id'],
        ];
    }
}
