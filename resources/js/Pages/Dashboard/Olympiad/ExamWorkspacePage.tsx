import { useEffect, useRef, useState } from 'react'
import { Link } from '@inertiajs/react'
import { ArrowLeft, ChevronLeft, ChevronRight, Clock3, Eraser, Flag, Send } from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Seo } from '@/components/seo/Seo'
import { DashboardBackdrop } from '@/features/dashboard/components/DashboardBackdrop'
import { DashboardError, DashboardLoading } from '@/features/dashboard/components/DashboardStates'
import { useExamShell } from '@/features/dashboard/hooks/useDashboard'
import { ApiClientError, getJson, postJson, putJson } from '@/lib/api'
import { cn } from '@/lib/utils'

type Attempt = { id: string; finished: boolean; totalScore: number; maxPossibleScore: number; endTime: string | null }
type Question = { id: string; question: string; type: string; options: { id: string; content: string }[] | null; correctAnswer?: string | null; explanation?: string | null; correctScore?: number; wrongScore?: number; emptyScore?: number }
type Result = { isCorrect: boolean | null; score: number | null }
type SaveState = 'saving' | 'saved' | 'error'
type ReviewStatus = 'correct' | 'wrong' | 'empty' | 'essay'

const typeLabel: Record<string, string> = { multiple_choice: 'Pilihan ganda', true_false: 'Benar / Salah', essay: 'Esai' }
const htmlClass = 'prose prose-sm max-w-none dark:prose-invert [&_img]:h-auto [&_img]:max-w-full [&_img]:rounded-lg'

const attemptKey = (examId: string) => `isac:exam:${examId}:attempt`
const doubtKey = (examId: string, attemptId: string) => `isac:exam:${examId}:${attemptId}:doubtful`
const store = {
  get(key: string): string | null {
    try { return window.localStorage.getItem(key) } catch { return null }
  },
  set(key: string, value: string) {
    try { window.localStorage.setItem(key, value) } catch {}
  },
  remove(key: string) {
    try { window.localStorage.removeItem(key) } catch {}
  },
}

function readDoubtful(examId: string, attemptId: string): Record<string, boolean> {
  try {
    const raw = store.get(doubtKey(examId, attemptId))
    const ids: unknown = raw ? JSON.parse(raw) : []
    if (!Array.isArray(ids)) return {}
    return Object.fromEntries(ids.filter((id): id is string => typeof id === 'string').map((id) => [id, true]))
  } catch {
    return {}
  }
}

const omit = (record: Record<string, string>, key: string): Record<string, string> => {
  const { [key]: _removed, ...rest } = record
  return rest
}

const boxClass = {
  base: 'relative flex size-10 items-center justify-center rounded-lg border text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
  unanswered: 'border-white/15 bg-background/30 text-muted-foreground hover:border-white/30',
  answered: 'border-primary/60 bg-primary/20 text-foreground',
  correct: 'border-emerald-400/60 bg-emerald-400/20 text-foreground',
  wrong: 'border-red-400/60 bg-red-400/20 text-foreground',
  essay: 'border-sky-400/50 bg-sky-400/15 text-foreground',
  active: 'ring-2 ring-primary ring-offset-2 ring-offset-background',
}

export default function ExamWorkspacePage({ examId }: { examId: string }) {
  const shell = useExamShell(examId)
  const [attempt, setAttempt] = useState<Attempt | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [selected, setSelected] = useState<Record<string, string>>({})
  const [results, setResults] = useState<Record<string, Result>>({})
  const [doubtful, setDoubtful] = useState<Record<string, boolean>>({})
  const [saveState, setSaveState] = useState<Record<string, SaveState>>({})
  const [active, setActive] = useState(0)
  const [canViewResult, setCanViewResult] = useState(false)
  const [loading, setLoading] = useState(false)
  const [resuming, setResuming] = useState(() => store.get(attemptKey(examId)) !== null)
  const [confirming, setConfirming] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [remaining, setRemaining] = useState<string>('')
  const [autoSubmitted, setAutoSubmitted] = useState(false)
  const [timeUpId, setTimeUpId] = useState<string | null>(null)
  const saveChain = useRef<Record<string, Promise<void>>>({})
  const essayTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const clockSkew = useRef(0)
  const submitRef = useRef<(auto?: boolean) => Promise<boolean>>(async () => false)

  const exam = shell.data?.data.exam

  useEffect(() => {
    if (!attempt?.endTime) return
    const end = new Date(attempt.endTime).getTime()
    const attemptId = attempt.id
    setTimeUpId(null)
    const tick = () => {
      const diff = end - (Date.now() + clockSkew.current)
      if (diff <= 0) {
        setRemaining('00:00')
        setTimeUpId(attemptId)
        return true
      }
      const m = Math.floor(diff / 60000)
      const s = Math.floor((diff % 60000) / 1000)
      setRemaining(`${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`)
      return false
    }
    if (tick()) return
    const id = setInterval(() => {
      if (tick()) clearInterval(id)
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

  useEffect(() => {
    const storedId = store.get(attemptKey(examId))
    if (storedId) void loadAttempt(storedId, true)
  }, [examId])

  function syncClock(serverTime: unknown) {
    const server = typeof serverTime === 'string' ? Date.parse(serverTime) : NaN
    if (!Number.isNaN(server)) clockSkew.current = server - Date.now()
  }

  async function start() {
    setLoading(true)
    setError(null)
    try {
      const res: any = await postJson(`/api/dashboard/exams/${examId}/attempts`, { device_id: navigator.userAgent.slice(0, 80) })
      store.set(attemptKey(examId), res.data.attempt.id)
      syncClock(res.data.serverTime)
      setAttempt(res.data.attempt)
      setQuestions(res.data.questions)
      setAnswers({})
      setSelected({})
      setResults({})
      setDoubtful({})
      setSaveState({})
      setActive(0)
      setRemaining('')
      setAutoSubmitted(false)
      setConfirming(false)
      setCanViewResult(false)
    } catch (e: any) {
      setError(e.message ?? 'Gagal memulai')
    } finally {
      setLoading(false)
    }
  }

  async function loadAttempt(attemptId: string, isResume = false) {
    try {
      const res: any = await getJson(`/api/dashboard/exams/${examId}/attempts/${attemptId}`)
      syncClock(res.data.serverTime)
      setAttempt(res.data.attempt)
      setQuestions(res.data.questions)
      setCanViewResult(Boolean(res.data.canViewResult))
      const saved: Record<string, string> = {}
      const sel: Record<string, string> = {}
      const graded: Record<string, Result> = {}
      for (const a of res.data.savedAnswers ?? []) {
        if (a.answer) saved[a.questionId] = a.answer
        const option = a.selectedOptions?.[0] ?? a.selected_options?.[0]
        if (option) sel[a.questionId] = option
        graded[a.questionId] = { isCorrect: a.isCorrect ?? a.is_correct ?? null, score: a.scoreObtained ?? a.score_obtained ?? null }
      }
      setAnswers(saved)
      setSelected(sel)
      setResults(graded)
      setDoubtful(readDoubtful(examId, attemptId))
      if (isResume) setActive(0)
    } catch (e: any) {
      if (!isResume) {
        setError(e.message)
      } else if (e instanceof ApiClientError && (e.status === 403 || e.status === 404)) {
        store.remove(attemptKey(examId))
      } else {
        setError(e.message ?? 'Gagal memulihkan sesi ujian')
      }
    } finally {
      if (isResume) setResuming(false)
    }
  }

  function persist(qid: string, value: { selected?: string; answer?: string }): Promise<void> {
    if (!attempt) return Promise.resolve()
    const attemptId = attempt.id
    const payload: Record<string, unknown> = { question_id: qid }
    if (value.answer) payload.answer = value.answer
    if (value.selected) payload.selected_options = [value.selected]
    setSaveState((p) => ({ ...p, [qid]: 'saving' }))
    const run = (saveChain.current[qid] ?? Promise.resolve()).then(async () => {
      try {
        await putJson(`/api/dashboard/exams/${examId}/attempts/${attemptId}/answers`, { answers: [payload] })
        setSaveState((p) => ({ ...p, [qid]: 'saved' }))
      } catch {
        setSaveState((p) => ({ ...p, [qid]: 'error' }))
      }
    })
    saveChain.current[qid] = run
    return run
  }

  function chooseOption(q: Question, optionId: string) {
    setSelected((p) => ({ ...p, [q.id]: optionId }))
    void persist(q.id, { selected: optionId })
  }

  function changeEssay(q: Question, text: string) {
    setAnswers((p) => ({ ...p, [q.id]: text }))
    clearTimeout(essayTimers.current[q.id])
    essayTimers.current[q.id] = setTimeout(() => {
      delete essayTimers.current[q.id]
      void persist(q.id, { answer: text })
    }, 800)
  }

  function flushEssay(q: Question) {
    if (!(q.id in essayTimers.current)) return
    clearTimeout(essayTimers.current[q.id])
    delete essayTimers.current[q.id]
    void persist(q.id, { answer: answers[q.id] ?? '' })
  }

  function clearAnswer(q: Question) {
    const hadAnswer = q.type === 'essay' ? Boolean(answers[q.id]) : Boolean(selected[q.id])
    clearTimeout(essayTimers.current[q.id])
    delete essayTimers.current[q.id]
    setSelected((p) => omit(p, q.id))
    setAnswers((p) => omit(p, q.id))
    if (hadAnswer) void persist(q.id, {})
  }

  function toggleDoubtful(q: Question) {
    if (!attempt) return
    const next = { ...doubtful }
    if (next[q.id]) delete next[q.id]
    else next[q.id] = true
    setDoubtful(next)
    store.set(doubtKey(examId, attempt.id), JSON.stringify(Object.keys(next)))
  }

  function goTo(index: number) {
    if (index < 0 || index >= questions.length) return
    const current = questions[active]
    if (current) flushEssay(current)
    setActive(index)
  }

  async function submit(auto = false): Promise<boolean> {
    if (!attempt) return false
    setSubmitting(true)
    setError(null)
    try {
      for (const q of questions) flushEssay(q)
      await Promise.all(Object.values(saveChain.current))
      const res: any = await postJson(`/api/dashboard/exams/${examId}/attempts/${attempt.id}/submit`, {})
      setAttempt(res.data.attempt)
      setConfirming(false)
      if (auto) setAutoSubmitted(true)
      if (exam?.type === 'tryout') {
        await loadAttempt(attempt.id)
      }
      return true
    } catch (e: any) {
      setError(e.message ?? 'Gagal mengirim jawaban')
      return false
    } finally {
      setSubmitting(false)
    }
  }
  submitRef.current = submit

  const expired = Boolean(attempt) && !attempt?.finished && timeUpId === attempt?.id

  useEffect(() => {
    if (!expired || !attempt) return
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const attemptSubmit = async () => {
      if (cancelled) return
      const ok = await submitRef.current(true)
      if (!ok && !cancelled) timer = setTimeout(attemptSubmit, 5000)
    }
    void attemptSubmit()
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [expired, attempt?.id])

  if (shell.isLoading) return <DashboardLoading />
  if (shell.error || !exam) return <DashboardError message={shell.error?.message ?? 'Ujian tidak tersedia'} retry={() => shell.refetch()} />

  const isTryout = exam.type === 'tryout'
  const finished = Boolean(attempt?.finished)
  const review = finished && isTryout && canViewResult
  const total = questions.length
  const q = questions[Math.min(active, Math.max(total - 1, 0))]

  const isAnswered = (item: Question) => (item.type === 'essay' ? Boolean(answers[item.id]?.trim()) : Boolean(selected[item.id]))
  const answeredCount = questions.filter(isAnswered).length
  const doubtfulCount = questions.filter((item) => doubtful[item.id]).length
  const reviewStatus = (item: Question): ReviewStatus => {
    if (item.type === 'essay') return 'essay'
    if (!selected[item.id]) return 'empty'
    return results[item.id]?.isCorrect ? 'correct' : 'wrong'
  }
  const reviewCount = (status: ReviewStatus) => questions.filter((item) => reviewStatus(item) === status).length
  const pointsLabel = (id: string) => {
    const score = results[id]?.score
    return score == null ? '' : ` · ${score > 0 ? '+' : ''}${score} poin`
  }

  const boxStyle = (item: Question, index: number) => {
    const state = review
      ? { correct: boxClass.correct, wrong: boxClass.wrong, essay: boxClass.essay, empty: boxClass.unanswered }[reviewStatus(item)]
      : isAnswered(item) ? boxClass.answered : boxClass.unanswered
    return cn(boxClass.base, state, !review && doubtful[item.id] && 'border-amber-400', index === active && boxClass.active)
  }
  const boxLabel = (item: Question, index: number) => {
    const parts = [`Soal ${index + 1}`]
    if (review) parts.push({ correct: 'benar', wrong: 'salah', essay: 'esai', empty: 'tidak dijawab' }[reviewStatus(item)])
    else parts.push(isAnswered(item) ? 'terjawab' : 'belum dijawab')
    if (!review && doubtful[item.id]) parts.push('ragu-ragu')
    return parts.join(', ')
  }

  const legend = review
    ? [['Benar', boxClass.correct], ['Salah', boxClass.wrong], ['Kosong', boxClass.unanswered], ['Esai', boxClass.essay]]
    : [['Terjawab', boxClass.answered], ['Belum', boxClass.unanswered], ['Ragu-ragu', cn(boxClass.unanswered, 'border-amber-400')]]

  const navigatorPane = (
    <aside className="lg:self-start">
      <Card className="border-white/10 bg-background/30">
        <CardContent className="space-y-4 p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold">Daftar Soal</p>
            <span className="text-xs text-muted-foreground">
              {review ? `${reviewCount('correct')} benar · ${reviewCount('wrong')} salah` : `${answeredCount}/${total} terjawab`}
            </span>
          </div>
          <div role="group" aria-label="Navigasi soal" className="grid max-h-[50vh] grid-cols-5 gap-2 overflow-y-auto p-1 sm:grid-cols-8 lg:grid-cols-5">
            {questions.map((item, index) => (
              <button key={item.id} type="button" onClick={() => goTo(index)} aria-label={boxLabel(item, index)} aria-current={index === active ? 'step' : undefined} className={boxStyle(item, index)}>
                {index + 1}
                {!review && doubtful[item.id] && <span aria-hidden="true" className="absolute -right-1 -top-1 size-2.5 rounded-full bg-amber-400" />}
              </button>
            ))}
          </div>
          <ul className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            {legend.map(([label, style]) => (
              <li key={label} className="flex items-center gap-1.5"><span aria-hidden="true" className={cn('size-3 rounded border', style)} />{label}</li>
            ))}
          </ul>
          {!review && (
            confirming ? (
              <div className="space-y-2 rounded-xl border border-amber-400/40 bg-amber-400/10 p-3 text-xs">
                <p>
                  {answeredCount === total && doubtfulCount === 0
                    ? 'Semua soal sudah dijawab. Kirim jawaban sekarang?'
                    : `${total - answeredCount} soal belum dijawab · ${doubtfulCount} ditandai ragu-ragu. Kirim jawaban sekarang?`}
                </p>
                <div className="flex gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={() => setConfirming(false)} disabled={submitting}>Kembali</Button>
                  <Button type="button" size="sm" onClick={() => void submit()} disabled={submitting}>{submitting ? 'Mengirim...' : 'Ya, submit'}</Button>
                </div>
              </div>
            ) : (
              <Button type="button" onClick={() => setConfirming(true)} className="w-full"><Send className="mr-2 size-4" />Submit Ujian</Button>
            )
          )}
          {error && <p className="text-xs text-destructive">{error}</p>}
        </CardContent>
      </Card>
    </aside>
  )

  const answeringPane = q && (
    <Card className="border-white/10 bg-background/30">
      <CardContent className="space-y-5 p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium">Soal {active + 1} <span className="text-muted-foreground">dari {total}</span></p>
          <div className="flex flex-wrap items-center gap-2">
            {doubtful[q.id] && <Badge variant="outline" className="border-amber-400 text-amber-300">Ragu-ragu</Badge>}
            <Badge variant="outline">{typeLabel[q.type] ?? q.type}</Badge>
          </div>
        </div>
        <div className={htmlClass} dangerouslySetInnerHTML={{ __html: q.question }} />
        {q.type === 'essay' ? (
          <Textarea
            value={answers[q.id] ?? ''}
            onChange={(e) => changeEssay(q, e.target.value)}
            onBlur={() => flushEssay(q)}
            placeholder="Tulis jawaban esai"
            rows={6}
            disabled={expired}
          />
        ) : (
          <div className="grid gap-2">
            {(q.options ?? []).map((opt) => (
              <label key={opt.id} className={cn('flex cursor-pointer gap-3 rounded-xl border p-3', selected[q.id] === opt.id ? 'border-primary bg-primary/10' : 'border-white/10 hover:border-white/25', expired && 'cursor-not-allowed opacity-60')}>
                <input type="radio" name={q.id} checked={selected[q.id] === opt.id} onChange={() => chooseOption(q, opt.id)} disabled={expired} className="mt-1" />
                <span className={htmlClass} dangerouslySetInnerHTML={{ __html: opt.content }} />
              </label>
            ))}
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" size="sm" variant={doubtful[q.id] ? 'secondary' : 'outline'} onClick={() => toggleDoubtful(q)} aria-pressed={Boolean(doubtful[q.id])}>
              <Flag className="mr-1 size-3.5" />{doubtful[q.id] ? 'Batalkan ragu-ragu' : 'Ragu-ragu'}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => clearAnswer(q)} disabled={expired || !isAnswered(q)}>
              <Eraser className="mr-1 size-3.5" />Hapus jawaban
            </Button>
            <span role="status" className="text-xs text-muted-foreground">
              {saveState[q.id] === 'saving' && 'Menyimpan…'}
              {saveState[q.id] === 'saved' && 'Tersimpan'}
              {saveState[q.id] === 'error' && (
                <>
                  <span className="text-destructive">Gagal menyimpan. </span>
                  <button type="button" className="underline" onClick={() => void persist(q.id, q.type === 'essay' ? { answer: answers[q.id] } : { selected: selected[q.id] })}>Coba lagi</button>
                </>
              )}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => goTo(active - 1)} disabled={active === 0}><ChevronLeft className="mr-1 size-4" />Sebelumnya</Button>
            <Button type="button" size="sm" onClick={() => goTo(active + 1)} disabled={active >= total - 1}>Berikutnya<ChevronRight className="ml-1 size-4" /></Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )

  const reviewPane = q && (
    <Card className="border-white/10 bg-background/30">
      <CardContent className="space-y-5 p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium">Soal {active + 1} <span className="text-muted-foreground">dari {total}</span></p>
          <div className="flex flex-wrap items-center gap-2">
            {{
              correct: <Badge className="bg-emerald-500/20 text-emerald-300">Benar{pointsLabel(q.id)}</Badge>,
              wrong: <Badge className="bg-red-500/20 text-red-300">Salah{pointsLabel(q.id)}</Badge>,
              empty: <Badge variant="outline">Tidak dijawab{pointsLabel(q.id)}</Badge>,
              essay: <Badge className="bg-sky-500/20 text-sky-300">Esai · dinilai panitia</Badge>,
            }[reviewStatus(q)]}
            <Badge variant="outline">{typeLabel[q.type] ?? q.type}</Badge>
          </div>
        </div>
        <div className={htmlClass} dangerouslySetInnerHTML={{ __html: q.question }} />
        {q.type === 'essay' ? (
          <div className="space-y-3">
            <div className="space-y-1 rounded-xl border border-white/10 p-3">
              <p className="text-xs font-semibold text-muted-foreground">Jawabanmu</p>
              {answers[q.id] ? <p className="whitespace-pre-wrap text-sm">{answers[q.id]}</p> : <p className="text-sm text-muted-foreground">Tidak dijawab.</p>}
            </div>
            {q.correctAnswer && (
              <div className="space-y-1 rounded-xl border border-emerald-400/50 bg-emerald-400/10 p-3">
                <p className="text-xs font-semibold text-emerald-300">Pedoman jawaban</p>
                <div className={htmlClass} dangerouslySetInnerHTML={{ __html: q.correctAnswer }} />
              </div>
            )}
          </div>
        ) : (
          <div className="grid gap-2">
            {(q.options ?? []).map((opt) => {
              const isKey = opt.id === q.correctAnswer
              const isMine = selected[q.id] === opt.id
              return (
                <div key={opt.id} className={cn('flex flex-wrap items-start justify-between gap-2 rounded-xl border p-3', isKey ? 'border-emerald-400/60 bg-emerald-400/10' : isMine ? 'border-red-400/60 bg-red-400/10' : 'border-white/10')}>
                  <span className={htmlClass} dangerouslySetInnerHTML={{ __html: opt.content }} />
                  <span className="flex gap-1.5">
                    {isKey && <Badge className="bg-emerald-500/20 text-emerald-300">Jawaban benar</Badge>}
                    {isMine && <Badge variant="outline">Jawabanmu</Badge>}
                  </span>
                </div>
              )
            })}
          </div>
        )}
        <div className="space-y-2 rounded-xl border border-white/10 bg-muted/30 p-4">
          <p className="text-sm font-semibold">Pembahasan</p>
          {q.explanation
            ? <div className={htmlClass} dangerouslySetInnerHTML={{ __html: q.explanation }} />
            : <p className="text-sm text-muted-foreground">Belum ada pembahasan untuk soal ini.</p>}
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-white/10 pt-4">
          <Button type="button" size="sm" variant="outline" onClick={() => goTo(active - 1)} disabled={active === 0}><ChevronLeft className="mr-1 size-4" />Sebelumnya</Button>
          <Button type="button" size="sm" onClick={() => goTo(active + 1)} disabled={active >= total - 1}>Berikutnya<ChevronRight className="ml-1 size-4" /></Button>
        </div>
      </CardContent>
    </Card>
  )

  return (
    <main className="error-portal-shell relative min-h-screen overflow-hidden px-4 pb-24 pt-28 sm:px-6 sm:pt-32">
      <Seo title={`Pengerjaan — ${exam.title}`} description={`Pengerjaan ${exam.title} ${isTryout ? 'Tryout' : 'Olimpiade'}`} canonical={`/dashboard/olimpiade/${examId}/workspace`} noindex />
      <DashboardBackdrop />
      <div className="relative z-20 mx-auto max-w-6xl space-y-6">
        <Link href={`/dashboard/olimpiade/${examId}`} className={cn(buttonVariants({ variant: 'outline' }), 'backdrop-blur-xl')}>
          <ArrowLeft />Kembali
        </Link>

        <Card className="border-white/10 bg-card/55 backdrop-blur-2xl">
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle className="flex items-center gap-2">{exam.title} {isTryout ? <Badge variant="secondary">Tryout</Badge> : <Badge>Olimpiade</Badge>}</CardTitle>
              {review && attempt ? (
                <Badge variant="secondary">Skor {attempt.totalScore}/{attempt.maxPossibleScore}</Badge>
              ) : attempt && !finished ? (
                <Badge variant="outline" className="gap-1"><Clock3 className="size-3" />{remaining || '—'} · {exam.duration} menit</Badge>
              ) : null}
            </div>
          </CardHeader>
          <CardContent>
            {resuming ? (
              <p className="text-sm text-muted-foreground">Memulihkan sesi ujian…</p>
            ) : !attempt ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">Durasi {exam.duration} menit · Maks {exam.maxAttempts}x percobaan · {isTryout ? 'Tryout bisa review kunci & pembahasan setelah selesai' : 'Olimpiade tidak menampilkan kunci'}</p>
                <Button onClick={start} disabled={loading}>{loading ? 'Memulai...' : isTryout ? 'Mulai Tryout' : 'Mulai Ujian'}</Button>
                {error && <p className="text-xs text-destructive">{error}</p>}
              </div>
            ) : finished && !review ? (
              <Card className="border-white/10 bg-muted/20"><CardContent className="space-y-3 p-6 text-sm text-muted-foreground">
                <p>
                  {autoSubmitted && 'Waktu habis, jawaban dikirim otomatis. '}
                  {isTryout
                    ? `Tryout selesai. Skor ${attempt.totalScore}/${attempt.maxPossibleScore}.`
                    : `Ujian Olimpiade selesai. Skor ${attempt.totalScore}/${attempt.maxPossibleScore} — pembahasan & kunci tidak ditampilkan. Hasil diumumkan panitia.`}
                </p>
                {exam.maxAttempts > 1 && <Button type="button" size="sm" variant="outline" onClick={() => void start()} disabled={loading}>{loading ? 'Memulai...' : 'Mulai percobaan baru'}</Button>}
                {error && <p className="text-xs text-destructive">{error}</p>}
              </CardContent></Card>
            ) : (
              <div className="space-y-4">
                {expired && <p role="alert" className="rounded-xl border border-red-400/40 bg-red-400/10 p-3 text-sm">Waktu pengerjaan habis. Jawaban tidak dapat diubah lagi dan sedang dikirim otomatis{error ? ' — mencoba ulang…' : '…'}</p>}
                {review && (
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm text-muted-foreground">
                      {autoSubmitted && 'Waktu habis, jawaban dikirim otomatis. '}Hasil Tryout: {reviewCount('correct')} benar · {reviewCount('wrong')} salah · {reviewCount('empty')} kosong · {reviewCount('essay')} esai (dinilai panitia).
                    </p>
                    {exam.maxAttempts > 1 && <Button type="button" size="sm" variant="outline" onClick={() => void start()} disabled={loading}>{loading ? 'Memulai...' : 'Mulai percobaan baru'}</Button>}
                  </div>
                )}
                <div className="grid gap-4 lg:grid-cols-[17rem_minmax(0,1fr)]">
                  {navigatorPane}
                  {review ? reviewPane : answeringPane}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
