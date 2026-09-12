<?php

namespace App\Console\Commands;

use App\Services\ExamAttemptService;
use Illuminate\Console\Command;

class AutoSubmitExpiredAttempts extends Command
{
    protected $signature = 'exam:auto-submit-expired';

    protected $description = 'Auto submit expired exam attempts';

    public function handle(ExamAttemptService $service): int
    {
        $count = $service->autoSubmitExpired();
        $this->info("Auto submitted {$count} attempts.");

        return self::SUCCESS;
    }
}
