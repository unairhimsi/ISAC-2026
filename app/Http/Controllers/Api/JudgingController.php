<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\ReviewSubmissionRequest;
use App\Http\Resources\JudgingSubmissionResource;
use App\Models\Stage;
use App\Models\Submission;
use App\Services\JudgingService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class JudgingController extends Controller
{
    public function __construct(private readonly JudgingService $service) {}

    public function index(Request $request, Stage $stage): JsonResponse
    {
        Gate::authorize('viewAny', Submission::class);

        $perPage = min(max($request->integer('per_page', 15), 1), 100);

        $query = Submission::query()
            ->where('stage_id', $stage->id)
            ->with(['team:id,code,name', 'file:id,file_id,url'])
            ->when($request->filled('status'), function (Builder $q) use ($request): void {
                $q->where('status', $request->input('status'));
            })
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
