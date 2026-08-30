import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Save, Sparkles } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Seo } from '@/components/seo/Seo'
import { AdminPageHeader } from '@/features/admin/components/AdminPageHeader'
import { adminPageLayout } from '@/features/admin/components/AdminShell'
import { useAdminCompetitions } from '@/features/admin/hooks/useAdmin'
import { getJson, patchJson, postJson } from '@/lib/api'
import { RichTextEditor } from '@/features/admin/components/RichTextEditor'

type Stage = { id: string; competition_id: string; name: string; order: number }
type Exam = { id: string; title: string; description: string | null; questionCount: number; duration: number; maxAttempts: number; shuffleQuestions: boolean; shuffleOptions: boolean; showResultImmediately: boolean; passingScore: number | null; type: string }
type Question = { id: string; question: string; explanation: string | null; type: string; options: { id: string; content: string }[] | null; correctAnswer: string | null; order: number; correctScore: number; wrongScore: number; emptyScore: number; difficulty: string }
type Response<T> = { data: T }

type Difficulty = 'easy' | 'medium' | 'hard'
type QuestionType = 'multiple_choice' | 'true_false' | 'essay'

const difficultyOptions: { value: Difficulty; label: string }[] = [
  { value: 'easy', label: 'Mudah' },
  { value: 'medium', label: 'Sedang' },
  { value: 'hard', label: 'Sulit' },
]

const difficultyWeights: Record<Difficulty, { correct: number; wrong: number; empty: number }> = {
  easy: { correct: 2, wrong: -1, empty: 0 },
  medium: { correct: 3, wrong: -2, empty: 0 },
  hard: { correct: 4, wrong: -3, empty: 0 },
}

const difficultyLabel: Record<string, string> = { easy: 'Mudah', medium: 'Sedang', hard: 'Sulit' }

const toInteger = (value: string): number => {
  const parsed = Number.parseInt(value, 10)
  return Number.isNaN(parsed) ? 0 : parsed
}

const emptyOption = () => ({ id: crypto.randomUUID(), content: '' })

export default function AdminQuestions() {
  const queryClient = useQueryClient()
  const competitions = useAdminCompetitions({ perPage: 100 })
  const [competitionId, setCompetitionId] = useState('')
  const [stageId, setStageId] = useState('')
  const [examId, setExamId] = useState('')
  const [question, setQuestion] = useState('')
  const [explanation, setExplanation] = useState('')
  const [type, setType] = useState<QuestionType>('multiple_choice')
  const [options, setOptions] = useState([emptyOption(), emptyOption()])
  const [correctAnswer, setCorrectAnswer] = useState('')
  const [difficulty, setDifficulty] = useState<Difficulty>('medium')
  const [correctScore, setCorrectScore] = useState(difficultyWeights.medium.correct)
  const [wrongScore, setWrongScore] = useState(difficultyWeights.medium.wrong)
  const [emptyScore, setEmptyScore] = useState(difficultyWeights.medium.empty)

  const selectDifficulty = (value: Difficulty) => {
    setDifficulty(value)
    const weights = difficultyWeights[value]
    setCorrectScore(weights.correct)
    setWrongScore(weights.wrong)
    setEmptyScore(weights.empty)
  }

  const switchType = (next: QuestionType) => {
    setType(next)
    setCorrectAnswer('')
    if (next === 'essay') {
      setWrongScore(0)
      setEmptyScore(0)
      setCorrectScore((value) => (value >= 1 && value <= 15 ? value : 10))
      return
    }
    const weights = difficultyWeights[difficulty]
    setCorrectScore(weights.correct)
    setWrongScore(weights.wrong)
    setEmptyScore(weights.empty)
  }

  const stages = useQuery({
    queryKey: ['admin', 'exam-stages', competitionId],
    queryFn: () => getJson<Response<Stage[]>>('/api/admin/exam-stages?competition_id=' + competitionId),
    enabled: Boolean(competitionId),
  })
  const exams = useQuery({
    queryKey: ['admin', 'exams', stageId],
    queryFn: () => getJson<Response<Exam[]>>('/api/admin/exams?stage_id=' + stageId),
    enabled: Boolean(stageId),
  })
  const exam = useQuery({
    queryKey: ['admin', 'exam', examId],
    queryFn: () => getJson<Response<Exam & { questions: Question[] }>>('/api/admin/exams/' + examId),
    enabled: Boolean(examId),
  })

  const [examDuration, setExamDuration] = useState(60)
  const [examMaxAttempts, setExamMaxAttempts] = useState(1)
  const [examShuffleQuestions, setExamShuffleQuestions] = useState(false)
  const [examShuffleOptions, setExamShuffleOptions] = useState(false)

  const updateExam = useMutation({
    mutationFn: () => patchJson('/api/admin/exams/' + examId, {
      duration: examDuration,
      max_attempts: examMaxAttempts,
      shuffle_questions: examShuffleQuestions,
      shuffle_options: examShuffleOptions,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'exam', examId] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'exams', stageId] })
    },
  })

  const createQuestion = useMutation({
    mutationFn: () => postJson('/api/admin/exams/' + examId + '/questions', {
      question, explanation: explanation || null, type,
      options: type === 'essay' ? null : options,
      correct_answer: correctAnswer || null,
      correct_score: correctScore, wrong_score: wrongScore, empty_score: emptyScore,
      difficulty, is_active: true,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'exam', examId] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'exams', stageId] })
      setQuestion(''); setExplanation(''); setOptions([emptyOption(), emptyOption()]); setCorrectAnswer('')
      const weights = difficultyWeights[difficulty]
      if (type === 'essay') { setCorrectScore(10); setWrongScore(0); setEmptyScore(0); return }
      setCorrectScore(weights.correct); setWrongScore(weights.wrong); setEmptyScore(weights.empty)
    },
  })

  const competitionRows = (competitions.data?.data ?? []).filter((item: any) => item.type === 'OLIMPIADE')
  const stageRows = stages.data?.data ?? []
  const examRows = exams.data?.data ?? []
  const activeExam = exam.data?.data

  useEffect(() => {
    if (activeExam) {
      setExamDuration(activeExam.duration ?? 60)
      setExamMaxAttempts(activeExam.maxAttempts ?? 1)
      setExamShuffleQuestions(Boolean(activeExam.shuffleQuestions))
      setExamShuffleOptions(Boolean(activeExam.shuffleOptions))
    }
  }, [activeExam?.id])
  const selectedCompetition = competitionRows.find((item) => item.id === competitionId)
  const selectedStage = stageRows.find((item) => item.id === stageId)
  const selectedExam = examRows.find((item) => item.id === examId)
  const scoreValid = type === 'essay'
    ? Number.isInteger(correctScore) && correctScore >= 1 && correctScore <= 15
    : Number.isInteger(correctScore) && Number.isInteger(wrongScore) && Number.isInteger(emptyScore)
  const canSave = Boolean(examId && question.replace(/<[^>]+>/g, '').trim() && (type === 'essay' || correctAnswer)) && scoreValid
  const questionTypeLabel = useMemo(() => ({ multiple_choice: 'Pilihan ganda', true_false: 'Benar / Salah', essay: 'Esai' }), [])

  return (
    <>
      <Seo title="Buat Soal" description="Penyusunan soal ujian ISAC melalui editor rich text." canonical="/admin/questions" noindex />
      <AdminPageHeader title="Buat Soal" description="Susun pertanyaan, jawaban, gambar ImageKit, dan pembahasan dalam satu alur." />
      <div className="space-y-6">
        <Card className="border-border/60 bg-card/70"><CardHeader><CardTitle>Form soal</CardTitle><CardDescription>Pilih konteks ujian, lalu susun pertanyaan dan jawabannya. Konten HTML dibersihkan server sebelum disimpan.</CardDescription></CardHeader><CardContent className="space-y-5">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2"><Label>Kompetisi</Label><Select value={competitionId} onValueChange={(v) => { setCompetitionId(v ?? ''); setStageId(''); setExamId('') }}><SelectTrigger className="w-full"><span data-slot="select-value" className={selectedCompetition ? 'flex flex-1 truncate text-left' : 'flex flex-1 text-left text-muted-foreground'}>{selectedCompetition?.name ?? 'Pilih kompetisi'}</span></SelectTrigger><SelectContent>{competitionRows.map((item) => <SelectItem value={item.id} key={item.id}>{item.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>Tahap</Label><Select value={stageId} onValueChange={(v) => { setStageId(v ?? ''); setExamId('') }} disabled={!competitionId || stages.isLoading}><SelectTrigger className="w-full"><span data-slot="select-value" className={selectedStage ? 'flex flex-1 truncate text-left' : 'flex flex-1 text-left text-muted-foreground'}>{selectedStage ? `Tahap ${selectedStage.order} · ${selectedStage.name}` : stages.isLoading ? 'Memuat tahap…' : 'Pilih tahap'}</span></SelectTrigger><SelectContent>{stageRows.map((item) => <SelectItem value={item.id} key={item.id}>Tahap {item.order} · {item.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>Ujian</Label><Select value={examId} onValueChange={(v) => setExamId(v ?? '')} disabled={!stageId || exams.isLoading}><SelectTrigger className="w-full"><span data-slot="select-value" className={selectedExam ? 'flex flex-1 truncate text-left' : 'flex flex-1 text-left text-muted-foreground'}>{selectedExam?.title ?? (exams.isLoading ? 'Memuat ujian…' : 'Pilih ujian')}</span></SelectTrigger><SelectContent>{examRows.map((item) => <SelectItem value={item.id} key={item.id}>{item.title}</SelectItem>)}</SelectContent></Select></div>
          </div>
          {!examId ? <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">Pilih ujian untuk mulai membuat soal.</div> : <>
            <div className="rounded-2xl border border-border bg-muted/20 p-4">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Pengaturan Ujian</p>
                  <p className="text-xs text-muted-foreground">Durasi & percobaan khusus Olimpiade — Business tidak perlu.</p>
                </div>
                <Button type="button" size="sm" onClick={() => updateExam.mutate()} disabled={updateExam.isPending}>{updateExam.isPending ? 'Menyimpan…' : 'Simpan Pengaturan'}</Button>
              </div>
              <div className="grid gap-4 md:grid-cols-4">
                <div className="space-y-2"><Label>Durasi (menit)</Label><Input type="number" min={1} max={480} value={examDuration} onChange={(e) => setExamDuration(toInteger(e.target.value) || 60)} /></div>
                <div className="space-y-2"><Label>Max Percobaan</Label><Input type="number" min={1} max={5} value={examMaxAttempts} onChange={(e) => setExamMaxAttempts(toInteger(e.target.value) || 1)} /></div>
                <div className="space-y-2"><Label>Acak Soal</Label><div className="flex h-10 items-center"><input type="checkbox" checked={examShuffleQuestions} onChange={(e) => setExamShuffleQuestions(e.target.checked)} className="size-4" /> <span className="ml-2 text-sm">Aktif</span></div></div>
                <div className="space-y-2"><Label>Acak Opsi</Label><div className="flex h-10 items-center"><input type="checkbox" checked={examShuffleOptions} onChange={(e) => setExamShuffleOptions(e.target.checked)} className="size-4" /> <span className="ml-2 text-sm">Aktif</span></div></div>
              </div>
              {activeExam && <p className="mt-2 text-xs text-muted-foreground">Ujian: {activeExam.title} · {activeExam.duration} menit · {activeExam.maxAttempts}x percobaan · {activeExam.questionCount} soal</p>}
              {updateExam.isSuccess && <p className="mt-2 text-xs text-green-600">Pengaturan tersimpan.</p>}
              {updateExam.isError && <p className="mt-2 text-xs text-destructive">Gagal menyimpan pengaturan.</p>}
            </div>
            <div className="space-y-2"><Label>Pertanyaan</Label><RichTextEditor value={question} onChange={setQuestion} placeholder="Tulis pertanyaan; gunakan toolbar untuk format atau sisipkan gambar." /></div>
            <div className="space-y-2"><Label>Tipe jawaban</Label><Select value={type} onValueChange={(v) => switchType(v as QuestionType)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="multiple_choice">Pilihan ganda</SelectItem><SelectItem value="true_false">Benar / Salah</SelectItem><SelectItem value="essay">Esai</SelectItem></SelectContent></Select></div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Tingkat kesulitan</Label>
                <div className="flex gap-2" role="radiogroup" aria-label="Tingkat kesulitan soal">
                  {difficultyOptions.map((option) => (
                    <Button key={option.value} type="button" size="sm" role="radio" aria-checked={difficulty === option.value} variant={difficulty === option.value ? 'default' : 'outline'} onClick={() => selectDifficulty(option.value)}>{option.label}</Button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">Bobot otomatis mengikuti tingkat kesulitan dan tetap bisa diubah manual.</p>
              </div>
              {type === 'essay' ? (
                <div className="space-y-2">
                  <Label>Skor esai (1–15 poin)</Label>
                  <Input type="number" min={1} max={15} step={1} value={correctScore} onChange={(event) => setCorrectScore(toInteger(event.target.value))} aria-invalid={correctScore < 1 || correctScore > 15} />
                  <p className="text-xs text-muted-foreground">Kosong / tidak dijawab bernilai 0.</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-2"><Label>Benar</Label><Input type="number" step={1} value={correctScore} onChange={(event) => setCorrectScore(toInteger(event.target.value))} /></div>
                  <div className="space-y-2"><Label>Salah</Label><Input type="number" step={1} value={wrongScore} onChange={(event) => setWrongScore(toInteger(event.target.value))} /></div>
                  <div className="space-y-2"><Label>Kosong</Label><Input type="number" step={1} value={emptyScore} onChange={(event) => setEmptyScore(toInteger(event.target.value))} /></div>
                </div>
              )}
            </div>
            {type === 'essay' ? <div className="space-y-2"><Label>Pedoman jawaban</Label><RichTextEditor value={correctAnswer} onChange={setCorrectAnswer} placeholder="Tulis jawaban atau rubrik untuk penilaian esai." /></div> : <div className="space-y-3">{options.map((option, index) => <div className="space-y-2 rounded-2xl border border-border p-3" key={option.id}><div className="flex items-center justify-between gap-3"><Label>Pilihan {String.fromCharCode(65 + index)}</Label><Button type="button" size="xs" variant={correctAnswer === option.id ? 'default' : 'outline'} onClick={() => setCorrectAnswer(option.id)}>Jawaban benar</Button></div><RichTextEditor value={option.content} onChange={(content) => setOptions((all) => all.map((item) => item.id === option.id ? { ...item, content } : item))} placeholder={'Tulis pilihan ' + String.fromCharCode(65 + index)} /></div>)}{type === 'multiple_choice' && <Button type="button" variant="outline" onClick={() => setOptions((all) => [...all, emptyOption()])}><Plus /> Tambah pilihan</Button>}</div>}
            <div className="space-y-2"><Label>Pembahasan (opsional)</Label><RichTextEditor value={explanation} onChange={setExplanation} placeholder="Tambahkan pembahasan untuk reviewer atau hasil ujian." /></div>
            <Button type="button" size="lg" disabled={!canSave || createQuestion.isPending} onClick={() => createQuestion.mutate()}>{createQuestion.isPending ? 'Menyimpan…' : <><Save /> Simpan soal</>}</Button>
            {createQuestion.isError && <p className="text-sm text-destructive">Soal gagal disimpan. Periksa seluruh field lalu coba lagi.</p>}
          </>}
        </CardContent></Card>
        <Card className="border-border/60 bg-card/70"><CardHeader><CardTitle>Daftar soal</CardTitle><CardDescription>{activeExam ? `${activeExam.questions.length} soal pada ${activeExam.title}` : 'Pilih ujian untuk melihat seluruh soal dan pilihan jawabannya.'}</CardDescription></CardHeader><CardContent className="space-y-4">{!examId ? <div className="rounded-2xl bg-muted/40 p-6 text-sm text-muted-foreground"><Sparkles className="mb-2 size-5 text-primary" />Daftar soal akan tampil setelah ujian dipilih.</div> : activeExam?.questions.length ? activeExam.questions.map((item, index) => <article key={item.id} className="rounded-3xl border border-border bg-background/30 p-4 sm:p-5"><div className="flex flex-wrap items-center justify-between gap-3"><span className="font-medium">Soal {index + 1}</span><span className="flex flex-wrap items-center gap-2"><Badge variant="secondary">{questionTypeLabel[item.type as keyof typeof questionTypeLabel] ?? item.type}</Badge><Badge variant="outline">{difficultyLabel[item.difficulty] ?? item.difficulty}</Badge></span></div><div className="prose prose-sm mt-3 max-w-none dark:prose-invert" dangerouslySetInnerHTML={{ __html: item.question }} /><p className="mt-2 text-xs text-muted-foreground">Bobot: benar {item.correctScore} · salah {item.wrongScore} · kosong {item.emptyScore}</p>{item.type === 'essay' ? <div className="mt-4 rounded-2xl border border-accent/25 bg-accent/5 p-3"><p className="mb-2 text-sm font-medium text-accent">Pedoman jawaban</p>{item.correctAnswer ? <div className="prose prose-sm max-w-none dark:prose-invert" dangerouslySetInnerHTML={{ __html: item.correctAnswer }} /> : <p className="text-sm text-muted-foreground">Belum ada pedoman jawaban.</p>}</div> : item.options?.length ? <ol className="mt-4 grid gap-2">{item.options.map((option, optionIndex) => { const isCorrect = option.id === item.correctAnswer; return <li key={option.id} className={isCorrect ? 'rounded-2xl border border-accent/30 bg-accent/10 p-3' : 'rounded-2xl border border-border/70 bg-muted/20 p-3'}><div className="flex items-start gap-3"><span className={isCorrect ? 'flex size-6 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-accent-foreground' : 'flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground'}>{String.fromCharCode(65 + optionIndex)}</span><div className="min-w-0 flex-1"><div className="prose prose-sm max-w-none dark:prose-invert" dangerouslySetInnerHTML={{ __html: option.content }} />{isCorrect && <p className="mt-2 text-xs font-semibold text-accent">Jawaban benar</p>}</div></div></li> })}</ol> : null}{item.explanation && <details className="mt-4 rounded-2xl bg-muted/40 px-4 py-3"><summary className="cursor-pointer text-sm font-medium">Lihat pembahasan</summary><div className="prose prose-sm mt-3 max-w-none dark:prose-invert" dangerouslySetInnerHTML={{ __html: item.explanation }} /></details>}</article>) : <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">Belum ada soal pada ujian ini. Gunakan form di atas untuk menambahkan soal pertama.</div>}</CardContent></Card>
      </div>
    </>
  )
}

AdminQuestions.layout = adminPageLayout
