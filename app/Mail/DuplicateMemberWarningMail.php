<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class DuplicateMemberWarningMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public readonly string $existingTeamCode,
        public readonly string $existingTeamName,
        public readonly string $incomingTeamCode,
        public readonly string $incomingTeamName,
        public readonly string $conflictKind,
        public readonly string $conflictValue,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'Peringatan Duplikasi Peserta ISAC 2026',
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.duplicate-member-warning',
        );
    }
}
