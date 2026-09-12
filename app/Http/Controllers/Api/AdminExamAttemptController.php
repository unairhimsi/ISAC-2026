<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\UpdateScoreRequest;
use App\Http\Resources\ExamAttemptResource;
use App\Http\Resources\ExamQuestionResource;
use App\Models\Competition;
use App\Models\Exam;
use App\Models\ExamAttempt;
use App\Services\SecurityAuditService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Str;

class AdminExamAttemptController extends Controller
{
    public function index(Request $request, Exam $exam): JsonResponse
    {
        $this->authorize($request);
        $exam->loadMissing('stage.competition');
        abort_unless($exam->stage->competition->type === Competition::TYPE_OLIMPIADE, 404);

        $flagged = $request->query('flagged');
        $search = $request->query('search');
        $perPage = (int) ($request->query('per_page', 15));

        $query = ExamAttempt::where('exam_id', $exam->id)->with(['team', 'exam']);

        if ($flagged !== null && $flagged !== '') {
            $query->where('flagged', filter_var($flagged, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE) ?? (int) $flagged);
        }

        if ($search) {
            $query->whereHas('team', function ($q) use ($search) {
                $q->where('code', 'like', "%{$search}%")
                    ->orWhere('name', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%");
            });
        }

        $paginator = $query->orderByDesc('flagged')->orderByDesc('created_at')->paginate($perPage)->withQueryString();

        return response()->json([
            'status' => 'success',
            'message' => 'Daftar percobaan berhasil diambil.',
            'data' => [
                'data' => ExamAttemptResource::collection($paginator->items()),
                'current_page' => $paginator->currentPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
                'last_page' => $paginator->lastPage(),
            ],
            'metadata' => (object) [],
            'error' => null,
        ]);
    }

    public function show(Request $request, Exam $exam, ExamAttempt $attempt): JsonResponse
    {
        $this->authorize($request);
        $exam->loadMissing('stage.competition');
        abort_unless($exam->stage->competition->type === Competition::TYPE_OLIMPIADE, 404);
        if ($attempt->exam_id !== $exam->id) {
            abort(404);
        }

        $attempt->load(['team', 'exam', 'answers.question', 'eventLogs']);

        $answers = $attempt->answers->map(function ($a) {
            return [
                'id' => $a->id,
                'questionId' => $a->question_id,
                'question' => $a->question ? new ExamQuestionResource($a->question) : null,
                'selectedOptions' => $a->selected_options,
                'answer' => $a->answer,
                'isCorrect' => $a->is_correct,
                'scoreObtained' => $a->score_obtained,
                'timeSpent' => $a->time_spent,
                'answeredAt' => $a->answered_at?->toISOString(),
                'correctAnswer' => $a->question?->correct_answer,
            ];
        });

        $timeline = $attempt->eventLogs->sortBy('created_at')->map(function ($e) {
            return [
                'id' => $e->id,
                'type' => $e->type,
                'metadata' => $e->metadata,
                'createdAt' => $e->created_at?->toISOString(),
            ];
        })->values();

        return response()->json([
            'status' => 'success',
            'message' => 'Detail percobaan berhasil diambil.',
            'data' => [
                'attempt' => new ExamAttemptResource($attempt),
                'answers' => $answers,
                'timeline' => $timeline,
            ],
            'metadata' => (object) [],
            'error' => null,
        ]);
    }

    public function updateScore(UpdateScoreRequest $request, Exam $exam, ExamAttempt $attempt): JsonResponse
    {
        $this->authorize($request);
        $exam->loadMissing('stage.competition');
        abort_unless($exam->stage->competition->type === Competition::TYPE_OLIMPIADE, 404);
        if ($attempt->exam_id !== $exam->id) {
            abort(404);
        }

        $data = $request->validated();
        $totalScore = $data['total_score'] ?? $data['totalScore'] ?? null;
        $reason = $data['reason'];
        $max = (int) $attempt->max_possible_score;

        if ($totalScore > $max) {
            return response()->json([
                'status' => 'error',
                'message' => 'The given data was invalid.',
                'data' => null,
                'metadata' => (object) [],
                'error' => ['code' => 'VALIDATION_ERROR', 'details' => ['total_score' => ['Total score tidak boleh melebihi '.$max]]],
            ], 422);
        }

        $admin = $request->user();
        $before = $attempt->total_score;

        DB::transaction(function () use ($attempt, $admin, $totalScore, $reason, $before, $request) {
            $attempt->update([
                'total_score' => $totalScore,
                'reviewed_by' => $admin->id,
            ]);

            DB::table('admin_audit_logs')->insert([
                'id' => (string) Str::uuid(),
                'admin_id' => $admin->id,
                'action' => 'exam.score_updated',
                'subject_type' => ExamAttempt::class,
                'subject_id' => $attempt->id,
                'before_data' => json_encode(['total_score' => $before]),
                'after_data' => json_encode(['total_score' => $totalScore]),
                'reason' => $reason,
                'request_id' => $request->header('X-Request-ID'),
                'created_at' => now(),
            ]);
        });

        app(SecurityAuditService::class)->record('exam.score_updated', $admin, [
            'attempt_id' => $attempt->id,
            'exam_id' => $exam->id,
            'total_score' => $totalScore,
        ]);

        return response()->json([
            'status' => 'success',
            'message' => 'Nilai berhasil diperbarui.',
            'data' => new ExamAttemptResource($attempt->fresh()->load(['team', 'exam'])),
            'metadata' => (object) [],
            'error' => null,
        ]);
    }

    private function authorize(Request $request): void
    {
        $admin = $request->user();
        Gate::forUser($admin)->authorize('author', [Exam::class]);
    }
}
