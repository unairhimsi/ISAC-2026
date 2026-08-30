<?php

namespace App\Http\Requests\Exam;

use Illuminate\Foundation\Http\FormRequest;

class StoreEventsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'device_id' => ['nullable', 'string', 'max:255'],
            'deviceId' => ['nullable', 'string', 'max:255'],
            'events' => ['required', 'array', 'max:50'],
            'events.*.type' => ['required', 'string', 'max:50'],
            'events.*.metadata' => ['nullable', 'array'],
            'events.*.client_at' => ['nullable', 'date'],
            'events.*.clientAt' => ['nullable', 'date'],
        ];
    }
}
