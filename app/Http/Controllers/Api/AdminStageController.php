<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\StoreStageRequest;
use App\Http\Requests\Admin\UpdateStageRequest;
use App\Http\Resources\AdminStageResource;
use App\Models\Stage;
use App\Services\AdminStageService;
use App\Services\StageAdvancementService;
use App\Services\SubmissionCoverageService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class AdminStageController extends Controller
{
    public function __construct(
        private readonly AdminStageService $stages,
        private readonly StageAdvancementService $advancement,
    ) {}

    public function index(Request $request): JsonResponse
    {
        Gate::authorize('viewAny', Stage::class);
        $data = $request->validate(['competition_id' => ['nullable', 'uuid', 'exists:competitions,id']]);

        return $this->success('Tahapan kompetisi berhasil diambil.', AdminStageResource::collection($this->stages->list($data['competition_id'] ?? null)));
    }

    public function show(Stage $stage): JsonResponse
    {
        Gate::authorize('view', $stage);

        return $this->success('Detail tahap berhasil diambil.', new AdminStageResource($this->stages->detail($stage)));
    }

    public function scores(Stage $stage): JsonResponse
    {
        Gate::authorize('view', $stage);

        return $this->success('Nilai tahap berhasil diambil.', $this->stages->scores($stage));
    }

    public function advancement(Request $request, Stage $stage): JsonResponse
    {
        Gate::authorize('advanceTeam', $stage);
        abort_unless(SubmissionCoverageService::supports($stage), 404);
        $filters = $request->validate(['batch_id' => ['nullable', 'uuid', 'exists:batches,id']]);

        $stage->loadMissing('competition:id,name,type');

        return $this->success('Daftar tim untuk kelolosan tahap berhasil diambil.', [
            'competition' => ['id' => $stage->competition->id, 'name' => $stage->competition->name, 'type' => $stage->competition->type],
            'stage' => [
                'id' => $stage->id,
                'name' => $stage->name,
                'type' => $stage->type,
                'order' => $stage->order,
                'startDate' => $stage->start_date?->toISOString(),
                'endDate' => $stage->end_date?->toISOString(),
            ],
            ...$this->advancement->overview($stage, $filters['batch_id'] ?? null),
        ]);
    }

    public function store(StoreStageRequest $request): JsonResponse
    {
        Gate::authorize('create', Stage::class);

        return $this->success('Tahap berhasil dibuat.', new AdminStageResource($this->stages->create($request->validated())), 201);
    }

    public function update(UpdateStageRequest $request, Stage $stage): JsonResponse
    {
        Gate::authorize('update', $stage);

        return $this->success('Tahap berhasil diperbarui.', new AdminStageResource($this->stages->update($stage, $request->validated())));
    }

    public function destroy(Stage $stage): JsonResponse
    {
        Gate::authorize('delete', $stage);
        $this->stages->delete($stage);

        return $this->success('Tahap berhasil dihapus.', null);
    }

    private function success(string $message, mixed $data, int $status = 200): JsonResponse
    {
        return response()->json([
            'status' => 'success',
            'message' => $message,
            'data' => $data,
            'metadata' => (object) [],
            'error' => null,
        ], $status);
    }
}
