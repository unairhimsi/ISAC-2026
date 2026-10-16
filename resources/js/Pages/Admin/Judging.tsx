import { Link } from '@inertiajs/react'
import { Award, ChevronLeft, ChevronRight, Clock, Eye, FilterX, Flag, ListChecks, Loader2, Search, Timer, X } from 'lucide-react'
import { useEffect } from 'react'
import { Seo } from '@/components/seo/Seo'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { AdminPageHeader } from '@/features/admin/components/AdminPageHeader'
import { adminPageLayout } from '@/features/admin/components/AdminShell'
import { AdminEmptyState, AdminErrorState, AdminLoadingState } from '@/features/admin/components/AdminStates'
import { useAdminCompetitions, useAdminExamAttempts, useAdminExamStages, useAdminExams } from '@/features/admin/hooks/useAdmin'
import { useDebouncedSearch, useUrlFilters } from '@/features/admin/hooks/useUrlFilters'
import type { AdminExamAttempt, AdminExamAttemptFilters } from '@/features/admin/types/adminTypes'
import { formatDateTime, scorePercent } from '@/features/admin/utils/judging'
import { cn } from '@/lib/utils'

const PER_PAGE = 20
const defaults = { competition: '', stage: '', exam: '', flagged: '', q: '', page: '' }
const selectClass = 'h-10 w-full rounded-3xl border border-input bg-background/60 px-3 text-sm text-foreground outline-none focus:border-primary disabled:cursor-not-allowed disabled:opacity-60'
const flaggedOptions = [
  { value: '', label: 'Semua' },
  { value: '1', label: 'Flagged' },
  { value: '0', label: 'Tidak flagged' },
] as const

function ScoreCell({ attempt }: { attempt: AdminExamAttempt }) {
  const percent = scorePercent(attempt.totalScore, attempt.maxPossibleScore)
  return (
    <div className="min-w-28">
      <p className="font-medium tabular-nums">{attempt.totalScore ?? '—'}<span className="text-muted-foreground">/{attempt.maxPossibleScore}</span></p>
      {percent !== null && (
        <div className="mt-1.5 flex items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label="Persentase nilai"><div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} /></div>
          <span className="text-[11px] tabular-nums text-muted-foreground">{percent}%</span>
        </div>
      )}
    </div>
  )
}

function StatusBadges({ attempt }: { attempt: AdminExamAttempt }) {
  return (
    <div className="flex flex-wrap gap-1">
      {attempt.finished ? <Badge variant="secondary">Selesai</Badge> : <Badge variant="outline">Berjalan</Badge>}
      {attempt.flagged && <Badge variant="destructive" className="gap-1"><Flag />Flagged</Badge>}
    </div>
  )
}

export default function AdminJudging() {
  const { filters, setFilters, queryString } = useUrlFilters(defaults)
  const [searchInput, setSearchInput] = useDebouncedSearch(filters.q, (value) => setFilters({ q: value, page: '' }))
  const page = Math.max(1, Number(filters.page) || 1)

  const competitionsQuery = useAdminCompetitions({ perPage: 100 })
  const stagesQuery = useAdminExamStages()
  const examsQuery = useAdminExams(filters.stage || undefined)

  const query: AdminExamAttemptFilters = {
    page,
    per_page: PER_PAGE,
    search: filters.q || undefined,
    flagged: filters.flagged as AdminExamAttemptFilters['flagged'],
  }
  const attemptsQuery = useAdminExamAttempts(filters.exam || undefined, query)

  const competitions = (competitionsQuery.data?.data ?? []).filter((competition) => competition.type === 'OLIMPIADE')
  const stages = (stagesQuery.data?.data ?? [])
    .filter((stage) => stage.competitionId === filters.competition)
    .sort((a, b) => a.order - b.order)
  const exams = examsQuery.data?.data ?? []
  const activeExam = exams.find((exam) => exam.id === filters.exam)
  const paginated = attemptsQuery.data?.data
  const attempts = paginated?.data ?? []
  const refreshing = attemptsQuery.isFetching && !attemptsQuery.isLoading
  const attemptFilterCount = [filters.q, filters.flagged].filter(Boolean).length

  // Halaman yang tersimpan di URL bisa melebihi jumlah halaman setelah data berubah.
  const lastPage = paginated?.last_page
  useEffect(() => {
    if (lastPage && page > lastPage) setFilters({ page: lastPage > 1 ? String(lastPage) : '' })
  }, [lastPage, page, setFilters])

  function clearAttemptFilters() {
    setSearchInput('')
    setFilters({ q: '', flagged: '', page: '' })
  }

  return (
    <>
      <Seo title="Penilaian Olimpiade" description="Pantau pengerjaan Olimpiade, filter flagged, dan perbarui nilai manual." canonical="/admin/judging" noindex />
      <AdminPageHeader title="Pengerjaan Olimpiade" description="Pilih ujian Olimpiade, cari tim, tandai pengerjaan mencurigakan, lalu buka detail untuk meninjau jawaban dan memperbarui nilai." />

      <div className="space-y-6">
        <Card className="border-border/60 bg-card/70 backdrop-blur-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Award className="size-4 text-primary" />Konteks Ujian</CardTitle>
            <CardDescription>Pilih kompetisi, tahap, lalu ujian. Hanya Olimpiade yang memiliki pengerjaan.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <label className="space-y-1.5 text-xs text-muted-foreground"><span className="flex items-center gap-1.5"><span className="flex size-4 items-center justify-center rounded-full bg-primary/15 text-[10px] font-semibold text-primary">1</span>Kompetisi</span>
                <select value={filters.competition} onChange={(event) => { setSearchInput(''); setFilters({ competition: event.target.value, stage: '', exam: '', q: '', flagged: '', page: '' }) }} className={selectClass} disabled={competitionsQuery.isLoading}>
                  <option value="">{competitionsQuery.isLoading ? 'Memuat...' : 'Pilih Olimpiade'}</option>
                  {competitions.map((competition) => <option key={competition.id} value={competition.id}>{competition.name}</option>)}
                </select>
              </label>
              <label className="space-y-1.5 text-xs text-muted-foreground"><span className="flex items-center gap-1.5"><span className="flex size-4 items-center justify-center rounded-full bg-primary/15 text-[10px] font-semibold text-primary">2</span>Tahap</span>
                <select value={filters.stage} onChange={(event) => { setSearchInput(''); setFilters({ stage: event.target.value, exam: '', q: '', flagged: '', page: '' }) }} className={selectClass} disabled={!filters.competition || stagesQuery.isLoading}>
                  <option value="">{!filters.competition ? 'Pilih kompetisi dulu' : stagesQuery.isLoading ? 'Memuat...' : stages.length === 0 ? 'Belum ada tahap dengan ujian' : 'Pilih tahap'}</option>
                  {stages.map((stage) => <option key={stage.id} value={stage.id}>Tahap {stage.order} · {stage.name}</option>)}
                </select>
              </label>
              <label className="space-y-1.5 text-xs text-muted-foreground"><span className="flex items-center gap-1.5"><span className="flex size-4 items-center justify-center rounded-full bg-primary/15 text-[10px] font-semibold text-primary">3</span>Ujian</span>
                <select value={filters.exam} onChange={(event) => { setSearchInput(''); setFilters({ exam: event.target.value, q: '', flagged: '', page: '' }) }} className={selectClass} disabled={!filters.stage || examsQuery.isLoading}>
                  <option value="">{!filters.stage ? 'Pilih tahap dulu' : examsQuery.isLoading ? 'Memuat...' : exams.length === 0 ? 'Belum ada ujian' : 'Pilih ujian'}</option>
                  {exams.map((exam) => <option key={exam.id} value={exam.id}>{exam.title}</option>)}
                </select>
              </label>
            </div>
            {stagesQuery.error && <p className="rounded-2xl border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm text-destructive">{stagesQuery.error.message}</p>}
            {examsQuery.error && <p className="rounded-2xl border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm text-destructive">{examsQuery.error.message}</p>}
            {activeExam && (
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/40 px-3 py-1"><ListChecks className="size-3.5 text-secondary" />{activeExam.questionCount} soal</span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/40 px-3 py-1"><Timer className="size-3.5 text-secondary" />{activeExam.duration} menit</span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/40 px-3 py-1"><Clock className="size-3.5 text-secondary" />Maks {activeExam.maxAttempts}x percobaan</span>
              </div>
            )}
          </CardContent>
        </Card>

        {!filters.exam ? (
          <AdminEmptyState title="Pilih ujian terlebih dahulu" description="Daftar pengerjaan akan tampil setelah kompetisi, tahap, dan ujian Olimpiade dipilih." />
        ) : (
          <Card className="border-border/60 bg-card/70 backdrop-blur-md">
            <CardHeader>
              <CardTitle className="flex flex-wrap items-center justify-between gap-2">Daftar Pengerjaan <Badge variant="outline">{paginated?.total ?? 0} pengerjaan</Badge></CardTitle>
              <CardDescription>Flagged adalah penanda peringatan (skor curiga ≥ 50 atau pelanggaran ≥ 5) dan tidak memblokir pengumpulan.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
                <label className="flex-1 space-y-1.5 text-xs text-muted-foreground">Cari tim
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input type="search" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Kode, nama, atau email tim..." maxLength={100} className="h-10 rounded-3xl bg-background/60 pl-8 pr-9 [&::-webkit-search-cancel-button]:hidden" />
                    {searchInput && <button type="button" onClick={() => { setSearchInput(''); setFilters({ q: '', page: '' }) }} aria-label="Hapus pencarian" className="absolute right-2 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"><X className="size-3.5" /></button>}
                  </div>
                </label>
                <div className="space-y-1.5 text-xs text-muted-foreground">
                  <span id="flagged-filter-label">Status flagged</span>
                  <div role="group" aria-labelledby="flagged-filter-label" className="flex rounded-3xl border border-input bg-background/60 p-0.5">
                    {flaggedOptions.map((option) => (
                      <button key={option.value} type="button" aria-pressed={filters.flagged === option.value} onClick={() => setFilters({ flagged: option.value, page: '' })} className={cn('h-9 flex-1 whitespace-nowrap rounded-3xl px-3 text-sm transition-colors lg:flex-none', filters.flagged === option.value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}>{option.label}</button>
                    ))}
                  </div>
                </div>
                <Button variant="outline" onClick={clearAttemptFilters} disabled={attemptFilterCount === 0 && !searchInput}><FilterX />Reset</Button>
              </div>

              {attemptsQuery.isLoading ? (
                <AdminLoadingState label="Memuat daftar pengerjaan..." />
              ) : attemptsQuery.error && !paginated ? (
                <AdminErrorState message={attemptsQuery.error.message} retry={() => attemptsQuery.refetch()} />
              ) : attempts.length === 0 ? (
                <AdminEmptyState
                  title={attemptFilterCount > 0 ? 'Pengerjaan tidak ditemukan' : 'Belum ada pengerjaan'}
                  description={attemptFilterCount > 0 ? 'Tidak ada pengerjaan yang cocok dengan pencarian dan filter aktif.' : 'Belum ada tim yang mengerjakan ujian ini.'}
                  action={attemptFilterCount > 0 ? <Button variant="outline" onClick={clearAttemptFilters}><FilterX />Reset pencarian & filter</Button> : undefined}
                />
              ) : (
                <div className={cn('space-y-4 transition-opacity', refreshing && 'opacity-60')} aria-busy={refreshing}>
                  {refreshing && <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Loader2 className="size-3.5 animate-spin" />Memperbarui...</p>}
                  <div className="hidden overflow-hidden rounded-2xl border border-border/60 xl:block">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Tim</TableHead>
                          <TableHead>Nilai</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Risiko</TableHead>
                          <TableHead className="whitespace-nowrap">Mulai</TableHead>
                          <TableHead className="text-right">Aksi</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {attempts.map((attempt) => (
                          <TableRow key={attempt.id} className={cn(attempt.flagged && 'bg-destructive/5 hover:bg-destructive/10')}>
                            <TableCell className="max-w-64 whitespace-normal! align-top">
                              <p className="break-all font-medium">{attempt.team?.code ?? attempt.teamId}</p>
                              <p className="break-words text-xs text-muted-foreground">{attempt.team?.name ?? 'Tanpa nama'}</p>
                              {attempt.team?.email && <p className="break-all text-xs text-muted-foreground">{attempt.team.email}</p>}
                            </TableCell>
                            <TableCell><ScoreCell attempt={attempt} /></TableCell>
                            <TableCell><StatusBadges attempt={attempt} /></TableCell>
                            <TableCell>
                              <div className="text-xs">
                                <p className={cn('tabular-nums', attempt.suspiciousScore >= 50 && 'font-medium text-destructive')}>Skor curiga {attempt.suspiciousScore}</p>
                                <p className={cn('tabular-nums text-muted-foreground', attempt.cheatCount >= 5 && 'font-medium text-destructive')}>{attempt.cheatCount} pelanggaran</p>
                              </div>
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{formatDateTime(attempt.startTime)}</TableCell>
                            <TableCell className="text-right"><Link href={`/admin/judging/${filters.exam}/attempts/${attempt.id}${queryString}`} className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}><Eye />Detail</Link></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2 xl:hidden">
                    {attempts.map((attempt) => (
                      <Card key={attempt.id} className={cn('border-border/60 bg-card/70', attempt.flagged && 'border-destructive/40 bg-destructive/5')}>
                        <CardContent className="flex h-full flex-col gap-3 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="break-all font-medium">{attempt.team?.code ?? attempt.teamId}</p>
                              <p className="break-words text-xs text-muted-foreground">{attempt.team?.name ?? 'Tanpa nama'}</p>
                            </div>
                            <div className="shrink-0"><StatusBadges attempt={attempt} /></div>
                          </div>
                          <div className="grid grid-cols-2 gap-3 text-xs">
                            <div><p className="mb-1 text-muted-foreground">Nilai</p><ScoreCell attempt={attempt} /></div>
                            <div><p className="mb-1 text-muted-foreground">Risiko</p><p className={cn('tabular-nums', attempt.suspiciousScore >= 50 && 'font-medium text-destructive')}>Skor curiga {attempt.suspiciousScore}</p><p className="tabular-nums text-muted-foreground">{attempt.cheatCount} pelanggaran</p></div>
                          </div>
                          <p className="text-xs text-muted-foreground">Mulai {formatDateTime(attempt.startTime)}</p>
                          <Link href={`/admin/judging/${filters.exam}/attempts/${attempt.id}${queryString}`} className={cn(buttonVariants({ variant: 'outline' }), 'mt-auto w-full')}><Eye />Lihat Detail</Link>
                        </CardContent>
                      </Card>
                    ))}
                  </div>

                  {paginated && (
                    <div className="flex flex-col items-center justify-between gap-3 text-sm text-muted-foreground sm:flex-row">
                      <p>Menampilkan {(paginated.current_page - 1) * paginated.per_page + 1}–{Math.min(paginated.current_page * paginated.per_page, paginated.total)} dari {paginated.total} pengerjaan</p>
                      {paginated.last_page > 1 && (
                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="sm" disabled={paginated.current_page <= 1} onClick={() => setFilters({ page: paginated.current_page - 1 > 1 ? String(paginated.current_page - 1) : '' })}><ChevronLeft />Sebelumnya</Button>
                          <span className="px-2">{paginated.current_page} / {paginated.last_page}</span>
                          <Button variant="outline" size="sm" disabled={paginated.current_page >= paginated.last_page} onClick={() => setFilters({ page: String(paginated.current_page + 1) })}>Berikutnya<ChevronRight /></Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </>
  )
}

AdminJudging.layout = adminPageLayout
