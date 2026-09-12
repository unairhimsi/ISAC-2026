<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // SQLite (used in tests via :memory:) does not support MODIFY COLUMN enum syntax.
        // The base migration 2026_06_19_000010 already creates the table with the new
        // enum including OLIMPIADE/tryout for fresh databases. This alter is only
        // needed for existing MySQL installations that were migrated before the enum
        // was extended.
        if (DB::getDriverName() === 'sqlite') {
            return;
        }

        // Extend exams.type enum to support Olimpiade competitive exams and Tryout
        // while keeping backward compatibility with existing multiple_choice/essay/mixed.
        DB::statement("ALTER TABLE exams MODIFY COLUMN type ENUM('multiple_choice','essay','mixed','OLIMPIADE','tryout') NOT NULL DEFAULT 'multiple_choice'");
    }

    public function down(): void
    {
        if (DB::getDriverName() === 'sqlite') {
            return;
        }

        DB::statement("ALTER TABLE exams MODIFY COLUMN type ENUM('multiple_choice','essay','mixed') NOT NULL DEFAULT 'multiple_choice'");
    }
};
