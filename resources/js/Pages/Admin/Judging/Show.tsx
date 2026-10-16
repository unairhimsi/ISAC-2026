import { Link, usePage } from '@inertiajs/react'
import { AlertTriangle, ArrowLeft, CheckCircle2, ChevronDown, ChevronUp, CircleSlash, Clock, Flag, History, Loader2, MinusCircle, PencilLine, ShieldAlert, Timer, Trash2, XCircle } from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { Seo } from '@/components/seo/Seo'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { AdminPageHeader } from '@/features/admin/components/AdminPageHeader'
import { adminPageLayout } from '@/features/admin/components/AdminShell'
import { AdminErrorState, AdminLoadingState } from '@/features/admin/components/AdminStates'
import { useAdminExamAttempt, useUpdateAdminExamAttemptScore } from '@/features/admin/hooks/useAdmin'
import type { AdminAttemptAnswer } from '@/features/admin/types/adminTypes'
import {
  answerVerdict,
  attemptDurationSeconds,
  cheatEventLabel,
  formatDateTime,
  formatDuration,
  scorePercent,
  type AnswerVerdict,
} from '@/features/admin/utils/judging'
import { cn } from '@/lib/utils'

const TIMELINE_PREVIEW = 8

const verdictMeta: Record<AnswerVerdict, { label: string; icon: ReactNode; tone: string }> = {
  correct: { label: 'Benar', icon: <CheckCircle2 />, tone: 'border-accent/25 bg-accent/10 text-accent' },
  wrong: { label: 'Salah', icon: <XCircle />, tone: 'border-destructive/25 bg-destructive/10 text-destructive' },
  empty: { label: 'Kosong', icon: <MinusCircle />, tone: 'border-muted-foreground/25 bg-muted text-muted-foreground' },
  essay: { label: 'Esai · nilai manual', icon: <PencilLine />, tone: 'border-secondary/25 bg-secondary/10 text-secondary' },
  deleted: { label: 'Soal dihapus · tidak dihitung', icon: <Trash2 />, tone: 'border-destructive/25 bg-destructive/10 text-destructive' },
}

const filterOrder: Array<AnswerVerdict | 'all'> = ['all', 'correct', 'wrong', 'empty', 'essay', 'deleted']

function Stat({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: ReactNode; tone?: string }) {
  return (
    <Card className="border-border/60 bg-card/70 backdrop-blur-md">
      <CardContent className="space-y-1 p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={cn('text-xl font-semibold tabular-nums', tone)}>{value}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  )
}

function RichHtml({ html, className }: { html: string; className?: string }) {
  // Konten soal dan pilihan dibersihkan RichTextSanitizer di server saat soal dibuat.
  return <div className={cn('prose prose-sm max-w-none dark:prose-invert', className)} dangerouslySetInnerHTML={{ __html: html }} />
}

function AnswerCard({ answer, number }: { answer: AdminAttemptAnswer; number: number }) {
  const question = answer.question
  const verdict = answerVerdict(answer)
  const meta = verdictMeta[verdict]
  const selected = new Set((answer.selectedOptions ?? []).filter(Boolean))
  const correctIds = new Set(Array.isArray(answer.correctAnswer) ? answer.correctAnswer : answer.correctAnswer ? [answer.correctAnswer] : [])
  const isEssay = question?.type === 'essay'
  const knownOptionIds = new Set((question?.options ?? []).map((option) => option.id))
  const unknownSelected = [...selected].filter((id) => !knownOptionIds.has(id))

  return (
    <article className={cn('rounded-3xl border bg-background/30 p-4 sm:p-5', verdict === 'deleted' ? 'border-destructive/30' : 'border-border/60')}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-medium">Soal {number}</span>
        <Badge variant="outline" className={cn('gap-1 font-medium', meta.tone)}>{meta.icon}{meta.label}</Badge>
      </div>

      {question ? <RichHtml html={question.question} className="mt-3" /> : <p className="mt-3 text-sm text-muted-foreground">Isi soal tidak lagi tersedia (ID {answer.questionId}).</p>}

      {isEssay ? (
        <div className="mt-4 space-y-3">
          <div>
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">Jawaban peserta</p>
            {answer.answer?.trim() ? <p className="whitespace-pre-wrap break-words rounded-2xl border border-border/60 bg-muted/30 p-3 text-sm">{answer.answer}</p> : <p className="rounded-2xl border border-dashed border-border/60 p-3 text-sm text-muted-foreground">Tidak dijawab.</p>}
          </div>
          {typeof answer.correctAnswer === 'string' && answer.correctAnswer && (
            <details className="rounded-2xl bg-accent/5 px-4 py-3">
              <summary className="cursor-pointer text-sm font-medium text-accent">Pedoman jawaban</summary>
              <RichHtml html={answer.correctAnswer} className="mt-3" />
            </details>
          )}
        </div>
      ) : question?.options?.length ? (
        <ol className="mt-4 grid gap-2">
          {question.options.map((option, index) => {
            const isSelected = selected.has(option.id)
            const isCorrect = correctIds.has(option.id)
            return (
              <li key={option.id} className={cn('flex items-start gap-3 rounded-2xl border p-3', isCorrect ? 'border-accent/30 bg-accent/10' : isSelected ? 'border-destructive/30 bg-destructive/5' : 'border-border/60 bg-muted/20')}>
                <span className={cn('flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold', isCorrect ? 'bg-accent text-accent-foreground' : isSelected ? 'bg-destructive text-white' : 'bg-muted text-muted-foreground')}>{String.fromCharCode(65 + index)}</span>
                <div className="min-w-0 flex-1">
                  <RichHtml html={option.content} />
                  {(isSelected || isCorrect) && (
                    <p className="mt-2 flex flex-wrap gap-x-3 text-xs font-semibold">
                      {isSelected && <span className={isCorrect ? 'text-accent' : 'text-destructive'}>Dipilih peserta</span>}
                      {isCorrect && <span className="text-accent">Kunci jawaban</span>}
                    </p>
                  )}
                </div>
              </li>
            )
          })}
        </ol>
      ) : null}

      {!isEssay && unknownSelected.length > 0 && (
        <p className="mt-3 rounded-2xl border border-dashed border-border/60 p-3 text-xs text-muted-foreground">Pilihan peserta tidak ada lagi di soal ini: <span className="font-mono">{unknownSelected.join(', ')}</span></p>
      )}
      {!isEssay && verdict === 'empty' && <p className="mt-3 text-sm text-muted-foreground">Peserta tidak memilih jawaban.</p>}

      <dl className="mt-4 flex flex-wrap gap-x-5 gap-y-1 border-t border-border/60 pt-3 text-xs text-muted-foreground">
        <div className="flex gap-1.5"><dt>Skor</dt><dd className="font-medium tabular-nums text-foreground">{answer.scoreObtained ?? '—'}</dd></div>
        <div className="flex gap-1.5"><dt>Waktu</dt><dd className="font-medium tabular-nums text-foreground">{formatDuration(answer.timeSpent)}</dd></div>
        <div className="flex gap-1.5"><dt>Dijawab</dt><dd className="font-medium text-foreground">{formatDateTime(answer.answeredAt)}</dd></div>
      </dl>
    </article>
  )
}

export default function AdminJudgingShow({ examId, attemptId }: { examId: string; attemptId: string }) {
  const { url } = usePage()
  const listQuery = url.includes('?') ? `?${url.split('?')[1]}` : ''
  const query = useAdminExamAttempt(examId, attemptId)
  const updateScore = useUpdateAdminExamAttemptScore(examId, attemptId)
  const data = query.data?.data
  const attempt = data?.attempt

  const [scoreInput, setScoreInput] = useState('')
  const [reason, setReason] = useState('')
  const [answerFilter, setAnswerFilter] = useState<AnswerVerdict | 'all'>('all')
  const [showAllEvents, setShowAllEvents] = useState(false)

  const currentScore = attempt?.totalScore ?? null
  useEffect(() => {
    if (currentScore !== null) setScoreInput(String(currentScore))
  }, [currentScore])

  const counts = useMemo(() => {
    const result: Record<AnswerVerdict | 'all', number> = { all: 0, correct: 0, wrong: 0, empty: 0, essay: 0, deleted: 0 }
    for (const answer of data?.answers ?? []) {
      result.all += 1
      result[answerVerdict(answer)] += 1
    }
    return result
  }, [data?.answers])

  if (query.isLoading) return <AdminLoadingState label="Memuat detail pengerjaan..." />
  if (query.error || !data || !attempt) return <AdminErrorState message={query.error?.message ?? 'Detail pengerjaan tidak ditemukan.'} retry={() => query.refetch()} />

  const max = attempt.maxPossibleScore
  const percent = scorePercent(attempt.totalScore, max)
  const duration = attemptDurationSeconds(attempt)
  const answers = data.answers.filter((answer) => answerFilter === 'all' || answerVerdict(answer) === answerFilter)
  const events = showAllEvents ? data.timeline : data.timeline.slice(0, TIMELINE_PREVIEW)
  const startMs = attempt.startTime ? new Date(attempt.startTime).getTime() : null

  const parsedScore = Number(scoreInput)
  const scoreFilled = scoreInput.trim() !== ''
  const scoreValid = scoreFilled && Number.isInteger(parsedScore) && parsedScore >= 0 && parsedScore <= max
  const scoreChanged = scoreValid && parsedScore !== (attempt.totalScore ?? 0)
  const canSubmit = scoreChanged && reason.trim().length > 0 && !updateScore.isPending
  const scoreError = scoreFilled && !scoreValid ? `Nilai harus bilangan bulat 0–${max}.` : null

  async function submitScore() {
    if (!canSubmit) return
    try {
      await updateScore.mutateAsync({ total_score: parsedScore, reason: reason.trim() })
      toast.success('Nilai diperbarui dan tercatat di audit log.')
      setReason('')
    } catch {
      // pesan galat ditampilkan dari state mutasi
    }
  }

  const teamLabel = attempt.team?.code ?? attempt.teamId

  return (
    <>
      <Seo title={`${teamLabel} · Detail Pengerjaan`} description="Detail pengerjaan Olimpiade ISAC 2026." canonical={`/admin/judging/${examId}/attempts/${attemptId}`} noindex />
      <AdminPageHeader
        title={`${teamLabel}${attempt.team?.name ? ` · ${attempt.team.name}` : ''}`}
        description={`${attempt.exam?.title ?? 'Ujian Olimpiade'}${attempt.team?.email ? ` · ${attempt.team.email}` : ''}`}
        action={<Link href={`/admin/judging${listQuery}`} className={cn(buttonVariants({ variant: 'outline' }))}><ArrowLeft />Kembali</Link>}
      />

      {attempt.flagged && (
        <div className="mb-5 flex items-start gap-3 rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm">
          <ShieldAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
          <div>
            <p className="font-medium text-destructive">Pengerjaan ini ditandai mencurigakan</p>
            <p className="mt-0.5 text-muted-foreground">Skor curiga {attempt.suspiciousScore} dengan {attempt.cheatCount} pelanggaran tercatat. Tinjau timeline sebelum memutuskan nilai. Penanda ini hanya peringatan dan tidak memblokir pengumpulan.</p>
          </div>
        </div>
      )}

      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Nilai" value={<>{attempt.totalScore ?? '—'}<span className="text-base font-normal text-muted-foreground">/{max}</span></>} hint={percent !== null ? `${percent}% dari nilai maksimum` : undefined} />
        <Stat label="Status" value={attempt.finished ? 'Selesai' : 'Berjalan'} hint={attempt.finished ? `Durasi ${formatDuration(duration)}` : 'Belum dikumpulkan'} />
        <Stat label="Skor curiga" tone={attempt.suspiciousScore >= 50 ? 'text-destructive' : undefined} value={attempt.suspiciousScore} hint={<span className={cn(attempt.cheatCount >= 5 && 'font-medium text-destructive')}>{attempt.cheatCount} pelanggaran</span>} />
        <Stat label="Mulai" value={<span className="text-base">{formatDateTime(attempt.startTime)}</span>} hint={`Selesai ${formatDateTime(attempt.endTime)}`} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,.9fr)]">
        <div className="order-2 space-y-6 xl:order-1">
          <Card className="border-border/60 bg-card/70 backdrop-blur-md">
            <CardHeader>
              <CardTitle>Jawaban ({counts.all})</CardTitle>
              <CardDescription>Jawaban peserta dibandingkan dengan kunci. Soal yang sudah dihapus tetap terbaca tetapi tidak dihitung.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2" role="group" aria-label="Filter jawaban">
                {filterOrder.filter((key) => key === 'all' || counts[key] > 0).map((key) => (
                  <button key={key} type="button" aria-pressed={answerFilter === key} onClick={() => setAnswerFilter(key)} className={cn('rounded-full border px-3 py-1 text-xs transition-colors', answerFilter === key ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background/40 text-muted-foreground hover:text-foreground')}>
                    {key === 'all' ? 'Semua' : verdictMeta[key].label.split(' · ')[0]} <span className="tabular-nums">{counts[key]}</span>
                  </button>
                ))}
              </div>
              {answers.length === 0 ? (
                <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground"><CircleSlash className="size-6" />Tidak ada jawaban pada filter ini.</div>
              ) : (
                <div className="space-y-4">{answers.map((answer, index) => <AnswerCard key={answer.id} answer={answer} number={answerFilter === 'all' ? index + 1 : data.answers.indexOf(answer) + 1} />)}</div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="order-1 space-y-6 xl:order-2 xl:self-start">
          <Card className="border-border/60 bg-card/70 backdrop-blur-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><PencilLine className="size-4 text-primary" />Perbarui Nilai Manual</CardTitle>
              <CardDescription>Setiap perubahan tercatat di audit log beserta alasannya.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <label className="block space-y-1.5 text-sm">Nilai baru (0–{max})
                <Input type="number" inputMode="numeric" min={0} max={max} step={1} value={scoreInput} onChange={(event) => { setScoreInput(event.target.value); updateScore.reset() }} aria-invalid={Boolean(scoreError)} className="h-10 rounded-3xl bg-background/60" />
              </label>
              {scoreError && <p className="text-xs text-destructive">{scoreError}</p>}
              <label className="block space-y-1.5 text-sm">Alasan perubahan
                <Textarea value={reason} onChange={(event) => { setReason(event.target.value); updateScore.reset() }} placeholder="Contoh: Koreksi jawaban esai setelah peninjauan ulang" rows={3} maxLength={2000} />
                <span className="block text-right text-xs text-muted-foreground">{reason.length}/2000</span>
              </label>
              {updateScore.error && <p className="rounded-2xl border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm text-destructive">{updateScore.error.message}</p>}
              <Button className="w-full" onClick={submitScore} disabled={!canSubmit}>{updateScore.isPending ? <><Loader2 className="animate-spin" />Menyimpan...</> : 'Simpan Nilai'}</Button>
              {!scoreChanged && scoreValid && <p className="text-xs text-muted-foreground">Ubah nilai untuk mengaktifkan tombol simpan.</p>}
            </CardContent>
          </Card>

          <Card className="border-border/60 bg-card/70 backdrop-blur-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><History className="size-4 text-primary" />Timeline Pelanggaran</CardTitle>
              <CardDescription>{data.timeline.length === 0 ? 'Tidak ada event pelanggaran tercatat.' : `${data.timeline.length} event tercatat, diurutkan dari yang paling awal.`}</CardDescription>
            </CardHeader>
            <CardContent>
              {data.timeline.length === 0 ? (
                <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground"><CheckCircle2 className="size-5 text-accent" />Pengerjaan bersih.</div>
              ) : (
                <>
                  <ol className="space-y-2">
                    {events.map((event) => {
                      const offset = startMs !== null && event.createdAt ? (new Date(event.createdAt).getTime() - startMs) / 1000 : null
                      const weight = event.metadata?.weight
                      return (
                        <li key={event.id} className="flex items-start justify-between gap-3 rounded-2xl border border-border/60 bg-background/30 px-3 py-2 text-sm">
                          <div className="min-w-0">
                            <p className="flex items-center gap-1.5 font-medium"><AlertTriangle className="size-3.5 shrink-0 text-amber-400" />{cheatEventLabel(event.type)}</p>
                            <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground"><Clock className="size-3" />{formatDateTime(event.createdAt)}</p>
                          </div>
                          <div className="shrink-0 text-right text-xs text-muted-foreground">
                            {offset !== null && offset >= 0 && <p className="flex items-center justify-end gap-1 tabular-nums"><Timer className="size-3" />+{formatDuration(offset)}</p>}
                            {typeof weight === 'number' && weight > 0 && <p className="mt-0.5 tabular-nums">bobot {weight}</p>}
                          </div>
                        </li>
                      )
                    })}
                  </ol>
                  {data.timeline.length > TIMELINE_PREVIEW && (
                    <Button variant="ghost" size="sm" className="mt-3 w-full" onClick={() => setShowAllEvents((value) => !value)}>
                      {showAllEvents ? <><ChevronUp />Sembunyikan</> : <><ChevronDown />Tampilkan semua ({data.timeline.length})</>}
                    </Button>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {attempt.flagged && <p className="flex items-center gap-1.5 px-1 text-xs text-muted-foreground"><Flag className="size-3.5 text-destructive" />Flagged otomatis oleh sistem deteksi.</p>}
        </div>
      </div>
    </>
  )
}

AdminJudgingShow.layout = adminPageLayout
