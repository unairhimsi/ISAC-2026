<?php

namespace App\Jobs;

use App\Mail\CompetitionOperationMail;
use App\Models\SpreadsheetIntegrationEvent;
use App\Services\Integrations\SpreadsheetIntegrationClient;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Throwable;

class SendCompetitionAnnouncementJob implements ShouldQueue
{
    use Queueable;

    public int $tries = 3;

    public function __construct(public readonly string $eventId) {}

    public function backoff(): array
    {
        return [60, 300, 900];
    }

    public function handle(SpreadsheetIntegrationClient $client): void
    {
        // Jika email operation dialihkan ke Apps Script, jangan kirim via Brevo.
        // Auth (verification/OTP) tetap via Brevo karena tidak lewat SpreadsheetIntegrationEvent.
        if ((bool) config('services.google_sheet.email_via_apps_script', true)) {
            $check = SpreadsheetIntegrationEvent::query()->where('event_id', $this->eventId)->first();
            $action = data_get($check?->payload, 'action');
            if ($action === 'ANNOUNCE_RESULT' || $check?->action === 'ANNOUNCE_RESULT') {
                // Apps Script sudah kirim email langsung saat batch-upsert, jadi skip Brevo.
                return;
            }
        }

        $event = DB::transaction(function (): ?SpreadsheetIntegrationEvent {
            $event = SpreadsheetIntegrationEvent::query()
                ->where('event_id', $this->eventId)
                ->lockForUpdate()
                ->first();

            if ($event === null || in_array($event->email_status, ['SENT', 'NOT_REQUESTED'], true)) {
                return null;
            }

            $event->update(['email_status' => 'PROCESSING', 'email_last_error' => null]);

            return $event->fresh();
        });

        if ($event === null) {
            return;
        }

        $recipient = data_get($event->payload, 'team.email');

        if (! is_string($recipient) || ! filter_var($recipient, FILTER_VALIDATE_EMAIL)) {
            $error = 'Alamat email Team tidak valid.';
            $event->update(['email_status' => 'FAILED', 'email_last_error' => $error]);
            $client->updateDeliveryStatus($event->event_id, 'FAILED', lastError: $error);

            return;
        }

        try {
            Mail::to($recipient)->send(new CompetitionOperationMail($event->payload));

            $event->update([
                'email_status' => 'SENT',
                'email_sent_at' => now(),
                'email_last_error' => null,
            ]);

            $client->updateDeliveryStatus(
                $event->event_id,
                'SENT',
                sentAt: now()->toISOString(),
            );
        } catch (Throwable $exception) {
            $error = str($exception->getMessage())->limit(2000)->toString();
            $event->update([
                'email_status' => 'FAILED',
                'email_last_error' => $error,
            ]);

            try {
                $client->updateDeliveryStatus(
                    $event->event_id,
                    'FAILED',
                    retryCount: $this->attempts(),
                    lastError: $error,
                );
            } catch (Throwable) {
                // The event remains retryable by the queue; do not hide the original mail failure.
            }

            throw $exception;
        }
    }
}
