<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Exam\SaveAnswersRequest;
use App\Http\Requests\Exam\StartExamRequest;
use App\Http\Requests\Exam\StoreEventsRequest;
use App\Http\Resources\ExamAttemptResource;
use App\Http\Resources\ExamQuestionResource;
use App\Models\Competition;
use App\Models\Exam;
use App\Models\ExamAttempt;
use App\Models\Team;
use App\Services\ExamAttemptService;
use App\Services\ExamDetectionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ExamAttemptController extends Controller
{
    public function __construct(
        private readonly ExamAttemptService $attemptService,
        private readonly ExamDetectionService $detectionService,
    ) {}

    public function start(StartExamRequest $request, Exam $exam): JsonResponse
    {
        $team = $request->user();
        $this->ensureTeamCanAccess($team, $exam);
        $data = $request->validated();
        $deviceId = $data['device_id'] ?? $request->input('deviceId');
        $result = $this->attemptService->start($team, $exam, $deviceId, $request->ip(), $request->userAgent());

        return response()->json([
            'status' => 'success',
            'message' => 'Percobaan ujian berhasil dibuat.',
            'data' => [
                'attempt' => new ExamAttemptResource($result['attempt']),
                'questions' => ExamQuestionResource::collection($result['questions']),
                'serverTime' => $result['serverTime'],
            ],
            'metadata' => (object) [],
            'error' => null,
        ], 201);
    }

    public function show(Request $request, Exam $exam, ExamAttempt $attempt): JsonResponse
    {
        $team = $request->user();
        $this->ensureTeamCanAccess($team, $exam);
        $result = $this->attemptService->resume($team, $exam, $attempt);
        $canViewResult = $exam->type === 'tryout' && (bool) $result['attempt']->finished;
        $request->attributes->set('canViewResult', $canViewResult);

        return response()->json([
            'status' => 'success',
            'message' => 'Detail percobaan berhasil diambil.',
            'data' => [
                'attempt' => new ExamAttemptResource($result['attempt']),
                'questions' => ExamQuestionResource::collection($result['questions']),
                'savedAnswers' => $result['savedAnswers'],
                'saved_answers' => $result['saved_answers'],
                'serverTime' => $result['serverTime'],
                'canViewResult' => $canViewResult,
                'can_view_result' => $canViewResult,
            ],
            'metadata' => (object) [],
            'error' => null,
        ]);
    }

    public function saveAnswers(SaveAnswersRequest $request, Exam $exam, ExamAttempt $attempt): JsonResponse
    {
        $team = $request->user();
        $this->ensureTeamCanAccess($team, $exam);
        if ($attempt->team_id !== $team->id || $attempt->exam_id !== $exam->id) {
            abort(404);
        }
        $data = $request->validated();
        $answers = $data['answers'] ?? [];
        $saved = $this->attemptService->saveAnswers($attempt, $exam, $answers);

        return response()->json([
            'status' => 'success',
            'message' => 'Jawaban berhasil disimpan.',
            'data' => ['saved' => $saved],
            'metadata' => (object) [],
            'error' => null,
        ]);
    }

    public function storeEvents(StoreEventsRequest $request, Exam $exam, ExamAttempt $attempt): JsonResponse
    {
        $team = $request->user();
        $this->ensureTeamCanAccess($team, $exam);
        if ($attempt->team_id !== $team->id || $attempt->exam_id !== $exam->id) {
            abort(404);
        }
        $data = $request->validated();
        $events = $data['events'] ?? [];
        $deviceId = $data['device_id'] ?? $data['deviceId'] ?? null;
        $result = $this->detectionService->accumulate($attempt->fresh(), $events, $deviceId);

        return response()->json([
            'status' => 'success',
            'message' => 'Event berhasil dicatat.',
            'data' => $result,
            'metadata' => (object) [],
            'error' => null,
        ]);
    }

    public function submit(Request $request, Exam $exam, ExamAttempt $attempt): JsonResponse
    {
        $team = $request->user();
        $this->ensureTeamCanAccess($team, $exam);
        $updated = $this->attemptService->submit($team, $exam, $attempt);
        $exam->load('stage');

        return response()->json([
            'status' => 'success',
            'message' => 'Ujian berhasil diselesaikan.',
            'data' => [
                'attempt' => new ExamAttemptResource($updated),
                'showResult' => (bool) $exam->show_result_immediately,
                'show_result' => (bool) $exam->show_result_immediately,
            ],
            'metadata' => (object) [],
            'error' => null,
        ]);
    }

    public function heartbeat(Request $request, Exam $exam, ExamAttempt $attempt): JsonResponse
    {
        $team = $request->user();
        $this->ensureTeamCanAccess($team, $exam);
        if ($attempt->team_id !== $team->id || $attempt->exam_id !== $exam->id) {
            abort(404);
        }
        $this->attemptService->heartbeat($attempt);

        return response()->json([
            'status' => 'success',
            'message' => 'Heartbeat tercatat.',
            'data' => ['heartbeatAt' => now()->toISOString()],
            'metadata' => (object) [],
            'error' => null,
        ]);
    }

    private function ensureTeamCanAccess(Team $team, Exam $exam): void
    {
        $team->loadMissing('registration.competition', 'currentStage');
        $exam->loadMissing('stage.competition');

        $registration = $team->registration;
        $canAccess = $registration !== null
            && $registration->competition->type === Competition::TYPE_OLIMPIADE
            && $exam->stage->competition_id === $registration->competition_id
            && $team->current_stage_id === $exam->stage_id;

        if (! $canAccess) {
            abort(403, 'Ujian tidak tersedia untuk tahap Team ini.');
        }
    }
}
