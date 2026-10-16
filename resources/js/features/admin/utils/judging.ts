import type { AdminAttemptAnswer, AdminExamAttempt } from '../types/adminTypes'

export function formatDateTime(value: string | null | undefined, dateStyle: 'medium' | 'long' = 'medium') {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('id-ID', { dateStyle, timeStyle: 'short' }).format(date)
}

export function formatDuration(seconds: number | null | undefined) {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds) || seconds < 0) return '—'
  const total = Math.round(seconds)
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const rest = total % 60
  const parts = [hours > 0 && `${hours} j`, minutes > 0 && `${minutes} mnt`, (rest > 0 || total === 0) && hours === 0 && `${rest} dtk`].filter(Boolean)
  return parts.join(' ')
}

export function attemptDurationSeconds(attempt: Pick<AdminExamAttempt, 'startTime' | 'endTime'>) {
  if (!attempt.startTime || !attempt.endTime) return null
  const diff = (new Date(attempt.endTime).getTime() - new Date(attempt.startTime).getTime()) / 1000
  return Number.isFinite(diff) && diff >= 0 ? diff : null
}

export function scorePercent(score: number | null | undefined, max: number | null | undefined) {
  if (score === null || score === undefined || !max || max <= 0) return null
  return Math.max(0, Math.min(100, Math.round((score / max) * 100)))
}

export const cheatEventLabels: Record<string, string> = {
  tab_switched: 'Pindah tab',
  window_blurred: 'Jendela kehilangan fokus',
  window_focused: 'Jendela kembali fokus',
  copy_attempted: 'Mencoba menyalin',
  paste_attempted: 'Mencoba menempel',
  right_click_attempted: 'Klik kanan',
  devtools_opened: 'Membuka devtools',
  screenshot_attempted: 'Mencoba screenshot',
  fullscreen_exited: 'Keluar layar penuh',
}

export function cheatEventLabel(type: string) {
  return cheatEventLabels[type] ?? type.replace(/_/g, ' ')
}

export type AnswerVerdict = 'correct' | 'wrong' | 'empty' | 'essay' | 'deleted'

export function hasAnswerContent(answer: AdminAttemptAnswer) {
  const selected = Array.isArray(answer.selectedOptions) ? answer.selectedOptions.filter(Boolean) : []
  return selected.length > 0 || Boolean(answer.answer?.trim())
}

export function answerVerdict(answer: AdminAttemptAnswer): AnswerVerdict {
  if (answer.questionDeleted) return 'deleted'
  if (answer.question?.type === 'essay') return 'essay'
  if (!hasAnswerContent(answer)) return 'empty'
  return answer.isCorrect ? 'correct' : 'wrong'
}
