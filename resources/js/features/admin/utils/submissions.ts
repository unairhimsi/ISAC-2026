import type { AdminSubmissionAction, AdminSubmissionStatus } from '../types/adminTypes'

export const submissionStatusMeta: Record<AdminSubmissionStatus, { label: string; tone: string }> = {
  draft: { label: 'Draft', tone: 'border-muted-foreground/25 bg-muted text-muted-foreground' },
  submitted: { label: 'Menunggu ditinjau', tone: 'border-secondary/25 bg-secondary/10 text-secondary' },
  under_review: { label: 'Sedang ditinjau', tone: 'border-primary/25 bg-primary/10 text-primary' },
  revision_requested: { label: 'Perlu revisi', tone: 'border-amber-400/25 bg-amber-400/10 text-amber-300' },
  approved: { label: 'Disetujui', tone: 'border-accent/25 bg-accent/10 text-accent' },
  rejected: { label: 'Ditolak', tone: 'border-destructive/25 bg-destructive/10 text-destructive' },
}

export const reviewActionLabels: Record<AdminSubmissionAction, string> = {
  under_review: 'Mulai tinjau',
  approved: 'Setujui',
  revision_requested: 'Minta revisi',
  rejected: 'Tolak',
}

/** Mirrors JudgingService::assertTransition so the form only offers moves the server accepts. */
export function availableReviewActions(status: AdminSubmissionStatus): AdminSubmissionAction[] {
  if (status === 'submitted') return ['under_review', 'approved', 'revision_requested', 'rejected']
  if (status === 'under_review') return ['approved', 'revision_requested', 'rejected']
  if (status === 'approved') return ['revision_requested']
  return []
}

/** Only http(s) links from the file store are rendered as links. */
export function safeFileUrl(url: string | null | undefined): string | null {
  return url && /^https?:\/\//i.test(url) ? url : null
}
