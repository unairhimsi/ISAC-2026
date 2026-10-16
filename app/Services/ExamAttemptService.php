<?php

namespace App\Services;

use App\Models\Exam;
use App\Models\ExamAnswer;
use App\Models\ExamAttempt;
use App\Models\ExamQuestion;
use App\Models\Team;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class ExamAttemptService
{
    public function __construct(
        private readonly ExamScoringService $scoringService,
        private readonly ExamDetectionService $detectionService,
    ) {}

    public function start(Team $team, Exam $exam, ?string $deviceId = null, ?string $ip = null, ?string $userAgent = null): array
    {
        $team->loadMissing('registration.competition', 'currentStage');
        $exam->loadMissing('stage');
        $now = now();

        if ($exam->start_date && $now->lt($exam->start_date)) {
            abort(403, 'Ujian belum dimulai.');
        }
        if ($exam->end_date && $now->gt($exam->end_date)) {
            abort(403, 'Ujian sudah berakhir.');
        }

        return DB::transaction(function () use ($team, $exam, $now, $deviceId, $ip, $userAgent) {
            $count = ExamAttempt::where('team_id', $team->id)->where('exam_id', $exam->id)->lockForUpdate()->count();
            if ($count >= $exam->max_attempts) {
                abort(response()->json([
                    'status' => 'error',
                    'message' => 'Batas percobaan tercapai.',
                    'data' => null,
                    'metadata' => (object) [],
                    'error' => ['code' => 'MAX_ATTEMPTS_REACHED'],
                ], 409));
            }

            $duration = (int) $exam->duration;
            $endTime = $now->copy()->addMinutes($duration);
            if ($exam->end_date && $endTime->gt($exam->end_date)) {
                $endTime = $exam->end_date;
            }

            $questions = $exam->questions()->where('is_active', true)->orderBy('order')->get();
            $maxPossible = $questions->sum(fn ($q) => (int) $q->correct_score);
            $questionOrder = $questions->pluck('id')->toArray();

            if ($exam->shuffle_questions) {
                $shuffled = collect($questionOrder)->shuffle()->values()->toArray();
                $questionOrder = $shuffled;
                $questions = $questions->sortBy(fn ($q) => array_search($q->id, $questionOrder))->values();
            }

            $attemptId = (string) Str::uuid();
            $metadata = [
                'questionOrder' => $questionOrder,
                'question_order' => $questionOrder,
                'device_id' => $deviceId,
            ];

            $attempt = ExamAttempt::create([
                'id' => $attemptId,
                'team_id' => $team->id,
                'exam_id' => $exam->id,
                'total_score' => 0,
                'max_possible_score' => $maxPossible,
                'start_time' => $now,
                'end_time' => $endTime,
                'finished' => false,
                'flagged' => false,
                'cheat_count' => 0,
                'suspicious_score' => 0,
                'device_id' => $deviceId,
                'ip_address' => $ip,
                'user_agent' => $userAgent ? mb_substr($userAgent, 0, 500) : null,
                'metadata' => $metadata,
            ]);

            DB::table('exam_event_logs')->insert([
                'id' => (string) Str::uuid(),
                'attempt_id' => $attempt->id,
                'type' => 'started',
                'metadata' => json_encode(['device_id' => $deviceId, 'ip' => $ip]),
                'created_at' => $now,
                'updated_at' => $now,
            ]);

            return [
                'attempt' => $attempt,
                'questions' => $questions,
                'serverTime' => $now->toISOString(),
            ];
        });
    }

    public function resume(Team $team, Exam $exam, ExamAttempt $attempt): array
    {
        if ($attempt->team_id !== $team->id || $attempt->exam_id !== $exam->id) {
            abort(404);
        }

        $attempt = $this->finalizeIfExpired($attempt);

        $questions = $exam->questions()->where('is_active', true)->get();
        $order = $attempt->metadata['questionOrder'] ?? $attempt->metadata['question_order'] ?? null;

        if (is_array($order) && ! empty($order)) {
            $questions = $questions->sortBy(fn ($q) => array_search($q->id, $order) !== false ? array_search($q->id, $order) : 999)->values();
        } else {
            $questions = $questions->sortBy('order')->values();
        }

        $answers = $attempt->answers()->whereHas('question')->get();
        $savedAnswers = $answers->map(fn ($a) => [
            'id' => $a->id,
            'questionId' => $a->question_id,
            'question_id' => $a->question_id,
            'selectedOptions' => $a->selected_options,
            'selected_options' => $a->selected_options,
            'answer' => $a->answer,
            'isCorrect' => $a->is_correct,
            'is_correct' => $a->is_correct,
            'scoreObtained' => $a->score_obtained,
            'score_obtained' => $a->score_obtained,
            'timeSpent' => $a->time_spent,
            'time_spent' => $a->time_spent,
        ])->values();

        return [
            'attempt' => $attempt,
            'questions' => $questions,
            'savedAnswers' => $savedAnswers,
            'saved_answers' => $savedAnswers,
            'serverTime' => now()->toISOString(),
        ];
    }

    public function saveAnswers(ExamAttempt $attempt, Exam $exam, array $answersPayload): int
    {
        if ($attempt->finished) {
            abort(422, 'Ujian sudah selesai.');
        }
        if ($attempt->end_time && now()->gt($attempt->end_time)) {
            abort(422, 'Waktu ujian habis.');
        }

        $questionMap = $exam->questions()->where('is_active', true)->get()->keyBy('id');
        $now = now();
        $saved = 0;

        foreach ($answersPayload as $item) {
            $qid = $item['question_id'] ?? $item['questionId'] ?? null;
            if (! $qid || ! isset($questionMap[$qid])) {
                continue;
            }
            $question = $questionMap[$qid];
            $payload = [
                'selected_options' => $item['selected_options'] ?? $item['selectedOptions'] ?? null,
                'answer' => $item['answer'] ?? null,
            ];
            $scored = $this->scoringService->score($question, $payload);
            $timeSpent = $item['time_spent'] ?? $item['timeSpent'] ?? null;
            $existing = ExamAnswer::where('attempt_id', $attempt->id)->where('question_id', $qid)->first();

            if ($existing) {
                $existing->update([
                    'selected_options' => $payload['selected_options'],
                    'answer' => $payload['answer'],
                    'is_correct' => $scored['is_correct'],
                    'score_obtained' => $scored['score_obtained'],
                    'time_spent' => $timeSpent,
                    'answered_at' => $now,
                ]);
            } else {
                ExamAnswer::create([
                    'id' => (string) Str::uuid(),
                    'attempt_id' => $attempt->id,
                    'question_id' => $qid,
                    'selected_options' => $payload['selected_options'],
                    'answer' => $payload['answer'],
                    'is_correct' => $scored['is_correct'],
                    'score_obtained' => $scored['score_obtained'],
                    'time_spent' => $timeSpent,
                    'answered_at' => $now,
                ]);
            }

            $saved++;
            DB::table('exam_event_logs')->insert([
                'id' => (string) Str::uuid(),
                'attempt_id' => $attempt->id,
                'type' => 'question_answered',
                'metadata' => json_encode(['question_id' => $qid, 'is_correct' => $scored['is_correct']]),
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }

        $attempt->touch();

        return $saved;
    }

    public function submit(Team $team, Exam $exam, ExamAttempt $attempt): ExamAttempt
    {
        if ($attempt->team_id !== $team->id || $attempt->exam_id !== $exam->id) {
            abort(404);
        }
        if ($attempt->finished) {
            return $attempt->fresh();
        }

        // Lock the row so a question deleted while the participant submits is scored exactly once.
        return DB::transaction(function () use ($attempt): ExamAttempt {
            $locked = ExamAttempt::query()->lockForUpdate()->findOrFail($attempt->id);
            if ($locked->finished) {
                return $locked;
            }

            $total = $this->totalScore($locked);
            $locked->update([
                'total_score' => $total,
                'finished' => true,
            ]);

            DB::table('exam_event_logs')->insert([
                'id' => (string) Str::uuid(),
                'attempt_id' => $locked->id,
                'type' => 'submitted',
                'metadata' => json_encode(['total_score' => $total, 'by' => 'manual']),
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            return $locked->fresh();
        });
    }

    /**
     * Take a question that is being deleted out of the scores of every attempt on its exam.
     *
     * Finished attempts are adjusted by what the question contributed instead of being re-summed, so a score an
     * admin corrected by hand keeps its correction. Running attempts only lose the question from their maximum;
     * their total is summed from the surviving questions when they are submitted. The caller owns the transaction.
     *
     * @return list<array{attempt_id: string, finished: bool, total_before: int, total_after: int, max_before: int, max_after: int, answered: bool}>
     */
    public function voidQuestion(ExamQuestion $question): array
    {
        $attempts = ExamAttempt::query()->where('exam_id', $question->exam_id)->lockForUpdate()->get();
        $answers = ExamAnswer::query()->where('question_id', $question->id)->get()->keyBy('attempt_id');
        $impact = [];

        foreach ($attempts as $attempt) {
            $answer = $answers->get($attempt->id);
            $totalBefore = (int) $attempt->total_score;
            $maxBefore = (int) $attempt->max_possible_score;

            $order = $attempt->metadata['questionOrder'] ?? $attempt->metadata['question_order'] ?? null;
            $wasInMaximum = $question->is_active && (! is_array($order) || in_array($question->id, $order, true));
            $maxAfter = $wasInMaximum ? max(0, $maxBefore - (int) $question->correct_score) : $maxBefore;

            $totalAfter = $totalBefore;
            if ($attempt->finished) {
                $contribution = match (true) {
                    $answer !== null => (int) $answer->score_obtained,
                    $question->is_active && $question->type !== 'essay' => (int) $question->empty_score,
                    default => 0,
                };
                $totalAfter = $totalBefore - $contribution;
            }

            if ($totalAfter === $totalBefore && $maxAfter === $maxBefore) {
                continue;
            }

            $attempt->update(['total_score' => $totalAfter, 'max_possible_score' => $maxAfter]);
            $impact[] = [
                'attempt_id' => $attempt->id,
                'finished' => (bool) $attempt->finished,
                'total_before' => $totalBefore,
                'total_after' => $totalAfter,
                'max_before' => $maxBefore,
                'max_after' => $maxAfter,
                'answered' => $answer !== null,
            ];
        }

        return $impact;
    }

    public function heartbeat(ExamAttempt $attempt): void
    {
        $attempt = $this->finalizeIfExpired($attempt);
        if ($attempt->finished) {
            return;
        }

        $metadata = $attempt->metadata ?? [];
        $metadata['heartbeatAt'] = now()->toISOString();
        $metadata['heartbeat_at'] = now()->toISOString();
        $attempt->update(['metadata' => $metadata]);
    }

    public function autoSubmitExpired(): int
    {
        $ids = ExamAttempt::query()
            ->where('finished', false)
            ->whereNotNull('end_time')
            ->where('end_time', '<', now())
            ->pluck('id');

        $count = 0;
        foreach ($ids as $id) {
            if ($this->finalizeExpired((string) $id) !== null) {
                $count++;
            }
        }

        return $count;
    }

    public function finalizeIfExpired(ExamAttempt $attempt): ExamAttempt
    {
        if ($attempt->finished || $attempt->end_time === null || $attempt->end_time->gte(now())) {
            return $attempt;
        }

        return $this->finalizeExpired($attempt->id) ?? ($attempt->fresh() ?? $attempt);
    }

    private function totalScore(ExamAttempt $attempt): int
    {
        // Answers to questions an admin has since deleted no longer count (ExamQuestion is soft deleted).
        $answered = (int) $attempt->answers()
            ->whereNotNull('score_obtained')
            ->whereIn('question_id', ExamQuestion::query()->where('exam_id', $attempt->exam_id)->select('id'))
            ->sum('score_obtained');

        $blank = (int) ExamQuestion::query()
            ->where('exam_id', $attempt->exam_id)
            ->where('is_active', true)
            ->where('type', '!=', 'essay')
            ->whereNotIn('id', $attempt->answers()->select('question_id'))
            ->sum('empty_score');

        return $answered + $blank;
    }

    private function finalizeExpired(string $attemptId): ?ExamAttempt
    {
        return DB::transaction(function () use ($attemptId): ?ExamAttempt {
            $now = now();
            $attempt = ExamAttempt::query()->lockForUpdate()->find($attemptId);

            if ($attempt === null || $attempt->finished || $attempt->end_time === null || $attempt->end_time->gte($now)) {
                return null;
            }

            $total = $this->totalScore($attempt);
            $attempt->update(['total_score' => $total, 'finished' => true]);
            DB::table('exam_event_logs')->insert([
                'id' => (string) Str::uuid(),
                'attempt_id' => $attempt->id,
                'type' => 'auto_submitted',
                'metadata' => json_encode(['total_score' => $total, 'expired_at' => $now->toISOString()]),
                'created_at' => $now,
                'updated_at' => $now,
            ]);

            return $attempt->fresh();
        });
    }
}
