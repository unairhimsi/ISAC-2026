<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ExamAnswer extends Model
{
    use HasFactory, HasUuids;

    protected $keyType = 'string';

    public $incrementing = false;

    protected $fillable = [
        'id', 'attempt_id', 'question_id', 'answer', 'selected_options', 'is_correct', 'score_obtained', 'answered_at', 'time_spent',
    ];

    protected function casts(): array
    {
        return [
            'selected_options' => 'json',
            'is_correct' => 'boolean',
            'score_obtained' => 'integer',
            'answered_at' => 'datetime',
            'time_spent' => 'integer',
        ];
    }

    public function attempt(): BelongsTo
    {
        return $this->belongsTo(ExamAttempt::class, 'attempt_id');
    }

    public function question(): BelongsTo
    {
        return $this->belongsTo(ExamQuestion::class, 'question_id');
    }
}
