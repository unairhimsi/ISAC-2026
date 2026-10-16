<?php

namespace App\Http\Requests\Admin;

use App\Models\Team;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ListTeamsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, array<int, mixed>> */
    public function rules(): array
    {
        return [
            'search' => ['sometimes', 'nullable', 'string', 'max:100'],
            'status' => ['sometimes', 'nullable', Rule::in(Team::STATUSES)],
            'competition_id' => ['sometimes', 'nullable', 'uuid', Rule::exists('competitions', 'id')->whereNull('deleted_at')],
            'batch_id' => ['sometimes', 'nullable', 'uuid', Rule::exists('batches', 'id')->whereNull('deleted_at')],
            'page' => ['sometimes', 'integer', 'min:1'],
            // Nilai di atas 100 di-clamp oleh service, bukan ditolak, agar klien lama tetap berfungsi.
            'per_page' => ['sometimes', 'integer', 'min:1'],
        ];
    }

    protected function prepareForValidation(): void
    {
        $this->merge([
            'search' => $this->filled('search') ? trim((string) $this->input('search')) : null,
            'status' => $this->filled('status') ? strtoupper((string) $this->input('status')) : null,
        ]);
    }
}
