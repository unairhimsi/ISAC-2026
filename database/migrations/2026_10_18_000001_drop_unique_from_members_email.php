<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * One person may be registered in several competitions, so the same
     * email can legitimately appear on members of different teams. A global
     * unique index also kept soft-deleted rows occupying the address, which
     * made re-adding a removed participant fail. Same-competition duplicates
     * are enforced in DuplicateDetectionService instead. The plain
     * members_email_index created with the table stays in place.
     *
     * The index is looked up rather than dropped by name, so running this on
     * a database where it is already gone (or named differently) is safe.
     */
    public function up(): void
    {
        $names = $this->uniqueEmailIndexes();

        if ($names === []) {
            return;
        }

        Schema::table('members', function (Blueprint $table) use ($names): void {
            foreach ($names as $name) {
                $table->dropUnique($name);
            }
        });
    }

    public function down(): void
    {
        if ($this->uniqueEmailIndexes() !== []) {
            return;
        }

        Schema::table('members', function (Blueprint $table): void {
            $table->unique('email');
        });
    }

    /**
     * @return list<string>
     */
    private function uniqueEmailIndexes(): array
    {
        return collect(Schema::getIndexes('members'))
            ->filter(fn (array $index): bool => $index['unique'] && ! $index['primary'] && $index['columns'] === ['email'])
            ->pluck('name')
            ->values()
            ->all();
    }
};
