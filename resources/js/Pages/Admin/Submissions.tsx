import { Link } from '@inertiajs/react'
import { AlertTriangle, CalendarClock, ChevronLeft, ChevronRight, ClipboardCheck, Eye, FilterX, Loader2, Search, Users, X } from 'lucide-react'
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
import { SubmissionStagePicker } from '@/features/admin/components/SubmissionStagePicker'
import { useAdminMissingSubmissions } from '@/features/admin/hooks/useAdmin'
import { useDebouncedSearch, useUrlFilters } from '@/features/admin/hooks/useUrlFilters'
import type { AdminMissingSubmissionFilters, AdminMissingSubmissionState, AdminMissingSubmissionTeam } from '@/features/admin/types/adminTypes'
import { formatDateTime } from '@/features/admin/utils/judging'
import { useAuthSession } from '@/features/auth/context/AuthProvider'
import { cn } from '@/lib/utils'

const PER_PAGE = 20
const defaults = { competition: '', stage: '', state: '', q: '', page: '' }
const stateOptions: { value: '' | AdminMissingSubmissionState; label: string }[] = [
  { value: '', label: 'Semua' },
  { value: 'not_started', label: 'Belum mulai' },
  { value: 'draft', label: 'Draft' },
]

function windowStatus(startDate: string | null, endDate: string | null) {
  const now = Date.now()
  if (startDate && now < new Date(startDate).getTime()) return { label: 'Belum dibuka', tone: 'border-muted-foreground/25 bg-muted text-muted-foreground' }
  if (endDate && now > new Date(endDate).getTime()) return { label: 'Sudah ditutup', tone: 'border-destructive/25 bg-destructive/10 text-destructive' }
  return { label: 'Sedang dibuka', tone: 'border-accent/25 bg-accent/10 text-accent' }
}

function StateBadge({ team }: { team: AdminMissingSubmissionTeam }) {
  if (team.state === 'not_started') return <Badge variant="outline" className="border-destructive/25 bg-destructive/10 text-destructive">Belum mulai</Badge>
  return (
    <div className="space-y-1">
      <Badge variant="outline" className="border-amber-400/25 bg-amber-400/10 text-amber-300">{team.submission?.withdrawn ? 'Ditarik ke draft' : 'Draft'}</Badge>
      <p className="max-w-52 break-words text-xs text-muted-foreground">{team.submission?.title}{team.submission?.hasFile ? '' : ' · tanpa file'}</p>
    </div>
  )
}

function Remark({ team }: { team: AdminMissingSubmissionTeam }) {
  if (team.advancedPast) return <span className="inline-flex items-start gap-1 text-xs text-destructive"><AlertTriangle className="mt-0.5 size-3.5 shrink-0" />Sudah dipindah ke {team.currentStage?.name ?? 'tahap berikutnya'} tanpa submission</span>
  if (team.lapsed) return <span className="inline-flex items-start gap-1 text-xs text-destructive"><AlertTriangle className="mt-0.5 size-3.5 shrink-0" />Batas waktu tahap sudah lewat</span>
  return <span className="text-xs text-muted-foreground">Masih dalam periode pengumpulan</span>
}

function SummaryTile({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-background/40 p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn('mt-1 text-2xl font-semibold tabular-nums', tone)}>{value}</p>
    </div>
  )
}

export default function AdminSubmissions() {
  const { filters, setFilters } = useUrlFilters(defaults)
  const [searchInput, setSearchInput] = useDebouncedSearch(filters.q, (value) => setFilters({ q: value, page: '' }))
  const { principal } = useAuthSession()
  const canOpenTeam = principal?.principalType === 'ADMIN' && ['super_admin', 'admin_registration'].includes(principal.admin.role)
  const page = Math.max(1, Number(filters.page) || 1)

  const query: AdminMissingSubmissionFilters = {
    page,
    per_page: PER_PAGE,
    search: filters.q || undefined,
    state: filters.state as AdminMissingSubmissionFilters['state'],
  }
  const missingQuery = useAdminMissingSubmissions(filters.stage || undefined, query)

  const result = missingQuery.data?.data
  const paginated = result?.teams
  const teams = paginated?.data ?? []
  const refreshing = missingQuery.isFetching && !missingQuery.isLoading
  const listFilterCount = [filters.q, filters.state].filter(Boolean).length
  const windowInfo = result ? windowStatus(result.stage.startDate, result.stage.endDate) : null

  // Halaman yang tersimpan di URL bisa melebihi jumlah halaman setelah data berubah.
  const lastPage = paginated?.last_page
  useEffect(() => {
    if (lastPage && page > lastPage) setFilters({ page: lastPage > 1 ? String(lastPage) : '' })
  }, [lastPage, page, setFilters])

  function clearListFilters() {
    setSearchInput('')
    setFilters({ q: '', state: '', page: '' })
  }

  return (
    <>
      <Seo title="Submission Belum Masuk" description="Pantau tim BPC dan BIC yang belum mengumpulkan submission pada tiap tahap." canonical="/admin/submissions" noindex />
      <AdminPageHeader title="Submission Belum Masuk" description="Pilih kompetisi BPC atau BIC dan tahapnya untuk melihat tim terverifikasi yang belum mengumpulkan submission, termasuk yang baru berupa draft."
        action={filters.stage ? <Link href={`/admin/submission-review?competition=${filters.competition}&stage=${filters.stage}`} className={cn(buttonVariants({ variant: 'outline' }))}><ClipboardCheck />Lihat yang sudah masuk</Link> : undefined}
      />

      <div className="space-y-6">
        <SubmissionStagePicker
          competitionId={filters.competition}
          stageId={filters.stage}
          onChange={(patch) => { setSearchInput(''); setFilters({ ...patch, state: '', q: '', page: '' }) }}
          description="Hanya tim terverifikasi yang sudah mencapai tahap terpilih yang dihitung."
        >
          {result && windowInfo && (
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-3 py-1', windowInfo.tone)}><CalendarClock className="size-3.5" />{windowInfo.label}</span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/40 px-3 py-1">Mulai {formatDateTime(result.stage.startDate)}</span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/40 px-3 py-1">Batas {formatDateTime(result.stage.endDate)}</span>
            </div>
          )}
        </SubmissionStagePicker>

        {!filters.stage ? (
          <AdminEmptyState title="Pilih tahap terlebih dahulu" description="Daftar tim yang belum mengumpulkan submission akan tampil setelah kompetisi dan tahap dipilih." />
        ) : missingQuery.isLoading ? (
          <AdminLoadingState label="Memuat daftar tim..." />
        ) : missingQuery.error && !result ? (
          <AdminErrorState message={missingQuery.error.message} retry={() => missingQuery.refetch()} />
        ) : result && (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <SummaryTile label="Seharusnya mengumpulkan" value={result.summary.expected} />
              <SummaryTile label="Sudah mengumpulkan" value={result.summary.submitted} tone="text-accent" />
              <SummaryTile label="Belum mulai" value={result.summary.notStarted} tone={result.summary.notStarted > 0 ? 'text-destructive' : undefined} />
              <SummaryTile label="Baru draft" value={result.summary.draft} tone={result.summary.draft > 0 ? 'text-amber-300' : undefined} />
            </div>

            <Card className="border-border/60 bg-card/70 backdrop-blur-md">
              <CardHeader>
                <CardTitle className="flex flex-wrap items-center justify-between gap-2">Tim Belum Mengumpulkan <Badge variant="outline">{result.summary.missing} dari {result.summary.expected} tim</Badge></CardTitle>
                <CardDescription>Belum mengumpulkan berarti tidak punya submission, atau hanya draft yang belum dikirim. Submission yang sedang direvisi atau sudah dinilai tidak dihitung.</CardDescription>
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
                    <span id="state-filter-label">Status submission</span>
                    <div role="group" aria-labelledby="state-filter-label" className="flex rounded-3xl border border-input bg-background/60 p-0.5">
                      {stateOptions.map((option) => (
                        <button key={option.value} type="button" aria-pressed={filters.state === option.value} onClick={() => setFilters({ state: option.value, page: '' })} className={cn('h-9 flex-1 whitespace-nowrap rounded-3xl px-3 text-sm transition-colors lg:flex-none', filters.state === option.value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}>{option.label}</button>
                      ))}
                    </div>
                  </div>
                  <Button variant="outline" onClick={clearListFilters} disabled={listFilterCount === 0 && !searchInput}><FilterX />Reset</Button>
                </div>

                {teams.length === 0 ? (
                  <AdminEmptyState
                    title={listFilterCount > 0 ? 'Tim tidak ditemukan' : result.summary.expected === 0 ? 'Belum ada tim di tahap ini' : 'Semua tim sudah mengumpulkan'}
                    description={listFilterCount > 0 ? 'Tidak ada tim yang cocok dengan pencarian dan filter aktif.' : result.summary.expected === 0 ? 'Belum ada tim terverifikasi yang mencapai tahap ini.' : 'Tidak ada tim terverifikasi yang masih berutang submission pada tahap ini.'}
                    action={listFilterCount > 0 ? <Button variant="outline" onClick={clearListFilters}><FilterX />Reset pencarian & filter</Button> : undefined}
                  />
                ) : (
                  <div className={cn('space-y-4 transition-opacity', refreshing && 'opacity-60')} aria-busy={refreshing}>
                    {refreshing && <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Loader2 className="size-3.5 animate-spin" />Memperbarui...</p>}
                    <div className="hidden overflow-hidden rounded-2xl border border-border/60 xl:block">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Tim</TableHead>
                            <TableHead>Kontak</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Keterangan</TableHead>
                            {canOpenTeam && <TableHead className="text-right">Aksi</TableHead>}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {teams.map((team) => (
                            <TableRow key={team.id} className={cn(team.lapsed && 'bg-destructive/5 hover:bg-destructive/10')}>
                              <TableCell className="max-w-64 whitespace-normal! align-top">
                                <p className="break-all font-medium">{team.code}</p>
                                <p className="break-words text-xs text-muted-foreground">{team.name ?? 'Tanpa nama'}</p>
                              </TableCell>
                              <TableCell className="max-w-64 whitespace-normal! align-top text-xs">
                                <p className="break-all">{team.email}</p>
                                {team.phone && <p className="text-muted-foreground">{team.phone}</p>}
                                {team.institutionName && <p className="break-words text-muted-foreground">{team.institutionName}</p>}
                              </TableCell>
                              <TableCell className="align-top"><StateBadge team={team} /></TableCell>
                              <TableCell className="max-w-64 whitespace-normal! align-top"><Remark team={team} /></TableCell>
                              {canOpenTeam && <TableCell className="text-right align-top"><Link href={`/admin/teams/${team.id}`} className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}><Eye />Detail Tim</Link></TableCell>}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2 xl:hidden">
                      {teams.map((team) => (
                        <Card key={team.id} className={cn('border-border/60 bg-card/70', team.lapsed && 'border-destructive/40 bg-destructive/5')}>
                          <CardContent className="flex h-full flex-col gap-3 p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="break-all font-medium">{team.code}</p>
                                <p className="break-words text-xs text-muted-foreground">{team.name ?? 'Tanpa nama'}</p>
                              </div>
                              <div className="shrink-0"><StateBadge team={team} /></div>
                            </div>
                            <div className="space-y-0.5 text-xs">
                              <p className="break-all">{team.email}</p>
                              {team.phone && <p className="text-muted-foreground">{team.phone}</p>}
                              {team.institutionName && <p className="break-words text-muted-foreground">{team.institutionName}</p>}
                            </div>
                            <Remark team={team} />
                            {canOpenTeam && <Link href={`/admin/teams/${team.id}`} className={cn(buttonVariants({ variant: 'outline' }), 'mt-auto w-full')}><Eye />Lihat Detail Tim</Link>}
                          </CardContent>
                        </Card>
                      ))}
                    </div>

                    {paginated && (
                      <div className="flex flex-col items-center justify-between gap-3 text-sm text-muted-foreground sm:flex-row">
                        <p className="flex items-center gap-1.5"><Users className="size-3.5" />Menampilkan {(paginated.current_page - 1) * paginated.per_page + 1}–{Math.min(paginated.current_page * paginated.per_page, paginated.total)} dari {paginated.total} tim</p>
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
          </>
        )}
      </div>
    </>
  )
}

AdminSubmissions.layout = adminPageLayout
