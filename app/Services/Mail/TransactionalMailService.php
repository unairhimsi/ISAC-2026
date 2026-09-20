<?php

namespace App\Services\Mail;

use App\Mail\AmbiguousAccountWarningMail;
use App\Mail\DuplicateMemberWarningMail;
use App\Mail\ResetPasswordMail;
use App\Mail\VerifyEmailMail;
use Illuminate\Mail\Mailable;
use Illuminate\Support\Facades\Mail;
use LogicException;

class TransactionalMailService
{
    public function __construct(
        private readonly BrevoTransactionalMailClient $brevo,
    ) {}

    public function sendVerificationCode(string $recipientEmail, string $code): void
    {
        $this->deliver($recipientEmail, new VerifyEmailMail($code));
    }

    public function sendResetPasswordCode(string $recipientEmail, string $code): void
    {
        $this->deliver($recipientEmail, new ResetPasswordMail($code));
    }

    public function sendDuplicateMemberWarning(
        string $recipientEmail,
        string $existingTeamCode,
        string $existingTeamName,
        string $incomingTeamCode,
        string $incomingTeamName,
        string $conflictKind,
        string $conflictValue,
    ): void {
        $this->deliver($recipientEmail, new DuplicateMemberWarningMail(
            existingTeamCode: $existingTeamCode,
            existingTeamName: $existingTeamName,
            incomingTeamCode: $incomingTeamCode,
            incomingTeamName: $incomingTeamName,
            conflictKind: $conflictKind,
            conflictValue: $conflictValue,
        ));
    }

    public function sendAmbiguousAccountWarning(string $recipientEmail): void
    {
        $this->deliver($recipientEmail, new AmbiguousAccountWarningMail(email: $recipientEmail));
    }

    private function deliver(string $recipientEmail, Mailable $mailable): void
    {
        $transport = (string) config('mail.transactional_transport', 'smtp');

        if (app()->environment('testing') || $transport === 'smtp') {
            Mail::to($recipientEmail)->send($mailable);

            return;
        }

        if ($transport !== 'brevo') {
            throw new LogicException('Unsupported transactional mail transport.');
        }

        $this->brevo->send($recipientEmail, $mailable);
    }
}
