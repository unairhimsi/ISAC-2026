<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The original create_exam_answers migration was edited in place (a2a70d9) to make
 * score_obtained / answered_at nullable, so databases that had already run it kept
 * `score_obtained INT NOT NULL DEFAULT 0` and `answered_at DATETIME NOT NULL`.
 * Essay answers are stored with a NULL score until graded, so every essay autosave
 * failed with "Column 'score_obtained' cannot be null" (HTTP 500) on those databases.
 * Fresh databases are already nullable; this only repairs the drifted ones.
 */
return new class extends Migration
{
    public function up(): void
    {
        $columns = collect(Schema::getColumns('exam_answers'))->keyBy('name');
        $fixScore = ! ($columns['score_obtained']['nullable'] ?? true);
        $fixAnsweredAt = ! ($columns['answered_at']['nullable'] ?? true);

        if (! $fixScore && ! $fixAnsweredAt) {
            return;
        }

        Schema::table('exam_answers', function (Blueprint $table) use ($fixScore, $fixAnsweredAt): void {
            if ($fixScore) {
                $table->integer('score_obtained')->nullable()->default(null)->change();
            }
            if ($fixAnsweredAt) {
                $table->dateTime('answered_at')->nullable()->default(null)->change();
            }
        });
    }

    public function down(): void
    {
        // Intentionally empty: restoring NOT NULL would fail on ungraded essay rows.
    }
};
