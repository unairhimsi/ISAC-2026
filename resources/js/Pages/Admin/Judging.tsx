import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Award, Flag, Search, ShieldAlert } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { Seo } from '@/components/seo/Seo'
import { AdminPageHeader } from '@/features/admin/components/AdminPageHeader'
import { adminPageLayout } from '@/features/admin/components/AdminShell'
import { useAdminCompetitions } from '@/features/admin/hooks/useAdmin'
import { getJson, patchJson } from '@/lib/api'

type Stage = { id: string; competition_id: string; name: string; order: number }
type Exam = { id: string; title: string; duration: number; maxAttempts: number; questionCount: number }
type Attempt = { id: string; teamId: string; totalScore: number; maxPossibleScore: number; finished: boolean; flagged: boolean; suspiciousScore: number; cheatCount: number; startTime: string; endTime: string; team?: { id: string; name: string; code: string; email: string } }
type Paginated<T> = { data: T[]; current_page: number; per_page: number; total: number; last_page: number }
type Response<T> = { data: T }

export default function AdminJudging() {
  const queryClient = useQueryClient()
  const competitions = useAdminCompetitions({ perPage: 100 })
  const [competitionId, setCompetitionId] = useState('')
  const [stageId, setStageId] = useState('')
  const [examId, setExamId] = useState('')
  const [flagged, setFlagged] = useState('all')
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [page, setPage] = useState(1)
  const [selectedAttemptId, setSelectedAttemptId] = useState<string | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [scoreInput, setScoreInput] = useState('')
  const [reasonInput, setReasonInput] = useState('')

  const stages = useQuery({
    queryKey: ['admin', 'exam-stages', competitionId],
    queryFn: () => getJson<Response<Stage[]>>('/api/admin/exam-stages'),
    enabled: Boolean(competitionId),
  })

  const exams = useQuery({
    queryKey: ['admin', 'exams', stageId],
    queryFn: () => getJson<Response<Exam[]>>('/api/admin/exams?stage_id=' + stageId),
    enabled: Boolean(stageId),
  })

  const attempts = useQuery({
    queryKey: ['admin', 'exam-attempts', examId, flagged, search, page],
    queryFn: () => {
      const params = new URLSearchParams()
      if (flagged !== 'all') params.set('flagged', flagged === 'flagged' ? '1' : '0')
      if (search) params.set('search', search)
      params.set('page', String(page))
      params.set('per_page', '15')
      return getJson<Response<Paginated<Attempt>>>('/api/admin/exams/' + examId + '/attempts?' + params.toString())
    },
    enabled: Boolean(examId),
  })

  const detail = useQuery({
    queryKey: ['admin', 'exam-attempt-detail', examId, selectedAttemptId],
    queryFn: () => getJson<Response<{ attempt: Attempt; answers: any[]; timeline: any[] }>>('/api/admin/exams/' + examId + '/attempts/' + selectedAttemptId),
    enabled: Boolean(examId && selectedAttemptId && detailOpen),
  })

  const updateScore = useMutation({
    mutationFn: () => patchJson('/api/admin/exams/' + examId + '/attempts/' + selectedAttemptId + '/score', {
      total_score: Number(scoreInput),
      reason: reasonInput,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'exam-attempts', examId] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'exam-attempt-detail', examId, selectedAttemptId] })
    },
  })

  useEffect(() => {
    if (detail.data?.data.attempt) {
      setScoreInput(String(detail.data.data.attempt.totalScore ?? 0))
    }
  }, [detail.data?.data.attempt?.id])

  const competitionRows = (competitions.data?.data ?? []).filter((c: any) => c.type === 'OLIMPIADE')
  const stageRows = stages.data?.data ?? []
  const examRows = exams.data?.data ?? []
  const paginated = attempts.data?.data
  const attemptRows = paginated?.data ?? []
  const activeDetail = detail.data?.data

  function openDetail(id: string) {
    setSelectedAttemptId(id)
    setDetailOpen(true)
    setReasonInput('')
  }

  return (
    <>
      <Seo title="Penilaian Olimpiade" description="Pantau pengerjaan Olimpiade, filter flagged, dan perbarui nilai manual." canonical="/admin/judging" noindex />
      <AdminPageHeader title="Pengerjaan Olimpiade" description="Pantau attempt Olimpiade per ujian — filter flagged, cari tim, lihat timeline cheat, dan perbarui nilai." />
      <div className="space-y-6">
        <Card className="border-border/60 bg-card/70">
          <CardHeader><CardTitle className="flex items-center gap-2"><Award className="size-4" />Konteks Ujian</CardTitle><CardDescription>Hanya Olimpiade yang memiliki pengerjaan. Business Plan / IT Case tidak perlu.</CardDescription></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2"><Label>Kompetisi</Label><Select value={competitionId} onValueChange={(v) => { setCompetitionId(v ?? ''); setStageId(''); setExamId('') }}><SelectTrigger><span data-slot="select-value" className="flex flex-1 truncate text-left">{competitionRows.find(c => c.id === competitionId)?.name ?? 'Pilih Olimpiade'}</span></SelectTrigger><SelectContent>{competitionRows.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>Tahap</Label><Select value={stageId} onValueChange={(v) => { setStageId(v ?? ''); setExamId('') }} disabled={!competitionId || stages.isLoading}><SelectTrigger><span data-slot="select-value" className="flex flex-1 truncate text-left">{stageRows.find(s => s.id === stageId) ? `Tahap ${stageRows.find(s => s.id === stageId)?.order} · ${stageRows.find(s => s.id === stageId)?.name}` : stages.isLoading ? 'Memuat...' : 'Pilih tahap'}</span></SelectTrigger><SelectContent>{stageRows.map(s => <SelectItem key={s.id} value={s.id}>Tahap {s.order} · {s.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>Ujian</Label><Select value={examId} onValueChange={(v) => { setExamId(v ?? ''); setPage(1) }} disabled={!stageId || exams.isLoading}><SelectTrigger><span data-slot="select-value" className="flex flex-1 truncate text-left">{examRows.find(e => e.id === examId)?.title ?? (exams.isLoading ? 'Memuat...' : 'Pilih ujian')}</span></SelectTrigger><SelectContent>{examRows.map(e => <SelectItem key={e.id} value={e.id}>{e.title} · {e.duration}m · {e.maxAttempts}x</SelectItem>)}</SelectContent></Select></div>
          </CardContent>
        </Card>

        {!examId ? (
          <Card className="border-dashed"><CardContent className="p-8 text-center text-sm text-muted-foreground">Pilih ujian Olimpiade untuk melihat pengerjaan.</CardContent></Card>
        ) : (
          <Card className="border-border/60 bg-card/70">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">Daftar Pengerjaan <Badge variant="outline">{paginated?.total ?? 0} attempt</Badge></CardTitle>
              <CardDescription>Flagged = alert-only (suspicious ≥50 atau cheat ≥5). Tidak memblokir submit.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-end">
                <div className="space-y-2 md:w-48"><Label>Filter Flagged</Label><Select value={flagged} onValueChange={(v) => { setFlagged(v ?? 'all'); setPage(1) }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Semua</SelectItem><SelectItem value="flagged">Flagged saja</SelectItem><SelectItem value="clean">Tidak flagged</SelectItem></SelectContent></Select></div>
                <div className="flex-1 space-y-2"><Label>Cari Tim (kode/nama/email)</Label><div className="flex gap-2"><div className="relative flex-1"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="ISAC-... / nama / email" className="pl-9" onKeyDown={(e) => { if (e.key === 'Enter') { setSearch(searchInput); setPage(1) } }} /></div><Button variant="outline" onClick={() => { setSearch(searchInput); setPage(1) }}>Cari</Button><Button variant="ghost" onClick={() => { setSearch(''); setSearchInput(''); setFlagged('all'); setPage(1) }}>Reset</Button></div></div>
              </div>

              {attempts.isLoading ? (
                <div className="p-8 text-center text-sm text-muted-foreground">Memuat...</div>
              ) : attemptRows.length === 0 ? (
                <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">Belum ada pengerjaan pada filter ini.</div>
              ) : (
                <>
                  <div className="hidden overflow-hidden rounded-2xl border md:block">
                    <Table>
                      <TableHeader><TableRow><TableHead>Tim</TableHead><TableHead>Nilai</TableHead><TableHead>Status</TableHead><TableHead>Cheat</TableHead><TableHead>Aksi</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {attemptRows.map(a => (
                          <TableRow key={a.id} className={a.flagged ? 'bg-destructive/5' : ''}>
                            <TableCell><div><p className="font-medium">{a.team?.code ?? a.teamId}</p><p className="text-xs text-muted-foreground">{a.team?.name ?? '-'} · {a.team?.email ?? ''}</p></div></TableCell>
                            <TableCell><span className="font-medium">{a.totalScore}/{a.maxPossibleScore}</span></TableCell>
                            <TableCell><div className="flex gap-1">{a.finished ? <Badge variant="secondary">Selesai</Badge> : <Badge variant="outline">Berjalan</Badge>}{a.flagged && <Badge variant="destructive" className="gap-1"><Flag className="size-3" />Flagged</Badge>}</div></TableCell>
                            <TableCell><div className="flex flex-col text-xs"><span className={a.suspiciousScore >= 50 ? 'text-destructive font-medium' : ''}>score {a.suspiciousScore}</span><span className="text-muted-foreground">cheat {a.cheatCount}</span></div></TableCell>
                            <TableCell><Button size="sm" variant="outline" onClick={() => openDetail(a.id)}>Detail</Button></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <div className="grid gap-3 md:hidden">
                    {attemptRows.map(a => (
                      <Card key={a.id} className={a.flagged ? 'border-destructive/40 bg-destructive/5' : ''}><CardContent className="p-4 space-y-2"><div className="flex justify-between"><p className="font-medium">{a.team?.code}</p>{a.flagged && <Badge variant="destructive"><ShieldAlert className="mr-1 size-3" />Flagged</Badge>}</div><p className="text-xs text-muted-foreground">{a.team?.name} · {a.totalScore}/{a.maxPossibleScore}</p><div className="flex justify-between text-xs"><span>{a.finished ? 'Selesai' : 'Berjalan'}</span><span>cheat {a.cheatCount} · susp {a.suspiciousScore}</span></div><Button size="sm" className="w-full" variant="outline" onClick={() => openDetail(a.id)}>Lihat Detail</Button></CardContent></Card>
                    ))}
                  </div>
                  {paginated && paginated.last_page > 1 && (
                    <div className="flex items-center justify-between text-sm"><Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>Sebelumnya</Button><span>{page} / {paginated.last_page} · {paginated.total} data</span><Button variant="outline" size="sm" disabled={page >= paginated.last_page} onClick={() => setPage(p => p + 1)}>Berikutnya</Button></div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        )}

        <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
          <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
            <DialogHeader><DialogTitle>Detail Pengerjaan</DialogTitle><DialogDescription>Timeline cheat + jawaban + perbarui nilai manual (audit).</DialogDescription></DialogHeader>
            {!activeDetail ? (
              <div className="p-6 text-center text-sm text-muted-foreground">Memuat...</div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-xl border p-3 text-sm">
                  <p className="font-medium">{activeDetail.attempt.team?.code} · {activeDetail.attempt.team?.name}</p>
                  <p className="text-xs text-muted-foreground">Nilai: {activeDetail.attempt.totalScore}/{activeDetail.attempt.maxPossibleScore} · Flagged: {activeDetail.attempt.flagged ? 'Ya' : 'Tidak'} · Susp: {activeDetail.attempt.suspiciousScore}</p>
                  <p className="text-xs text-muted-foreground">Mulai: {activeDetail.attempt.startTime} · Selesai: {activeDetail.attempt.endTime ?? '-'} · {activeDetail.attempt.finished ? 'Finished' : 'Belum'}</p>
                </div>

                <div className="space-y-2"><Label>Perbarui Nilai Manual (audit)</Label><div className="grid grid-cols-2 gap-2"><Input type="number" value={scoreInput} onChange={(e) => setScoreInput(e.target.value)} placeholder="0 - max" /><Button onClick={() => updateScore.mutate()} disabled={updateScore.isPending || !reasonInput.trim()}>{updateScore.isPending ? 'Menyimpan...' : 'Simpan Nilai'}</Button></div><Textarea value={reasonInput} onChange={(e) => setReasonInput(e.target.value)} placeholder="Alasan 1-2000 karakter (wajib audit)" rows={2} /><p className="text-xs text-muted-foreground">Max {activeDetail.attempt.maxPossibleScore}. Butuh alasan.</p>{updateScore.isSuccess && <p className="text-xs text-green-600">Nilai diperbarui & tercatat di admin_audit_logs.</p>}{updateScore.isError && <p className="text-xs text-destructive">Gagal. Cek max & alasan.</p>}</div>

                <div><p className="mb-2 text-sm font-medium">Timeline</p>{activeDetail.timeline.length === 0 ? <p className="text-xs text-muted-foreground">Belum ada event.</p> : <div className="space-y-1 rounded-xl border bg-muted/20 p-3 text-xs">{activeDetail.timeline.slice(0, 30).map((t: any) => <div key={t.id} className="flex justify-between gap-2"><span className="font-mono">{t.type}</span><span className="truncate text-muted-foreground">{t.createdAt}</span></div>)}</div>}</div>

                <div><p className="mb-2 text-sm font-medium">Jawaban ({activeDetail.answers.length})</p><div className="space-y-2">{activeDetail.answers.map((ans: any) => <div key={ans.id} className="rounded-xl border p-3 text-xs"><p className="font-medium">Soal: {ans.questionId}</p><p>Jawab: {ans.answer ?? JSON.stringify(ans.selectedOptions) ?? '-'}</p><p>Benar: {String(ans.isCorrect)} · Skor: {String(ans.scoreObtained)} · Waktu: {ans.timeSpent ?? 0}s</p>{ans.correctAnswer && <p className="text-muted-foreground">Kunci: {ans.correctAnswer}</p>}</div>)}</div></div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </>
  )
}

AdminJudging.layout = adminPageLayout
