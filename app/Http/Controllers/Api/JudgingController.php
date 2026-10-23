<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\ReviewSubmissionRequest;
use App\Http\Resources\JudgingSubmissionResource;
use App\Http\Resources\MissingSubmissionTeamResource;
use App\Models\Stage;
use App\Models\Submission;
use App\Services\JudgingService;
use App\Services\SubmissionCoverageService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class JudgingController extends Controller
{
    public function __construct(
        private readonly JudgingService $service,
        private readonly SubmissionCoverageService $coverage,
    ) {}

    public function index(Request $request, Stage $stage): JsonResponse
    {
        Gate::authorize('viewAny', Submission::class);

        $perPage = min(max($request->integer('per_page', 15), 1), 100);

        $query = Submission::query()
            ->where('stage_id', $stage->id)
            ->with(['team:id,code,name', 'file:id,file_id,url'])
            // Drafts are the team's private working copy: only listed when asked for by status.
            ->when($request->filled('status'), function (Builder $q) use ($request): void {
                $q->where('status', $request->input('status'));
            }, fn (Builder $q) => $q->where('status', '!=', 'draft'))
            ->when($request->filled('search'), function (Builder $q) use ($request): void {
                $search = trim((string) $request->input('search'));
                $like = "%{$search}%";
                $q->whereHas('team', function (Builder $team) use ($like): void {
                    $team->where('code', 'like', $like)->orWhere('name', 'like', $like);
                });
            })
            ->orderByRaw("CASE WHEN status='submitted' THEN 0 WHEN status='under_review' THEN 1 WHEN status='revision_requested' THEN 2 ELSE 3 END")
            ->orderBy('submitted_at', 'asc')
            ->orderBy('created_at', 'asc');

        $paginator = $query->paginate($perPage);

        return response()->json([
            'status' => 'success',
            'message' => 'Daftar submission berhasil diambil.',
            'data' => JudgingSubmissionResource::collection($paginator)->response()->getData(true),
            'metadata' => (object) [],
            'error' => null,
        ]);
    }

    public function missing(Request $request, Stage $stage): JsonResponse
    {
        Gate::authorize('viewAny', Submission::class);
        abort_unless(SubmissionCoverageService::supports($stage), 404);

        $filters = $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'state' => ['nullable', 'in:'.SubmissionCoverageService::STATE_NOT_STARTED.','.SubmissionCoverageService::STATE_DRAFT],
            'per_page' => ['nullable', 'integer'],
        ]);
        $perPage = min(max((int) ($filters['per_page'] ?? 20), 1), 100);

        $paginator = $this->coverage->missing($stage, isset($filters['search']) ? trim($filters['search']) : null, $filters['state'] ?? null, $perPage);
        $stage->loadMissing('competition:id,name,type');

        return response()->json([
            'status' => 'success',
            'message' => 'Daftar tim yang belum mengumpulkan submission berhasil diambil.',
            'data' => [
                'competition' => [
                    'id' => $stage->competition->id,
                    'name' => $stage->competition->name,
                    'type' => $stage->competition->type,
                ],
                'stage' => [
                    'id' => $stage->id,
                    'name' => $stage->name,
                    'type' => $stage->type,
                    'order' => $stage->order,
                    'startDate' => $stage->start_date?->toISOString(),
                    'endDate' => $stage->end_date?->toISOString(),
                ],
                'summary' => $this->coverage->summary($stage),
                'teams' => [
                    'data' => $paginator->getCollection()->map(fn ($team) => new MissingSubmissionTeamResource($team, $stage))->values(),
                    'current_page' => $paginator->currentPage(),
                    'per_page' => $paginator->perPage(),
                    'total' => $paginator->total(),
                    'last_page' => $paginator->lastPage(),
                ],
            ],
            'metadata' => (object) [],
            'error' => null,
        ]);
    }

    public function show(Request $request, Submission $submission): JsonResponse
    {
        Gate::authorize('view', $submission);

        $submission->load(['team', 'file', 'stage', 'reviewedBy']);

        return response()->json([
            'status' => 'success',
            'message' => 'Detail submission berhasil diambil.',
            'data' => new JudgingSubmissionResource($submission),
            'metadata' => (object) [],
            'error' => null,
        ]);
    }

    public function review(ReviewSubmissionRequest $request, Submission $submission): JsonResponse
    {
        Gate::authorize('review', $submission);

        $admin = $request->user();
        $result = $this->service->review($admin, $submission, $request->validated(), $request->header('X-Request-ID'));

        return response()->json([
            'status' => 'success',
            'message' => 'Penilaian berhasil disimpan.',
            'data' => new JudgingSubmissionResource($result),
            'metadata' => (object) [],
            'error' => null,
        ]);
    }
}
