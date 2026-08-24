<?php

namespace App\Services;

use App\Models\Registration;
use App\Models\Stage;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class AdminStageService
{
    /** @return Collection<int, Stage> */
    public function list(?string $competitionId = null): Collection
    {
        return Stage::query()
            ->with('competition:id,name,type')
            ->withCount(['exams', 'submissions', 'teams'])
            ->when($competitionId, fn ($query) => $query->where('competition_id', $competitionId))
            ->orderBy('competition_id')
            ->orderBy('order')
            ->get();
    }

    public function detail(Stage $stage): Stage
    {
        return $stage->load('competition:id,name,type')->loadCount(['exams', 'submissions', 'teams']);
    }

    /** @param array<string, mixed> $data */
    public function create(array $data): Stage
    {
        return DB::transaction(fn (): Stage => $this->detail(Stage::query()->create($data)));
    }

    /** @param array<string, mixed> $data */
    public function update(Stage $stage, array $data): Stage
    {
        return DB::transaction(function () use ($stage, $data): Stage {
            $stage->update($data);

            return $this->detail($stage->fresh());
        });
    }

    public function delete(Stage $stage): void
    {
        DB::transaction(function () use ($stage): void {
            $stage = Stage::query()->lockForUpdate()->findOrFail($stage->id);
            $isInUse = $stage->exams()->exists()
                || $stage->submissions()->exists()
                || $stage->teams()->exists()
                || Registration::query()->where('payment_for_stage_id', $stage->id)->exists();

            if ($isInUse) {
                throw ValidationException::withMessages([
                    'stage' => ['Tahap yang sudah memiliki ujian, pengumpulan, tim, atau checkpoint pembayaran tidak dapat dihapus.'],
                ]);
            }

            $stage->delete();
        });
    }
}
