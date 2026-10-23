<?php

namespace App\Http\Requests\Admin;

use App\Enums\ExportFormat;
use App\Models\Team;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Arr;
use Illuminate\Validation\Rule;

class ExportTeamsRequest extends FormRequest
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
            'format' => ['sometimes', 'nullable', Rule::enum(ExportFormat::class)],
        ];
    }

    protected function prepareForValidation(): void
    {
        $this->merge([
            'search' => $this->filled('search') ? trim((string) $this->input('search')) : null,
            'status' => $this->filled('status') ? strtoupper((string) $this->input('status')) : null,
            'format' => $this->filled('format') ? strtolower((string) $this->input('format')) : null,
        ]);
    }

    public function exportFormat(): ExportFormat
    {
        return ExportFormat::tryFrom((string) $this->validated('format')) ?? ExportFormat::XLSX;
    }

    /** @return array<string, mixed> */
    public function filters(): array
    {
        return Arr::except($this->validated(), ['format']);
    }
}
