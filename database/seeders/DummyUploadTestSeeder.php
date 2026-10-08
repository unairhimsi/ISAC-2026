<?php

namespace Database\Seeders;

use App\Models\Batch;
use App\Models\Competition;
use App\Models\Member;
use App\Models\Registration;
use App\Models\RegistrationStatus;
use App\Models\Stage;
use App\Models\Team;
use Illuminate\Database\Seeder;

class DummyUploadTestSeeder extends Seeder
{
    public const PASSWORD = 'password';

    public function run(): void
    {
        if (! app()->environment(['local', 'testing'])) {
            $this->command?->error('DummyUploadTestSeeder hanya boleh dijalankan di lingkungan lokal.');

            return;
        }

        $this->call(IsacDomainSeeder::class);

        $competition = Competition::query()->where('slug', 'is-olympiad')->firstOrFail();

        $this->team('dummy.start@isac.test', 'ISAC-TM-901', 'Dummy Start');
        $this->registered($this->team('dummy.biodata@isac.test', 'ISAC-TM-902', 'Dummy Biodata'), $competition, 1);
        $this->registered($this->team('dummy.payment@isac.test', 'ISAC-TM-903', 'Dummy Payment'), $competition, 3);
        $this->verifiedInSubmissionStage(Competition::query()->where('slug', 'business-plan-competition')->firstOrFail());
    }

    private function verifiedInSubmissionStage(Competition $competition): void
    {
        $stage = Stage::query()->where('competition_id', $competition->id)->orderBy('order')->firstOrFail();
        $stage->update(['start_date' => now()->subDay(), 'end_date' => now()->addDays(14)]);

        $batch = Batch::query()->where('competition_id', $competition->id)->orderByDesc('start_date')->firstOrFail();
        $team = $this->team('dummy.submission@isac.test', 'ISAC-TM-904', 'Dummy Submission');
        $team->update([
            'status' => Team::STATUS_VERIFIED,
            'verified_at' => now(),
            'current_stage_id' => $stage->id,
            'document_url' => 'https://drive.google.com/drive/folders/dummy',
            'twibbon_url' => 'https://drive.google.com/drive/folders/dummy-twibbon',
        ]);

        Registration::query()->updateOrCreate(['team_id' => $team->id], [
            'competition_id' => $competition->id,
            'batch_id' => $batch->id,
            'status' => RegistrationStatus::VERIFIED,
            'amount_paid' => $batch->price,
            'payment_required_at' => now(),
            'payment_submitted_at' => now(),
            'paid_at' => now(),
            'submitted_at' => now(),
            'team_completed_at' => now(),
            'members_completed_at' => now(),
            'documents_completed_at' => now(),
        ]);
    }

    private function team(string $email, string $code, string $name): Team
    {
        return Team::query()->updateOrCreate(['email' => $email], [
            'code' => $code,
            'name' => $name,
            'password' => self::PASSWORD,
            'phone' => '081234567890',
            'institution_name' => 'SMA Negeri 1 Dummy',
            'institution_address' => json_encode(['province' => 'Jawa Timur', 'city' => 'Surabaya', 'address' => 'Jl. Dummy No. 1']),
            'status' => Team::STATUS_INCOMPLETE,
            'email_verified_at' => now(),
        ]);
    }

    private function registered(Team $team, Competition $competition, int $completedSteps): void
    {
        $now = now();

        Registration::query()->updateOrCreate(['team_id' => $team->id], [
            'competition_id' => $competition->id,
            'batch_id' => null,
            'status' => RegistrationStatus::WAITING_PAYMENT,
            'payment_required_at' => $now,
            'team_completed_at' => $completedSteps >= 1 ? $now : null,
            'members_completed_at' => $completedSteps >= 2 ? $now : null,
            'documents_completed_at' => $completedSteps >= 3 ? $now : null,
        ]);

        if ($completedSteps >= 2) {
            Member::query()->updateOrCreate(['team_id' => $team->id, 'sort_order' => 1], [
                'name' => 'Peserta Dummy',
                'role' => 'LEADER',
                'email' => 'peserta.'.$team->code.'@isac.test',
                'student_id' => '1234567890',
            ]);
        }

        if ($completedSteps >= 3) {
            $team->update([
                'document_url' => 'https://drive.google.com/drive/folders/dummy',
                'twibbon_url' => 'https://drive.google.com/drive/folders/dummy-twibbon',
            ]);
        }
    }
}
