import { useEffect, useState } from 'react'
import { Link } from '@inertiajs/react'
import { ArrowLeft, Clock3, Save, Send } from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Seo } from '@/components/seo/Seo'
import { DashboardBackdrop } from '@/features/dashboard/components/DashboardBackdrop'
import { DashboardError, DashboardLoading } from '@/features/dashboard/components/DashboardStates'
import { useExamShell } from '@/features/dashboard/hooks/useDashboard'
import { TryoutResultPanel } from '@/features/exam/components/TryoutResultPanel'
import { getJson, patchJson, postJson, putJson } from '@/lib/api'
import { cn } from '@/lib/utils'

type Attempt = { id: string; finished: boolean; totalScore: number; maxPossibleScore: number; endTime: string | null }
type Question = { id: string; question: string; type: string; options: { id: string; content: string }[] | null; correctAnswer?: string | null; explanation?: string | null; correctScore?: number; wrongScore?: number; emptyScore?: number }

export default function ExamWorkspacePage({ examId }: { examId: string }) {
  const shell = useExamShell(examId)
  const [attempt, setAttempt] = useState<Attempt | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [selected, setSelected] = useState<Record<string, string>>({})
  const [canViewResult, setCanViewResult] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [remaining, setRemaining] = useState<string>('')

  const exam = shell.data?.data.exam

  useEffect(() => {
    if (!attempt?.endTime) return
    const end = new Date(attempt.endTime).getTime()
    const id = setInterval(() => {
      const diff = end - Date.now()
      if (diff <= 0) {
        setRemaining('00:00')
        clearInterval(id)
      } else {
        const m = Math.floor(diff / 60000)
        const s = Math.floor((diff % 60000) / 1000)
        setRemaining(`${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`)
      }
    }, 1000)
    return () => clearInterval(id)
  }, [attempt?.endTime])

  useEffect(() => {
    if (!attempt || attempt.finished || exam?.type === 'tryout') return
    let queue: { type: string; metadata: Record<string, unknown>; client_at: string }[] = []
    const push = (type: string) => {
      queue.push({ type, metadata: {}, client_at: new Date().toISOString() })
    }
    const onVisibility = () => {
      if (document.hidden) push('tab_switched')
    }
    const onBlur = () => push('window_blurred')
    const onCopy = () => push('copy_attempted')
    const onPaste = () => push('paste_attempted')
    const onContext = () => push('right_click_attempted')
    const onFullscreen = () => {
      if (!document.fullscreenElement) push('fullscreen_exited')
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'i')) push('devtools_opened')
      if (e.ctrlKey && e.key.toLowerCase() === 'p') push('screenshot_attempted')
    }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('blur', onBlur)
    document.addEventListener('copy', onCopy)
    document.addEventListener('paste', onPaste)
    document.addEventListener('contextmenu', onContext)
    document.addEventListener('fullscreenchange', onFullscreen)
    window.addEventListener('keydown', onKey)
    const flush = async () => {
      if (queue.length === 0 || !attempt) return
      const batch = queue.splice(0, 50)
      try {
        await postJson(`/api/dashboard/exams/${examId}/attempts/${attempt.id}/events`, { events: batch })
      } catch {}
      if (queue.length > 0) {
        const remaining = queue
        queue = []
        if (remaining.length > 0 && navigator.sendBeacon) {
          const url = `/api/dashboard/exams/${examId}/attempts/${attempt.id}/events`
          const blob = new Blob([JSON.stringify({ events: remaining })], { type: 'application/json' })
          navigator.sendBeacon(url, blob)
        }
      }
    }
    const interval = setInterval(flush, 5000)
    const beforeUnload = () => {
      if (queue.length > 0 && navigator.sendBeacon) {
        const url = `/api/dashboard/exams/${examId}/attempts/${attempt!.id}/events`
        const blob = new Blob([JSON.stringify({ events: queue })], { type: 'application/json' })
        navigator.sendBeacon(url, blob)
      }
    }
    window.addEventListener('beforeunload', beforeUnload)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('blur', onBlur)
      document.removeEventListener('copy', onCopy)
      document.removeEventListener('paste', onPaste)
      document.removeEventListener('contextmenu', onContext)
      document.removeEventListener('fullscreenchange', onFullscreen)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('beforeunload', beforeUnload)
      clearInterval(interval)
    }
  }, [attempt?.id, attempt?.finished, exam?.type])

  useEffect(() => {
    if (!attempt || attempt.finished || exam?.type === 'tryout') return
    const id = setInterval(() => {
      postJson(`/api/dashboard/exams/${examId}/attempts/${attempt.id}/heartbeat`, {}).catch(() => {})
    }, 30000)
    return () => clearInterval(id)
  }, [attempt?.id, attempt?.finished, exam?.type])

  async function start() {
    setLoading(true)
    setError(null)
    try {
      const res: any = await postJson(`/api/dashboard/exams/${examId}/attempts`, { device_id: navigator.userAgent.slice(0, 80) })
      setAttempt(res.data.attempt)
      setQuestions(res.data.questions)
      setCanViewResult(false)
    } catch (e: any) {
      setError(e.message ?? 'Gagal memulai')
    } finally {
      setLoading(false)
    }
  }

  async function loadAttempt(attemptId: string) {
    try {
      const res: any = await getJson(`/api/dashboard/exams/${examId}/attempts/${attemptId}`)
      setAttempt(res.data.attempt)
      setQuestions(res.data.questions)
      setCanViewResult(Boolean(res.data.canViewResult))
      const saved: Record<string, string> = {}
      const sel: Record<string, string> = {}
      for (const a of res.data.savedAnswers ?? []) {
        if (a.answer) saved[a.questionId] = a.answer
        if (a.selectedOptions?.[0]) sel[a.questionId] = a.selectedOptions[0]
        if (a.selected_options?.[0]) sel[a.questionId] = a.selected_options[0]
      }
      setAnswers(saved)
      setSelected(sel)
    } catch (e: any) {
      setError(e.message)
    }
  }

  async function save(qid: string) {
    if (!attempt) return
    const payload: any = { question_id: qid }
    if (answers[qid]) payload.answer = answers[qid]
    if (selected[qid]) payload.selected_options = [selected[qid]]
    try {
      await putJson(`/api/dashboard/exams/${examId}/attempts/${attempt.id}/answers`, { answers: [payload] })
    } catch {}
  }

  async function submit() {
    if (!attempt) return
    const res: any = await postJson(`/api/dashboard/exams/${examId}/attempts/${attempt.id}/submit`, {})
    setAttempt(res.data.attempt)
    if (exam?.type === 'tryout') {
      await loadAttempt(attempt.id)
    }
  }

  if (shell.isLoading) return <DashboardLoading />
  if (shell.error || !exam) return <DashboardError message={shell.error?.message ?? 'Ujian tidak tersedia'} retry={() => shell.refetch()} />

  const isTryout = exam.type === 'tryout'
  const finished = Boolean(attempt?.finished)

  return (
    <main className="error-portal-shell relative min-h-screen overflow-hidden px-4 pb-24 pt-28 sm:px-6 sm:pt-32">
      <Seo title={`Pengerjaan — ${exam.title}`} description={`Pengerjaan ${exam.title} ${isTryout ? 'Tryout' : 'Olimpiade'}`} canonical={`/dashboard/olimpiade/${examId}/workspace`} noindex />
      <DashboardBackdrop />
      <div className="relative z-20 mx-auto max-w-4xl space-y-6">
        <Link href={`/dashboard/olimpiade/${examId}`} className={cn(buttonVariants({ variant: 'outline' }), 'backdrop-blur-xl')}>
          <ArrowLeft />Kembali
        </Link>

        <Card className="border-white/10 bg-card/55 backdrop-blur-2xl">
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle className="flex items-center gap-2">{exam.title} {isTryout ? <Badge variant="secondary">Tryout</Badge> : <Badge>Olimpiade</Badge>}</CardTitle>
              {attempt && <Badge variant="outline" className="gap-1"><Clock3 className="size-3" />{remaining || '—'} · {exam.duration} menit</Badge>}
            </div>
          </CardHeader>
          <CardContent>
            {!attempt ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">Durasi {exam.duration} menit · Maks {exam.maxAttempts}x percobaan · {isTryout ? 'Tryout bisa review kunci & pembahasan setelah selesai' : 'Olimpiade tidak menampilkan kunci'}</p>
                <Button onClick={start} disabled={loading}>{loading ? 'Memulai...' : isTryout ? 'Mulai Tryout' : 'Mulai Ujian'}</Button>
                {error && <p className="text-xs text-destructive">{error}</p>}
              </div>
            ) : finished && isTryout ? (
              <TryoutResultPanel attempt={attempt as any} questions={questions as any} canViewResult={canViewResult} />
            ) : finished && !isTryout ? (
              <Card className="border-white/10 bg-muted/20"><CardContent className="p-6 text-sm text-muted-foreground">Ujian Olimpiade selesai. Skor {attempt.totalScore}/{attempt.maxPossibleScore} — pembahasan & kunci tidak ditampilkan. Hasil diumumkan panitia.</CardContent></Card>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between text-xs text-muted-foreground"><span>Soal {questions.length} · Sisa {remaining}</span><Badge variant={isTryout ? 'secondary' : 'outline'}>{isTryout ? 'Tryout' : 'Olimpiade'}</Badge></div>
                {questions.map((q, idx) => (
                  <Card key={q.id} className="border-white/10 bg-background/30">
                    <CardContent className="p-4 space-y-3">
                      <p className="text-xs text-muted-foreground">Soal {idx + 1} · {q.type}</p>
                      <div className="prose prose-sm max-w-none dark:prose-invert" dangerouslySetInnerHTML={{ __html: q.question }} />
                      {q.type === 'essay' ? (
                        <Textarea value={answers[q.id] ?? ''} onChange={(e) => setAnswers((p) => ({ ...p, [q.id]: e.target.value }))} placeholder="Tulis jawaban esai" rows={3} />
                      ) : (
                        <div className="grid gap-2">
                          {(q.options ?? []).map((opt) => (
                            <label key={opt.id} className={cn('flex cursor-pointer gap-2 rounded-xl border p-3', selected[q.id] === opt.id ? 'border-primary bg-primary/10' : 'border-white/10')}>
                              <input type="radio" name={q.id} checked={selected[q.id] === opt.id} onChange={() => setSelected((p) => ({ ...p, [q.id]: opt.id }))} />
                              <span className="prose prose-sm max-w-none dark:prose-invert" dangerouslySetInnerHTML={{ __html: opt.content }} />
                            </label>
                          ))}
                        </div>
                      )}
                      <Button size="sm" variant="outline" onClick={() => save(q.id)}><Save className="mr-1 size-3" />Simpan</Button>
                      {canViewResult && q.correctAnswer && <p className="text-xs font-medium text-primary">Kunci: {q.correctAnswer}</p>}
                      {canViewResult && q.explanation && <details className="rounded bg-muted/40 p-2 text-xs"><summary>Pembahasan</summary><div dangerouslySetInnerHTML={{ __html: q.explanation }} /></details>}
                    </CardContent>
                  </Card>
                ))}
                <Button onClick={submit} className="w-full"><Send className="mr-2 size-4" />Submit Ujian</Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
