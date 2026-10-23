<?php

namespace App\Http\Requests\Admin;

use App\Enums\ExportFormat;
use App\Models\PaymentMethod;
use App\Models\RegistrationStatus;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Arr;
use Illuminate\Validation\Rule;

class ExportPaymentsRequest extends FormRequest
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
            'status' => ['sometimes', 'nullable', Rule::enum(RegistrationStatus::class)],
            'competition_id' => ['sometimes', 'nullable', 'uuid', Rule::exists('competitions', 'id')->whereNull('deleted_at')],
            'batch_id' => ['sometimes', 'nullable', 'uuid', Rule::exists('batches', 'id')->whereNull('deleted_at')],
            'payment_method' => ['sometimes', 'nullable', Rule::enum(PaymentMethod::class)],
            'format' => ['sometimes', 'nullable', Rule::enum(ExportFormat::class)],
        ];
    }

    protected function prepareForValidation(): void
    {
        $this->merge([
            'search' => $this->filled('search') ? trim((string) $this->input('search')) : null,
            'status' => $this->filled('status') ? strtoupper((string) $this->input('status')) : null,
            'payment_method' => $this->filled('payment_method') ? strtoupper((string) $this->input('payment_method')) : null,
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
