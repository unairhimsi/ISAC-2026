import { Link } from '@inertiajs/react'
import { ChevronLeft, ChevronRight, ExternalLink, Eye, FileX2, FilterX, Loader2, Search, Trophy, X } from 'lucide-react'
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
import { SubmissionStatusBadge } from '@/features/admin/components/SubmissionStatusBadge'
import { useAdminSubmissions } from '@/features/admin/hooks/useAdmin'
import { useDebouncedSearch, useUrlFilters } from '@/features/admin/hooks/useUrlFilters'
import { useAuthSession } from '@/features/auth/context/AuthProvider'
import type { AdminSubmission, AdminSubmissionFilters, AdminSubmissionStatus } from '@/features/admin/types/adminTypes'
import { formatDateTime } from '@/features/admin/utils/judging'
import { safeFileUrl, submissionStatusMeta } from '@/features/admin/utils/submissions'
import { cn } from '@/lib/utils'

const PER_PAGE = 20
const defaults = { competition: '', stage: '', status: '', q: '', page: '' }
const statusOptions: { value: '' | AdminSubmissionStatus; label: string }[] = [
  { value: '', label: 'Semua' },
  { value: 'submitted', label: submissionStatusMeta.submitted.label },
  { value: 'under_review', label: submissionStatusMeta.under_review.label },
  { value: 'revision_requested', label: submissionStatusMeta.revision_requested.label },
  { value: 'approved', label: submissionStatusMeta.approved.label },
  { value: 'rejected', label: submissionStatusMeta.rejected.label },
]

function ScoreCell({ submission }: { submission: AdminSubmission }) {
  if (submission.score === null) return <span className="text-xs text-muted-foreground">—</span>
  return <span className="font-medium tabular-nums">{submission.score}<span className="text-muted-foreground">/100</span></span>
}

function FileLink({ submission }: { submission: AdminSubmission }) {
  const url = safeFileUrl(submission.file?.url)
  if (!url) return <span className="text-xs text-muted-foreground">Tanpa file</span>
  return <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary underline-offset-4 hover:underline"><ExternalLink className="size-3" />Buka file</a>
}

export default function AdminSubmissionReview() {
  const { filters, setFilters, queryString } = useUrlFilters(defaults)
  const [searchInput, setSearchInput] = useDebouncedSearch(filters.q, (value) => setFilters({ q: value, page: '' }))
  const { principal } = useAuthSession()
  const canAdvance = principal?.principalType === 'ADMIN' && ['super_admin', 'admin_registration'].includes(principal.admin.role)
  const page = Math.max(1, Number(filters.page) || 1)

  const query: AdminSubmissionFilters = {
    page,
    per_page: PER_PAGE,
    search: filters.q || undefined,
    status: filters.status as AdminSubmissionFilters['status'],
  }
  const submissionsQuery = useAdminSubmissions(filters.stage || undefined, query)
  const paginated = submissionsQuery.data?.data
  const submissions = paginated?.data ?? []
  const meta = paginated?.meta
  const refreshing = submissionsQuery.isFetching && !submissionsQuery.isLoading
  const listFilterCount = [filters.q, filters.status].filter(Boolean).length

  // Halaman yang tersimpan di URL bisa melebihi jumlah halaman setelah data berubah.
  const lastPage = meta?.last_page
  useEffect(() => {
    if (lastPage && page > lastPage) setFilters({ page: lastPage > 1 ? String(lastPage) : '' })
  }, [lastPage, page, setFilters])

  function clearListFilters() {
    setSearchInput('')
    setFilters({ q: '', status: '', page: '' })
  }

  const detailHref = (submission: AdminSubmission) => `/admin/submission-review/${submission.id}${queryString}`

  return (
    <>
      <Seo title="Review Submission" description="Tinjau dan nilai submission BPC dan BIC yang sudah dikumpulkan tim." canonical="/admin/submission-review" noindex />
      <AdminPageHeader
        title="Review Submission"
        description="Pilih kompetisi BPC atau BIC dan tahapnya untuk meninjau submission yang sudah dikumpulkan tim. Submission yang belum ditinjau tampil paling atas."
        action={filters.stage ? (
          <div className="flex flex-wrap gap-2">
            <Link href={`/admin/submissions?competition=${filters.competition}&stage=${filters.stage}`} className={cn(buttonVariants({ variant: 'outline' }))}><FileX2 />Lihat yang belum masuk</Link>
            {canAdvance && <Link href={`/admin/stage-advancement?competition=${filters.competition}&stage=${filters.stage}`} className={cn(buttonVariants({ variant: 'outline' }))}><Trophy />Tentukan yang lolos</Link>}
          </div>
        ) : undefined}
      />

      <div className="space-y-6">
        <SubmissionStagePicker
          competitionId={filters.competition}
          stageId={filters.stage}
          onChange={(patch) => { setSearchInput(''); setFilters({ ...patch, status: '', q: '', page: '' }) }}
          description="Draft yang belum dikirim tim tidak ditampilkan di sini; lihat halaman submission belum masuk."
        />

        {!filters.stage ? (
          <AdminEmptyState title="Pilih tahap terlebih dahulu" description="Daftar submission akan tampil setelah kompetisi dan tahap dipilih." />
        ) : (
          <Card className="border-border/60 bg-card/70 backdrop-blur-md">
            <CardHeader>
              <CardTitle className="flex flex-wrap items-center justify-between gap-2">Daftar Submission <Badge variant="outline">{meta?.total ?? 0} submission</Badge></CardTitle>
              <CardDescription>Urutan: menunggu ditinjau, sedang ditinjau, perlu revisi, lalu yang sudah diputuskan.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
                <label className="flex-1 space-y-1.5 text-xs text-muted-foreground">Cari tim
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input type="search" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Kode atau nama tim..." maxLength={100} className="h-10 rounded-3xl bg-background/60 pl-8 pr-9 [&::-webkit-search-cancel-button]:hidden" />
                    {searchInput && <button type="button" onClick={() => { setSearchInput(''); setFilters({ q: '', page: '' }) }} aria-label="Hapus pencarian" className="absolute right-2 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"><X className="size-3.5" /></button>}
                  </div>
                </label>
                <div className="space-y-1.5 text-xs text-muted-foreground">
                  <span id="review-status-filter-label">Status</span>
                  <div role="group" aria-labelledby="review-status-filter-label" className="flex flex-wrap rounded-3xl border border-input bg-background/60 p-0.5">
                    {statusOptions.map((option) => (
                      <button key={option.value} type="button" aria-pressed={filters.status === option.value} onClick={() => setFilters({ status: option.value, page: '' })} className={cn('h-9 flex-1 whitespace-nowrap rounded-3xl px-3 text-sm transition-colors lg:flex-none', filters.status === option.value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}>{option.label}</button>
                    ))}
                  </div>
                </div>
                <Button variant="outline" onClick={clearListFilters} disabled={listFilterCount === 0 && !searchInput}><FilterX />Reset</Button>
              </div>

              {submissionsQuery.isLoading ? (
                <AdminLoadingState label="Memuat daftar submission..." />
              ) : submissionsQuery.error && !paginated ? (
                <AdminErrorState message={submissionsQuery.error.message} retry={() => submissionsQuery.refetch()} />
              ) : submissions.length === 0 ? (
                <AdminEmptyState
                  title={listFilterCount > 0 ? 'Submission tidak ditemukan' : 'Belum ada submission'}
                  description={listFilterCount > 0 ? 'Tidak ada submission yang cocok dengan pencarian dan filter aktif.' : 'Belum ada tim yang mengumpulkan submission pada tahap ini.'}
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
                          <TableHead>Judul</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Nilai</TableHead>
                          <TableHead className="whitespace-nowrap">Dikumpulkan</TableHead>
                          <TableHead className="text-right">Aksi</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {submissions.map((submission) => (
                          <TableRow key={submission.id}>
                            <TableCell className="max-w-56 whitespace-normal! align-top">
                              <p className="break-all font-medium">{submission.team?.code ?? submission.teamId}</p>
                              <p className="break-words text-xs text-muted-foreground">{submission.team?.name ?? 'Tanpa nama'}</p>
                            </TableCell>
                            <TableCell className="max-w-64 whitespace-normal! align-top">
                              <p className="break-words">{submission.title}</p>
                              <FileLink submission={submission} />
                            </TableCell>
                            <TableCell className="align-top"><SubmissionStatusBadge status={submission.status} /></TableCell>
                            <TableCell className="align-top"><ScoreCell submission={submission} /></TableCell>
                            <TableCell className="whitespace-nowrap align-top text-xs text-muted-foreground">{formatDateTime(submission.submittedAt)}</TableCell>
                            <TableCell className="text-right align-top"><Link href={detailHref(submission)} className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}><Eye />Tinjau</Link></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2 xl:hidden">
                    {submissions.map((submission) => (
                      <Card key={submission.id} className="border-border/60 bg-card/70">
                        <CardContent className="flex h-full flex-col gap-3 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="break-all font-medium">{submission.team?.code ?? submission.teamId}</p>
                              <p className="break-words text-xs text-muted-foreground">{submission.team?.name ?? 'Tanpa nama'}</p>
                            </div>
                            <div className="shrink-0"><SubmissionStatusBadge status={submission.status} /></div>
                          </div>
                          <p className="break-words text-sm">{submission.title}</p>
                          <div className="flex items-center justify-between gap-3 text-xs">
                            <FileLink submission={submission} />
                            <ScoreCell submission={submission} />
                          </div>
                          <p className="text-xs text-muted-foreground">Dikumpulkan {formatDateTime(submission.submittedAt)}</p>
                          <Link href={detailHref(submission)} className={cn(buttonVariants({ variant: 'outline' }), 'mt-auto w-full')}><Eye />Tinjau</Link>
                        </CardContent>
                      </Card>
                    ))}
                  </div>

                  {meta && (
                    <div className="flex flex-col items-center justify-between gap-3 text-sm text-muted-foreground sm:flex-row">
                      <p>Menampilkan {meta.from ?? 0}–{meta.to ?? 0} dari {meta.total} submission</p>
                      {meta.last_page > 1 && (
                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="sm" disabled={meta.current_page <= 1} onClick={() => setFilters({ page: meta.current_page - 1 > 1 ? String(meta.current_page - 1) : '' })}><ChevronLeft />Sebelumnya</Button>
                          <span className="px-2">{meta.current_page} / {meta.last_page}</span>
                          <Button variant="outline" size="sm" disabled={meta.current_page >= meta.last_page} onClick={() => setFilters({ page: String(meta.current_page + 1) })}>Berikutnya<ChevronRight /></Button>
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

AdminSubmissionReview.layout = adminPageLayout
