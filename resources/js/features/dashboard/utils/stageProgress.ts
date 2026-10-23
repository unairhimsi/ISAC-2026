import type { SubmissionData } from '../types/dashboardTypes'

export type StageWindow = 'upcoming' | 'open' | 'closed'

export function stageWindow(startDate: string | null, endDate: string | null, now = Date.now()): StageWindow {
  if (startDate && now < new Date(startDate).getTime()) return 'upcoming'
  if (endDate && now > new Date(endDate).getTime()) return 'closed'
  return 'open'
}

export const stageWindowCopy: Record<StageWindow, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
  upcoming: { label: 'Belum dibuka', variant: 'outline' },
  open: { label: 'Dibuka', variant: 'default' },
  closed: { label: 'Ditutup', variant: 'secondary' },
}

export const submissionStatusCopy: Record<SubmissionData['status'], { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  draft: { label: 'Draft, belum dikumpulkan', variant: 'outline' },
  submitted: { label: 'Menunggu ditinjau juri', variant: 'secondary' },
  under_review: { label: 'Sedang ditinjau juri', variant: 'secondary' },
  revision_requested: { label: 'Perlu revisi', variant: 'outline' },
  approved: { label: 'Disetujui', variant: 'default' },
  rejected: { label: 'Ditolak', variant: 'destructive' },
}
