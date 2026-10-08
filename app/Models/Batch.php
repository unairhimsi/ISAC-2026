<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

enum BatchStatus: string
{
    case DRAFT = 'DRAFT';
    case OPEN = 'OPEN';
    case CLOSED = 'CLOSED';
    case FULL = 'FULL';
}

class Batch extends Model
{
    use HasFactory, HasUuids, SoftDeletes;

    protected $table = 'batches';

    protected $keyType = 'string';

    public $incrementing = false;

    protected $fillable = [
        'id',
        'competition_id',
        'name',
        'slug',
        'description',
        'start_date',
        'end_date',
        'price',
        'module_file_id',
        'quota',
        'current_registrations',
        'status',
    ];

    protected function casts(): array
    {
        return [
            'start_date' => 'datetime',
            'end_date' => 'datetime',
            'price' => 'decimal:2',
            'quota' => 'integer',
            'current_registrations' => 'integer',
            'status' => BatchStatus::class,
        ];
    }

    /**
     * Batch yang sedang menerima pembayaran pada saat query dijalankan:
     * berstatus OPEN, dalam periode, dan kuotanya belum habis.
     *
     * @param  Builder<Batch>  $query
     * @return Builder<Batch>
     */
    public function scopePayableNow(Builder $query): Builder
    {
        return $query
            ->where('status', BatchStatus::OPEN)
            ->where('start_date', '<=', now())
            ->where('end_date', '>=', now())
            ->where(fn (Builder $quota) => $quota->whereNull('quota')->orWhereColumn('current_registrations', '<', 'quota'));
    }

    public function competition(): BelongsTo
    {
        return $this->belongsTo(Competition::class, 'competition_id', 'id');
    }

    public function moduleFile(): BelongsTo
    {
        return $this->belongsTo(File::class, 'module_file_id', 'id');
    }

    public function registrations(): HasMany
    {
        return $this->hasMany(Registration::class, 'batch_id', 'id');
    }
}
