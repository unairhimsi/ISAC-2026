<?php

use App\Models\Admin;
use App\Models\Competition;
use App\Models\Exam;
use App\Models\Stage;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;

uses(LazilyRefreshDatabase::class);

function scheduleStage(): Stage
{
    $competition = Competition::factory()->create(['type' => Competition::TYPE_OLIMPIADE]);

    return Stage::query()->create([
        'id' => (string) Str::uuid(), 'competition_id' => $competition->id,
        'name' => 'Penyisihan', 'type' => 'exam', 'order' => 1,
    ]);
}

function scheduleExam(Stage $stage, string $title): Exam
{
    return Exam::query()->create([
        'id' => (string) Str::uuid(), 'stage_id' => $stage->id, 'title' => $title,
        'start_date' => '2026-01-01 08:00:00', 'end_date' => '2026-01-01 10:00:00',
    ]);
}

function stagePayload(Stage $stage, array $overrides = []): array
{
    return array_merge([
        'name' => $stage->name, 'type' => 'exam', 'order' => 1, 'is_active' => true,
    ], $overrides);
}

test('updating stage dates also moves the exams of that stage', function (): void {
    $admin = Admin::factory()->create(['role' => 'admin_registration', 'is_active' => true]);
    $stage = scheduleStage();
    $exam = scheduleExam($stage, 'Ujian 1');
    $other = scheduleExam(scheduleStage(), 'Ujian tahap lain');

    $this->withToken($admin->createToken('t')->plainTextToken)
        ->patchJson("/api/admin/stages/{$stage->id}", stagePayload($stage, [
            'start_date' => '2026-11-10T09:00:00', 'end_date' => '2026-11-10T11:30:00',
        ]))->assertOk();

    $exam->refresh();
    expect($exam->start_date->equalTo(Carbon::parse('2026-11-10 09:00:00', 'Asia/Jakarta')))->toBeTrue()
        ->and($exam->end_date->equalTo(Carbon::parse('2026-11-10 11:30:00', 'Asia/Jakarta')))->toBeTrue()
        ->and($other->refresh()->start_date->toDateString())->toBe('2026-01-01');
});

test('clearing stage dates leaves exam windows untouched', function (): void {
    $admin = Admin::factory()->create(['role' => 'admin_registration', 'is_active' => true]);
    $stage = scheduleStage();
    $stage->update(['start_date' => '2026-02-01 08:00:00', 'end_date' => '2026-02-01 10:00:00']);
    $exam = scheduleExam($stage, 'Ujian 1');

    $this->withToken($admin->createToken('t')->plainTextToken)
        ->patchJson("/api/admin/stages/{$stage->id}", stagePayload($stage, ['start_date' => null, 'end_date' => null]))
        ->assertOk();

    expect($exam->refresh()->start_date->toDateString())->toBe('2026-01-01');
});

test('changing only the hour of a stage is reflected by the admin exam endpoint', function (): void {
    $admin = Admin::factory()->create(['role' => 'super_admin', 'is_active' => true]);
    $token = $admin->createToken('t')->plainTextToken;
    $stage = scheduleStage();
    $stage->update(['start_date' => '2026-11-10 09:00:00', 'end_date' => '2026-11-10 11:00:00']);
    $exam = scheduleExam($stage, 'Ujian 1');
    $exam->update(['start_date' => '2026-11-10 09:00:00', 'end_date' => '2026-11-10 11:00:00']);

    // Tanggal sama, hanya jam yang digeser (seperti input datetime-local dari form tahap).
    $this->withToken($token)->patchJson("/api/admin/stages/{$stage->id}", stagePayload($stage, [
        'start_date' => '2026-11-10T13:15:00', 'end_date' => '2026-11-10T15:45:00',
    ]))->assertOk();

    $data = $this->withToken($token)->getJson("/api/admin/exams/{$exam->id}")->assertOk()->json('data');

    expect(Carbon::parse($data['startDate'])->setTimezone('Asia/Jakarta')->format('Y-m-d H:i:s'))->toBe('2026-11-10 13:15:00')
        ->and(Carbon::parse($data['endDate'])->setTimezone('Asia/Jakarta')->format('Y-m-d H:i:s'))->toBe('2026-11-10 15:45:00');
});
