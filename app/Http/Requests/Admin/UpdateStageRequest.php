<?php

namespace App\Http\Requests\Admin;

use App\Models\Stage;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateStageRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    /** @return array<string, array<int, mixed>> */
    public function rules(): array
    {
        /** @var Stage $stage */
        $stage = $this->route('stage');

        return [
            'name' => ['required', 'string', 'max:120'],
            'type' => ['required', Rule::in(['registration', 'submission', 'selection', 'exam', 'interview', 'announcement', 'final'])],
            'description' => ['nullable', 'string', 'max:5000'],
            'order' => [
                'required',
                'integer',
                'min:1',
                Rule::unique('stages', 'order')
                    ->ignore($stage->id)
                    ->where(fn ($query) => $query
                        ->where('competition_id', $stage->competition_id)
                        ->whereNull('deleted_at')),
            ],
            'start_date' => ['nullable', 'date'],
            'end_date' => ['nullable', 'date', 'after_or_equal:start_date'],
            'is_active' => ['sometimes', 'boolean'],
        ];
    }
}
