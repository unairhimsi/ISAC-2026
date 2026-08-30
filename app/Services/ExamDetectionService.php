<?php

namespace App\Services;

use App\Models\ExamAttempt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class ExamDetectionService
{
    public const WEIGHTS = [
        'tab_switched' => 5,
        'window_blurred' => 5,
        'window_focused' => 0,
        'copy_attempted' => 10,
        'paste_attempted' => 15,
        'right_click_attempted' => 3,
        'devtools_opened' => 25,
        'screenshot_attempted' => 12,
        'fullscreen_exited' => 8,
        'tab5' => 5,
        'window5' => 5,
        'fullscreen8' => 8,
        'copy10' => 10,
        'paste15' => 15,
        'right3' => 3,
        'devtools25' => 25,
    ];

    public function accumulate(ExamAttempt $attempt, array $events, ?string $incomingDeviceId = null): array
    {
        $weights = self::WEIGHTS;
        $sum = 0;
        $now = now();
        $rows = [];
        $existingDevice = $attempt->device_id ?? ($attempt->metadata['device_id'] ?? null) ?? null;
        $deviceDrift = false;

        if ($incomingDeviceId !== null && $existingDevice !== null && $incomingDeviceId !== $existingDevice) {
            $deviceDrift = true;
            $sum += 20;
        }

        foreach ($events as $ev) {
            $type = $ev['type'] ?? $ev['event_type'] ?? null;
            if ($type === null) {
                continue;
            }

            $weight = $weights[$type] ?? 5;

            if (str_contains($type, 'tab')) {
                $weight = $weights['tab_switched'];
            }
            if (str_contains($type, 'window_blurred')) {
                $weight = $weights['window_blurred'];
            }
            if (str_contains($type, 'fullscreen')) {
                $weight = $weights['fullscreen_exited'];
            }
            if (str_contains($type, 'copy')) {
                $weight = $weights['copy_attempted'];
            }
            if (str_contains($type, 'paste')) {
                $weight = $weights['paste_attempted'];
            }
            if (str_contains($type, 'right_click')) {
                $weight = $weights['right_click_attempted'];
            }
            if (str_contains($type, 'devtools')) {
                $weight = $weights['devtools_opened'];
            }
            if (str_contains($type, 'screenshot')) {
                $weight = $weights['screenshot_attempted'];
            }

            $sum += $weight;

            $rows[] = [
                'id' => (string) Str::uuid(),
                'attempt_id' => $attempt->id,
                'type' => $this->mapToEnum($type),
                'metadata' => json_encode(array_merge($ev['metadata'] ?? [], [
                    'client_at' => $ev['client_at'] ?? $ev['clientAt'] ?? null,
                    'raw_type' => $type,
                    'weight' => $weight,
                    'device_drift' => $deviceDrift,
                ])),
                'created_at' => $now,
                'updated_at' => $now,
            ];
        }

        if (! empty($rows)) {
            DB::table('exam_event_logs')->insert($rows);
        }

        $newSuspicious = min(999, (int) $attempt->suspicious_score + $sum);
        $newCheat = (int) $attempt->cheat_count + count($events);
        $flagged = (bool) $attempt->flagged;

        if ($newSuspicious >= 50 || $newCheat >= 5) {
            $flagged = true;
        }

        $attempt->update([
            'suspicious_score' => $newSuspicious,
            'cheat_count' => $newCheat,
            'flagged' => $flagged,
        ]);

        if ($incomingDeviceId !== null && $existingDevice === null) {
            $attempt->update(['device_id' => $incomingDeviceId]);
        }

        return [
            'suspiciousScore' => $newSuspicious,
            'flagged' => $flagged,
            'cheatCount' => $newCheat,
        ];
    }

    private function mapToEnum(string $type): string
    {
        $map = [
            'tab_switched' => 'tab_switched',
            'window_blurred' => 'window_blurred',
            'window_focused' => 'window_focused',
            'copy_attempted' => 'copy_attempted',
            'paste_attempted' => 'paste_attempted',
            'right_click_attempted' => 'right_click_attempted',
            'devtools_opened' => 'devtools_opened',
            'screenshot_attempted' => 'screenshot_attempted',
            'fullscreen_exited' => 'fullscreen_exited',
            'tab5' => 'tab_switched',
            'window5' => 'window_blurred',
            'fullscreen8' => 'fullscreen_exited',
            'copy10' => 'copy_attempted',
            'paste15' => 'paste_attempted',
            'right3' => 'right_click_attempted',
            'devtools25' => 'devtools_opened',
        ];

        return $map[$type] ?? 'suspicious_activity';
    }
}
