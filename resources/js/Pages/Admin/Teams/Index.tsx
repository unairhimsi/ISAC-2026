import { Link } from '@inertiajs/react'
import { ChevronLeft, ChevronRight, Eye, FilterX, Loader2, Search, X } from 'lucide-react'
import { useEffect } from 'react'
import { Seo } from '@/components/seo/Seo'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { AdminPageHeader } from '@/features/admin/components/AdminPageHeader'
import { AdminStatusBadge, adminStatusLabel } from '@/features/admin/components/AdminStatusBadge'
import { AdminEmptyState, AdminErrorState, AdminLoadingState } from '@/features/admin/components/AdminStates'
import { adminPageLayout } from '@/features/admin/components/AdminShell'
import { useAdminBatches, useAdminCompetitions, useAdminTeams } from '@/features/admin/hooks/useAdmin'
import { useDebouncedSearch, useUrlFilters } from '@/features/admin/hooks/useUrlFilters'
import type { AdminTeamFilters } from '@/features/admin/types/adminTypes'
import { cn } from '@/lib/utils'

const teamStatuses = ['INCOMPLETE', 'WAITING_VERIFICATION', 'VERIFIED', 'REVISION_REQUIRED', 'REJECTED'] as const
const PER_PAGE = 15
const selectClass = 'h-10 w-full rounded-3xl border border-input bg-background/60 px-3 text-sm text-foreground outline-none focus:border-primary disabled:cursor-not-allowed disabled:opacity-60'
const defaults = { q: '', status: '', competition: '', batch: '', page: '' }

function formatDate(value: string | null | undefined) {
  if (!value) return 'Belum submit'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

export default function AdminTeamsIndex() {
  const { filters, setFilters, resetFilters, queryString } = useUrlFilters(defaults)
  const [searchInput, setSearchInput] = useDebouncedSearch(filters.q, (value) => setFilters({ q: value, page: '' }))
  const page = Math.max(1, Number(filters.page) || 1)

  const query: AdminTeamFilters = {
    page,
    per_page: PER_PAGE,
    search: filters.q || undefined,
    status: filters.status as AdminTeamFilters['status'],
    competition_id: filters.competition || undefined,
    batch_id: filters.batch || undefined,
  }
  const teamsQuery = useAdminTeams(query)
  const competitionsQuery = useAdminCompetitions({ perPage: 100 })
  const batchesQuery = useAdminBatches(filters.competition || undefined)
  const pagination = teamsQuery.data?.data
  const teams = pagination?.data ?? []
  const competitions = competitionsQuery.data?.data ?? []
  const competitionNames = new Map(competitions.map((competition) => [competition.id, competition.name]))
  const activeFilterCount = [filters.q, filters.status, filters.competition, filters.batch].filter(Boolean).length
  const refreshing = teamsQuery.isFetching && !teamsQuery.isLoading

  // Halaman yang tersimpan di URL bisa melebihi jumlah halaman setelah data berubah.
  const lastPage = pagination?.meta.last_page
  useEffect(() => {
    if (lastPage && page > lastPage) setFilters({ page: lastPage > 1 ? String(lastPage) : '' })
  }, [lastPage, page, setFilters])

  function handleReset() {
    setSearchInput('')
    resetFilters()
  }

  return (
    <>
      <Seo title="Verifikasi Tim Admin" description="Daftar dan status pendaftaran tim ISAC 2026." canonical="/admin/teams" noindex />
      <AdminPageHeader title="Verifikasi Tim" description="Cari tim atau peserta, filter berdasarkan status, kompetisi, dan batch, lalu buka detail untuk melakukan review." />

      <Card className="mb-5 border-border/60 bg-card/70 backdrop-blur-md">
        <CardContent className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-[1.4fr_1fr_1fr_1fr_auto]">
          <label className="space-y-1.5 text-xs text-muted-foreground sm:col-span-2 xl:col-span-1">Cari tim atau peserta
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Kode, nama tim, email, institusi, peserta..."
                maxLength={100}
                className="h-10 rounded-3xl bg-background/60 pl-8 pr-9 [&::-webkit-search-cancel-button]:hidden"
              />
              {searchInput && (
                <button type="button" onClick={() => { setSearchInput(''); setFilters({ q: '', page: '' }) }} aria-label="Hapus pencarian" className="absolute right-2 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                  <X className="size-3.5" />
                </button>
              )}
            </div>
          </label>
          <label className="space-y-1.5 text-xs text-muted-foreground">Status tim
            <select value={filters.status} onChange={(event) => setFilters({ status: event.target.value, page: '' })} className={selectClass}>
              <option value="">Semua status</option>
              {teamStatuses.map((status) => <option key={status} value={status}>{adminStatusLabel(status)}</option>)}
            </select>
          </label>
          <label className="space-y-1.5 text-xs text-muted-foreground">Kompetisi
            <select value={filters.competition} onChange={(event) => setFilters({ competition: event.target.value, batch: '', page: '' })} className={selectClass}>
              <option value="">Semua kompetisi</option>
              {competitions.map((competition) => <option key={competition.id} value={competition.id}>{competition.name}</option>)}
            </select>
          </label>
          <label className="space-y-1.5 text-xs text-muted-foreground">Batch
            <select value={filters.batch} onChange={(event) => setFilters({ batch: event.target.value, page: '' })} className={selectClass}>
              <option value="">Semua batch</option>
              {batchesQuery.data?.data.map((batch) => (
                <option key={batch.id} value={batch.id}>{filters.competition ? batch.name : `${competitionNames.get(batch.competitionId) ?? 'Kompetisi'} · ${batch.name}`}</option>
              ))}
            </select>
          </label>
          <Button variant="outline" className="self-end" onClick={handleReset} disabled={activeFilterCount === 0 && !searchInput}>
            <FilterX />Reset{activeFilterCount > 0 && <span className="ml-1 rounded-full bg-primary/15 px-1.5 text-[11px] text-primary">{activeFilterCount}</span>}
          </Button>
        </CardContent>
      </Card>

      {teamsQuery.isLoading ? (
        <AdminLoadingState label="Memuat daftar tim..." />
      ) : teamsQuery.error && !pagination ? (
        <AdminErrorState message={teamsQuery.error.message} retry={() => teamsQuery.refetch()} />
      ) : teams.length === 0 ? (
        <AdminEmptyState
          title={activeFilterCount > 0 ? 'Tim tidak ditemukan' : 'Belum ada tim'}
          description={activeFilterCount > 0 ? 'Tidak ada tim yang cocok dengan pencarian dan filter aktif. Coba kata kunci lain atau hapus filter.' : 'Belum ada tim yang terdaftar.'}
          action={activeFilterCount > 0 ? <Button variant="outline" onClick={handleReset}><FilterX />Reset pencarian & filter</Button> : undefined}
        />
      ) : (
        <div className={cn('transition-opacity', refreshing && 'opacity-60')} aria-busy={refreshing}>
          <div className="mb-3 flex items-center justify-between gap-3 text-xs text-muted-foreground">
            <p>{pagination?.meta.total ?? teams.length} tim{filters.q ? <> untuk “<span className="font-medium text-foreground">{filters.q}</span>”</> : null}</p>
            {refreshing && <span className="flex items-center gap-1.5"><Loader2 className="size-3.5 animate-spin" />Memperbarui...</span>}
          </div>

          <Card className="hidden overflow-hidden border-border/60 bg-card/70 backdrop-blur-md md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tim</TableHead>
                  <TableHead>Institusi</TableHead>
                  <TableHead>Kompetisi</TableHead>
                  <TableHead>Status Tim</TableHead>
                  <TableHead>Status Registrasi</TableHead>
                  <TableHead className="whitespace-nowrap">Submit</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {teams.map((item) => (
                  <TableRow key={item.team.id}>
                    <TableCell className="max-w-64 whitespace-normal">
                      <p className="break-words font-medium text-foreground">{item.team.name ?? 'Belum dilengkapi'}</p>
                      <p className="break-all text-xs text-muted-foreground">{item.team.code} · {item.team.email}</p>
                    </TableCell>
                    <TableCell className="max-w-52 whitespace-normal break-words text-muted-foreground">{item.team.institutionName ?? '—'}</TableCell>
                    <TableCell className="max-w-48 whitespace-normal">
                      <p className="break-words">{item.registration?.competition.name ?? '—'}</p>
                      <p className="text-xs text-muted-foreground">{item.registration ? item.registration.batch?.name ?? 'Belum ditentukan' : '—'}</p>
                    </TableCell>
                    <TableCell><AdminStatusBadge status={item.team.status} /></TableCell>
                    <TableCell>{item.registration ? <AdminStatusBadge status={item.registration.status} /> : '—'}</TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{formatDate(item.registration?.submittedAt)}</TableCell>
                    <TableCell className="text-right"><Link href={`/admin/teams/${item.team.id}${queryString}`} className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}><Eye />Detail</Link></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          <div className="space-y-3 md:hidden">
            {teams.map((item) => (
              <Card key={item.team.id} className="border-border/60 bg-card/70">
                <CardContent className="space-y-4 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="break-words font-medium">{item.team.name ?? 'Belum dilengkapi'}</p>
                      <p className="break-all text-xs text-muted-foreground">{item.team.code}</p>
                      <p className="break-words text-xs text-muted-foreground">{item.team.institutionName ?? 'Institusi belum diisi'}</p>
                    </div>
                    <div className="shrink-0"><AdminStatusBadge status={item.team.status} /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="min-w-0"><p className="text-muted-foreground">Kompetisi</p><p className="mt-1 break-words">{item.registration?.competition.name ?? '—'}</p></div>
                    <div><p className="text-muted-foreground">Registrasi</p><div className="mt-1">{item.registration ? <AdminStatusBadge status={item.registration.status} /> : '—'}</div></div>
                    <div className="min-w-0"><p className="text-muted-foreground">Batch</p><p className="mt-1 break-words">{item.registration ? item.registration.batch?.name ?? 'Belum ditentukan' : '—'}</p></div>
                    <div><p className="text-muted-foreground">Submit</p><p className="mt-1">{formatDate(item.registration?.submittedAt)}</p></div>
                  </div>
                  <Link href={`/admin/teams/${item.team.id}${queryString}`} className={cn(buttonVariants({ variant: 'outline' }), 'w-full')}><Eye />Lihat Detail</Link>
                </CardContent>
              </Card>
            ))}
          </div>

          {pagination && (
            <div className="mt-5 flex flex-col items-center justify-between gap-3 text-sm text-muted-foreground sm:flex-row">
              <p>Menampilkan {pagination.meta.from ?? 0}–{pagination.meta.to ?? 0} dari {pagination.meta.total} tim</p>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" disabled={pagination.meta.current_page <= 1} onClick={() => setFilters({ page: pagination.meta.current_page - 1 > 1 ? String(pagination.meta.current_page - 1) : '' })}><ChevronLeft />Sebelumnya</Button>
                <span className="px-2">{pagination.meta.current_page} / {pagination.meta.last_page}</span>
                <Button variant="outline" size="sm" disabled={pagination.meta.current_page >= pagination.meta.last_page} onClick={() => setFilters({ page: String(pagination.meta.current_page + 1) })}>Berikutnya<ChevronRight /></Button>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  )
}

AdminTeamsIndex.layout = adminPageLayout
