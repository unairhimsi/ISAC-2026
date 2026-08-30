<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class ExamAttempt extends Model
{
    use HasFactory, HasUuids, SoftDeletes;

    protected $keyType = 'string';

    public $incrementing = false;

    protected $fillable = [
        'id', 'team_id', 'exam_id', 'reviewed_by', 'total_score', 'max_possible_score', 'start_time', 'end_time', 'finished', 'flagged', 'cheat_count', 'suspicious_score', 'device_id', 'ip_address', 'user_agent', 'metadata',
    ];

    protected function casts(): array
    {
        return [
            'start_time' => 'datetime',
            'end_time' => 'datetime',
            'finished' => 'boolean',
            'flagged' => 'boolean',
            'total_score' => 'integer',
            'max_possible_score' => 'integer',
            'cheat_count' => 'integer',
            'suspicious_score' => 'integer',
            'metadata' => 'json',
        ];
    }

    public function team(): BelongsTo
    {
        return $this->belongsTo(Team::class);
    }

    public function exam(): BelongsTo
    {
        return $this->belongsTo(Exam::class);
    }

    public function reviewedBy(): BelongsTo
    {
        return $this->belongsTo(Admin::class, 'reviewed_by');
    }

    public function answers(): HasMany
    {
        return $this->hasMany(ExamAnswer::class, 'attempt_id');
    }

    public function eventLogs(): HasMany
    {
        return $this->hasMany(ExamEventLog::class, 'attempt_id');
    }
}
