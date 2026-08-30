<?php

namespace App\Services;

use App\Models\ExamQuestion;

class ExamScoringService
{
    public function score(ExamQuestion $question, array $payload): array
    {
        if ($question->type === 'essay') {
            return ['is_correct' => null, 'score_obtained' => null];
        }

        $selected = $payload['selected_options'] ?? null;

        if ($selected === null) {
            $normalized = [];
        } elseif (is_string($selected)) {
            $normalized = [$selected];
        } elseif (is_array($selected)) {
            $normalized = array_values(array_filter($selected, fn ($v) => $v !== null && $v !== ''));
            $normalized = array_map(fn ($v) => is_array($v) ? ($v['id'] ?? $v) : $v, $normalized);
        } else {
            $normalized = [];
        }

        if (count($normalized) === 0) {
            return ['is_correct' => false, 'score_obtained' => (int) $question->empty_score];
        }

        $correct = $question->correct_answer;
        $isCorrect = false;

        if (is_string($correct)) {
            if (count($normalized) === 1 && $normalized[0] === $correct) {
                $isCorrect = true;
            } else {
                $isCorrect = false;
            }
        } elseif (is_array($correct)) {
            sort($normalized);
            $c = $correct;
            sort($c);
            $isCorrect = $normalized === $c;
        }

        $score = $isCorrect ? (int) $question->correct_score : (int) $question->wrong_score;

        return ['is_correct' => $isCorrect, 'score_obtained' => $score];
    }
}
