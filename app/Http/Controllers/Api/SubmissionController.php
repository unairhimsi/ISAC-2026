<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Submission\StoreSubmissionRequest;
use App\Http\Resources\SubmissionResource;
use App\Models\Stage;
use App\Services\DashboardService;
use App\Services\SubmissionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SubmissionController extends Controller
{
    public function __construct(
        private readonly SubmissionService $submissionService,
        private readonly DashboardService $dashboardService,
    ) {}

    public function show(Request $request, Stage $stage): JsonResponse
    {
        $team = $request->user();
        $data = $this->dashboardService->getSubmissionShell($team, $stage);

        return response()->json([
            'status' => 'success',
            'message' => 'Data submission berhasil diambil.',
            'data' => $data,
            'metadata' => (object) [],
            'error' => null,
        ]);
    }

    public function upsert(StoreSubmissionRequest $request, Stage $stage): JsonResponse
    {
        $team = $request->user();
        $submission = $this->submissionService->upsertDraft($team, $stage, $request->validated());

        return response()->json([
            'status' => 'success',
            'message' => 'Draft berhasil disimpan.',
            'data' => new SubmissionResource($submission),
            'metadata' => (object) [],
            'error' => null,
        ]);
    }

    public function submit(Request $request, Stage $stage): JsonResponse
    {
        $team = $request->user();
        $key = $request->header('Idempotency-Key') ?? $request->header('idempotency-key');
        $submission = $this->submissionService->submit($team, $stage, $key);

        return response()->json([
            'status' => 'success',
            'message' => 'Submission berhasil dikumpulkan.',
            'data' => new SubmissionResource($submission),
            'metadata' => (object) [],
            'error' => null,
        ]);
    }

    public function unsubmit(Request $request, Stage $stage): JsonResponse
    {
        $team = $request->user();
        $submission = $this->submissionService->unsubmit($team, $stage);

        return response()->json([
            'status' => 'success',
            'message' => 'Submission berhasil ditarik.',
            'data' => new SubmissionResource($submission),
            'metadata' => (object) [],
            'error' => null,
        ]);
    }
}
