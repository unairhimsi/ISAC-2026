<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\StoreExamQuestionRequest;
use App\Http\Requests\Admin\UpdateExamRequest;
use App\Models\Admin;
use App\Models\Competition;
use App\Models\Exam;
use App\Models\ExamAnswer;
use App\Models\ExamQuestion;
use App\Models\Stage;
use App\Services\ExamAttemptService;
use App\Services\RichTextSanitizer;
use App\Services\SecurityAuditService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class AdminExamController extends Controller
{
    public function stages(Request $request): JsonResponse
    {
        $this->authorize($request);

        $stages = Stage::query()
            ->whereHas('competition', fn ($query) => $query->where('type', Competition::TYPE_OLIMPIADE))
            ->has('exams')
            ->orderBy('order')
            ->get(['id', 'competition_id', 'name', 'description', 'order', 'start_date', 'end_date'])
            ->map(fn (Stage $stage) => [
                'id' => $stage->id,
                'competitionId' => $stage->competition_id,
                'name' => $stage->name,
                'description' => $stage->description,
                'order' => $stage->order,
                'startDate' => $stage->start_date?->toISOString(),
                'endDate' => $stage->end_date?->toISOString(),
            ]);

        return $this->success('Tahap ujian berhasil diambil.', $stages);
    }

    public function exams(Request $request): JsonResponse
    {
        $this->authorize($request);
        $data = $request->validate(['stage_id' => ['required', 'uuid', 'exists:stages,id']]);

        $this->ensureOlympiadExamStage($data['stage_id']);
        $exams = Exam::query()
            ->where('stage_id', $data['stage_id'])
            ->withCount('questions')
            ->orderBy('start_date')
            ->get()
            ->map(fn (Exam $exam) => $this->examData($exam));

        return $this->success('Daftar ujian berhasil diambil.', $exams);
    }

    public function show(Request $request, Exam $exam): JsonResponse
    {
        $this->authorize($request);
        $exam->loadCount(['questions', 'attempts']);

        $this->ensureOlympiadExam($exam);

        return $this->success('Detail ujian berhasil diambil.', [
            ...$this->examData($exam),
            'questions' => $exam->questions()->orderBy('order')->get()->map(fn (ExamQuestion $question) => $this->questionData($question)),
        ]);
    }

    public function storeQuestion(StoreExamQuestionRequest $request, Exam $exam, RichTextSanitizer $sanitizer): JsonResponse
    {
        $this->authorize($request);
        $data = $request->validated();
        $this->ensureOlympiadExam($exam);
        $question = $sanitizer->clean($data['question']);

        if (! $sanitizer->hasContent($question)) {
            throw ValidationException::withMessages(['question' => ['Isi soal tidak boleh kosong.']]);
        }

        $options = collect($data['options'] ?? [])
            ->map(fn (array $option) => ['id' => $option['id'], 'content' => $sanitizer->clean($option['content'])])
            ->values()
            ->all();

        if (in_array($data['type'], ['multiple_choice', 'true_false'], true)) {
            if (count($options) < 2) {
                throw ValidationException::withMessages(['options' => ['Pilihan jawaban minimal dua.']]);
            }
            if (! in_array($data['correct_answer'] ?? null, array_column($options, 'id'), true)) {
                throw ValidationException::withMessages(['correct_answer' => ['Jawaban benar harus menunjuk salah satu pilihan.']]);
            }
        } else {
            $data['correct_answer'] = $sanitizer->clean($data['correct_answer'] ?? null);
        }

        $order = ((int) $exam->questions()->max('order')) + 1;
        $created = $exam->questions()->create([
            ...$data,
            'question' => $question,
            'explanation' => $sanitizer->clean($data['explanation'] ?? null),
            'options' => $options ?: null,
            'order' => $order,
            'is_active' => $data['is_active'] ?? true,
        ]);

        return $this->success('Soal berhasil dibuat.', $this->questionData($created));
    }

    public function destroyQuestion(Request $request, Exam $exam, ExamQuestion $question, ExamAttemptService $attempts): JsonResponse
    {
        $this->authorize($request);
        $this->ensureOlympiadExam($exam);
        abort_unless($question->exam_id === $exam->id, 404);

        $admin = $request->user();

        $impact = DB::transaction(function () use ($question, $exam, $admin, $request, $attempts): array {
            // Re-read under lock: a second delete that raced past route binding must not rescore the attempts twice.
            $locked = ExamQuestion::query()->lockForUpdate()->find($question->id);
            abort_if($locked === null, 404);

            // Participants may already have answered it. The question is soft deleted, so their answers stay for
            // review, but the question leaves every score (see ExamAttemptService::voidQuestion).
            $impact = $attempts->voidQuestion($locked);
            $answersVoided = ExamAnswer::query()->where('question_id', $locked->id)->count();
            $locked->delete();

            DB::table('admin_audit_logs')->insert([
                'id' => (string) Str::uuid(),
                'admin_id' => $admin->id,
                'action' => 'exam.question_deleted',
                'subject_type' => ExamQuestion::class,
                'subject_id' => $locked->id,
                'before_data' => json_encode([
                    'exam_id' => $exam->id,
                    'order' => $locked->order,
                    'type' => $locked->type,
                    'preview' => Str::limit(trim(strip_tags((string) $locked->question)), 200),
                ]),
                'after_data' => json_encode([
                    'attempts_recalculated' => count($impact),
                    'answers_voided' => $answersVoided,
                    'attempts' => $impact,
                ]),
                'reason' => null,
                'request_id' => $request->header('X-Request-ID'),
                'created_at' => now(),
            ]);

            return ['attemptsRecalculated' => count($impact), 'answersVoided' => $answersVoided];
        });

        app(SecurityAuditService::class)->record('exam.question_deleted', $admin, [
            'exam_id' => $exam->id,
            'question_id' => $question->id,
            'attempts_recalculated' => $impact['attemptsRecalculated'],
        ]);

        return $this->success('Soal berhasil dihapus.', $impact);
    }

    public function update(UpdateExamRequest $request, Exam $exam): JsonResponse
    {
        $this->authorize($request);
        $this->ensureOlympiadExam($exam);
        $data = $request->validated();
        $payload = [];

        if (array_key_exists('title', $data)) {
            $payload['title'] = $data['title'];
        }
        if (array_key_exists('description', $data)) {
            $payload['description'] = $data['description'];
        }
        if (array_key_exists('start_date', $data)) {
            $payload['start_date'] = $data['start_date'];
        } elseif (array_key_exists('startDate', $data)) {
            $payload['start_date'] = $data['startDate'];
        }
        if (array_key_exists('end_date', $data)) {
            $payload['end_date'] = $data['end_date'];
        } elseif (array_key_exists('endDate', $data)) {
            $payload['end_date'] = $data['endDate'];
        }
        if (array_key_exists('duration', $data)) {
            $payload['duration'] = $data['duration'];
        }
        if (array_key_exists('max_attempts', $data)) {
            $payload['max_attempts'] = $data['max_attempts'];
        } elseif (array_key_exists('maxAttempts', $data)) {
            $payload['max_attempts'] = $data['maxAttempts'];
        }
        if (array_key_exists('shuffle_questions', $data)) {
            $payload['shuffle_questions'] = $data['shuffle_questions'];
        } elseif (array_key_exists('shuffleQuestions', $data)) {
            $payload['shuffle_questions'] = $data['shuffleQuestions'];
        }
        if (array_key_exists('shuffle_options', $data)) {
            $payload['shuffle_options'] = $data['shuffle_options'];
        } elseif (array_key_exists('shuffleOptions', $data)) {
            $payload['shuffle_options'] = $data['shuffleOptions'];
        }
        if (array_key_exists('show_result_immediately', $data)) {
            $payload['show_result_immediately'] = $data['show_result_immediately'];
        } elseif (array_key_exists('showResultImmediately', $data)) {
            $payload['show_result_immediately'] = $data['showResultImmediately'];
        }
        if (array_key_exists('passing_score', $data)) {
            $payload['passing_score'] = $data['passing_score'];
        } elseif (array_key_exists('passingScore', $data)) {
            $payload['passing_score'] = $data['passingScore'];
        }

        $start = isset($payload['start_date']) ? Carbon::parse($payload['start_date']) : $exam->start_date;
        $end = isset($payload['end_date']) ? Carbon::parse($payload['end_date']) : $exam->end_date;

        if ($start !== null && $end !== null && $end->lessThanOrEqualTo($start)) {
            throw ValidationException::withMessages(['end_date' => ['Waktu selesai harus setelah waktu mulai.']]);
        }

        $exam->update($payload);
        $exam->loadCount('questions');

        return $this->success('Ujian berhasil diperbarui.', $this->examData($exam));
    }

    private function ensureOlympiadExamStage(string $stageId): void
    {
        $isOlympiadStage = Stage::query()
            ->whereKey($stageId)
            ->whereHas('competition', fn ($query) => $query->where('type', Competition::TYPE_OLIMPIADE))
            ->exists();

        abort_unless($isOlympiadStage, 404);
    }

    private function ensureOlympiadExam(Exam $exam): void
    {
        $exam->loadMissing('stage.competition');

        abort_unless($exam->stage->competition->type === Competition::TYPE_OLIMPIADE, 404);
    }

    private function authorize(Request $request): void
    {
        /** @var Admin $admin */
        $admin = $request->user();
        Gate::forUser($admin)->authorize('author', [Exam::class]);
    }

    private function examData(Exam $exam): array
    {
        return [
            'id' => $exam->id,
            'stageId' => $exam->stage_id,
            'title' => $exam->title,
            'description' => $exam->description,
            'startDate' => $exam->start_date?->toISOString(),
            'endDate' => $exam->end_date?->toISOString(),
            'questionCount' => $exam->questions_count,
            'attemptCount' => $exam->attempts_count,
            'duration' => $exam->duration,
            'maxAttempts' => $exam->max_attempts,
            'shuffleQuestions' => $exam->shuffle_questions,
            'shuffleOptions' => $exam->shuffle_options,
            'showResultImmediately' => $exam->show_result_immediately,
            'passingScore' => $exam->passing_score,
            'type' => $exam->type,
        ];
    }

    /** @return array<string, mixed> */
    private function questionData(ExamQuestion $question): array
    {
        return [
            'id' => $question->id,
            'question' => $question->question,
            'explanation' => $question->explanation,
            'type' => $question->type,
            'options' => $question->options,
            'correctAnswer' => $question->correct_answer,
            'order' => $question->order,
            'correctScore' => $question->correct_score,
            'wrongScore' => $question->wrong_score,
            'emptyScore' => $question->empty_score,
            'difficulty' => $question->difficulty,
            'category' => $question->category,
            'tags' => $question->tags,
            'isActive' => $question->is_active,
        ];
    }

    private function success(string $message, mixed $data): JsonResponse
    {
        return response()->json([
            'status' => 'success',
            'message' => $message,
            'data' => $data,
            'metadata' => (object) [],
            'error' => null,
        ]);
    }
}
