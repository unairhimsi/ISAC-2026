import { Link, router } from '@inertiajs/react'
import { AlertTriangle, ArrowRight, ClipboardCheck, FilterX, Loader2, Search, Send, Trophy, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Seo } from '@/components/seo/Seo'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { AdminPageHeader } from '@/features/admin/components/AdminPageHeader'
import { adminPageLayout } from '@/features/admin/components/AdminShell'
import { AdminEmptyState, AdminErrorState, AdminLoadingState } from '@/features/admin/components/AdminStates'
import { SubmissionStagePicker } from '@/features/admin/components/SubmissionStagePicker'
import { SubmissionStatusBadge } from '@/features/admin/components/SubmissionStatusBadge'
import { useAdminAdvancement, useAdminBatches, useCreateAdminOperation } from '@/features/admin/hooks/useAdmin'
import { useUrlFilters } from '@/features/admin/hooks/useUrlFilters'
import type { AdminAdvancementTeam } from '@/features/admin/types/adminTypes'
import { formatDateTime } from '@/features/admin/utils/judging'
import { cn } from '@/lib/utils'

const MAX_SELECTION = 500
const defaults = { competition: '', stage: '', batch: '', q: '', review: '' }
const selectClass = 'h-10 w-full rounded-3xl border border-input bg-background/60 px-3 text-sm text-foreground outline-none focus:border-primary disabled:cursor-not-allowed disabled:opacity-60'
const reviewOptions = [
  { value: '', label: 'Semua' },
  { value: 'approved', label: 'Disetujui juri' },
  { value: 'other', label: 'Belum disetujui' },
] as const

function ReviewCell({ team }: { team: AdminAdvancementTeam }) {
  if (!team.submission) return <span className="text-xs text-muted-foreground">Belum mengumpulkan</span>
  return (
    <div className="space-y-1">
      <SubmissionStatusBadge status={team.submission.status} />
      {team.submission.score !== null && <p className="text-xs tabular-nums"><span className="font-medium">{team.submission.score}</span><span className="text-muted-foreground">/100</span></p>}
    </div>
  )
}

function StateCell({ team }: { team: AdminAdvancementTeam }) {
  if (team.state === 'advanced') return <Badge variant="outline" className="border-accent/25 bg-accent/10 text-accent">Sudah lolos</Badge>
  if (team.state === 'blocked') return <span className="text-xs text-destructive">{team.reason}</span>
  return <span className="text-xs font-medium text-accent">Bisa dilolosan</span>
}

function SummaryTile({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-background/40 p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn('mt-1 text-2xl font-semibold tabular-nums', tone)}>{value}</p>
    </div>
  )
}

export default function AdminStageAdvancement() {
  const { filters, setFilters } = useUrlFilters(defaults)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [topN, setTopN] = useState('10')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [sendNotification, setSendNotification] = useState(true)
  const [syncSpreadsheet, setSyncSpreadsheet] = useState(true)

  const batchesQuery = useAdminBatches(filters.competition || undefined)
  const advancementQuery = useAdminAdvancement(filters.stage || undefined, filters.batch || undefined)
  const createOperation = useCreateAdminOperation()

  const result = advancementQuery.data?.data
  const nextStage = result?.nextStage ?? null
  const teams = useMemo(() => result?.teams ?? [], [result])
  const batches = filters.competition ? batchesQuery.data?.data ?? [] : []

  const visible = useMemo(() => {
    const keyword = filters.q.trim().toLowerCase()
    return teams.filter((item) => {
      if (filters.review === 'approved' && item.submission?.status !== 'approved') return false
      if (filters.review === 'other' && item.submission?.status === 'approved') return false
      if (!keyword) return true
      return [item.team.code, item.team.name ?? '', item.team.email].some((value) => value.toLowerCase().includes(keyword))
    })
  }, [teams, filters.q, filters.review])

  const eligibleVisible = useMemo(() => visible.filter((item) => item.state === 'eligible'), [visible])
  // Urutan dari server sudah nilai tertinggi lebih dulu; tim tanpa nilai tidak ikut "teratas".
  const scoredVisible = useMemo(() => eligibleVisible.filter((item) => item.submission?.score !== null && item.submission?.score !== undefined), [eligibleVisible])
  // Pilihan lama yang sudah tidak eligible (mis. setelah data dimuat ulang) tidak ikut dihitung.
  const selectedTeams = useMemo(() => teams.filter((item) => item.state === 'eligible' && selected.has(item.team.id)), [teams, selected])
  const notApproved = selectedTeams.filter((item) => item.submission?.status !== 'approved').length
  const allVisibleSelected = eligibleVisible.length > 0 && eligibleVisible.every((item) => selected.has(item.team.id))
  const filterCount = [filters.q, filters.review].filter(Boolean).length
  const topNValue = Math.max(0, Math.floor(Number(topN)))

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else if (next.size < MAX_SELECTION) next.add(id)
      else toast.error(`Maksimal ${MAX_SELECTION} tim per operasi.`)
      return next
    })
  }

  function toggleAllVisible() {
    setSelected((current) => {
      const next = new Set(current)
      if (allVisibleSelected) {
        eligibleVisible.forEach((item) => next.delete(item.team.id))
        return next
      }
      for (const item of eligibleVisible) {
        if (next.size >= MAX_SELECTION) {
          toast.error(`Maksimal ${MAX_SELECTION} tim per operasi; sisanya tidak ikut terpilih.`)
          break
        }
        next.add(item.team.id)
      }
      return next
    })
  }

  function selectTop() {
    if (topNValue < 1) return
    const picked = scoredVisible.slice(0, Math.min(topNValue, MAX_SELECTION))
    if (picked.length < topNValue) toast.info(`Hanya ${picked.length} tim yang punya nilai, jadi hanya itu yang dipilih.`)
    setSelected(new Set(picked.map((item) => item.team.id)))
  }

  function clearFilters() {
    setFilters({ q: '', review: '' })
  }

  async function confirm() {
    if (!nextStage || selectedTeams.length === 0) return
    try {
      const response = await createOperation.mutateAsync({
        action: 'ADVANCE_STAGE',
        team_ids: selectedTeams.map((item) => item.team.id),
        target_stage_id: nextStage.id,
        sync_spreadsheet: syncSpreadsheet,
        announcement: {
          title: `Selamat! Lolos ke ${nextStage.name}`,
          template: 'advance_stage',
          message: `Selamat, Team Anda berhasil lolos ke tahap ${nextStage.name} ISAC 2026. Silakan cek dashboard untuk jadwal dan petunjuk selanjutnya.`,
          send_notification: sendNotification,
        },
      })
      toast.success(`${selectedTeams.length} tim dilolosan ke ${nextStage.name}.`, { action: { label: 'Lihat operasi', onClick: () => router.visit(`/admin/operations/${response.data.id}`) } })
      setSelected(new Set())
      setConfirmOpen(false)
      createOperation.reset()
    } catch {
      // pesan galat ditampilkan di dialog dari state mutasi
    }
  }

  function resetSelectionAnd(patch: Record<string, string>) {
    setSelected(new Set())
    setFilters({ ...patch, q: '', review: '' })
  }

  return (
    <>
      <Seo title="Loloskan Tim" description="Tentukan tim BPC dan BIC yang lolos ke tahap berikutnya." canonical="/admin/stage-advancement" noindex />
      <AdminPageHeader
        title="Loloskan Tim"
        description="Pilih tim dari satu batch yang akan lolos ke tahap berikutnya. Tim yang dipilih mendapat akses ke tahap tujuan di dashboard mereka. Nilai dan status review hanya sebagai bahan pertimbangan; keputusan ada di admin."
        action={filters.stage ? <Link href={`/admin/submission-review?competition=${filters.competition}&stage=${filters.stage}`} className={cn(buttonVariants({ variant: 'outline' }))}><ClipboardCheck />Lihat hasil review</Link> : undefined}
      />

      <div className="space-y-6">
        <SubmissionStagePicker
          competitionId={filters.competition}
          stageId={filters.stage}
          onChange={(patch) => resetSelectionAnd({ ...patch, batch: '' })}
          description="Pilih tahap asal. Tim yang berada di tahap ini bisa dilolosan ke tahap berikutnya."
        >
          <label className="block space-y-1.5 text-xs text-muted-foreground"><span className="flex items-center gap-1.5"><span className="flex size-4 items-center justify-center rounded-full bg-primary/15 text-[10px] font-semibold text-primary">3</span>Batch (opsional)</span>
            <select value={filters.batch} onChange={(event) => resetSelectionAnd({ batch: event.target.value })} className={cn(selectClass, 'md:max-w-md')} disabled={!filters.competition || batchesQuery.isLoading}>
              <option value="">{!filters.competition ? 'Pilih kompetisi dulu' : 'Semua batch'}</option>
              {batches.map((batch) => <option key={batch.id} value={batch.id}>{batch.name}</option>)}
            </select>
          </label>
          {result && (
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {nextStage ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-primary"><ArrowRight className="size-3.5" />Tujuan: Tahap {nextStage.order} · {nextStage.name}</span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/40 px-3 py-1">Ini tahap terakhir, tidak ada tahap tujuan</span>
              )}
              {nextStage && <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/40 px-3 py-1">Dibuka {formatDateTime(nextStage.startDate)} – {formatDateTime(nextStage.endDate)}</span>}
            </div>
          )}
        </SubmissionStagePicker>

        {!filters.stage ? (
          <AdminEmptyState title="Pilih tahap terlebih dahulu" description="Daftar tim akan tampil setelah kompetisi dan tahap asal dipilih." />
        ) : advancementQuery.isLoading ? (
          <AdminLoadingState label="Memuat daftar tim..." />
        ) : advancementQuery.error && !result ? (
          <AdminErrorState message={advancementQuery.error.message} retry={() => advancementQuery.refetch()} />
        ) : result && (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <SummaryTile label="Total tim" value={result.summary.total} />
              <SummaryTile label="Bisa dilolosan" value={result.summary.eligible} tone="text-accent" />
              <SummaryTile label="Sudah lolos" value={result.summary.advanced} />
              <SummaryTile label="Tidak bisa dilolosan" value={result.summary.blocked} tone={result.summary.blocked > 0 ? 'text-destructive' : undefined} />
            </div>

            <Card className="border-border/60 bg-card/70 backdrop-blur-md">
              <CardHeader>
                <CardTitle className="flex flex-wrap items-center justify-between gap-2"><span className="flex items-center gap-2"><Trophy className="size-4 text-primary" />Pilih Tim yang Lolos</span><Badge variant="outline">{selectedTeams.length} dipilih</Badge></CardTitle>
                <CardDescription>Urutan dari nilai tertinggi. Hanya tim terverifikasi yang masih berada di tahap ini yang bisa dipilih.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {result.truncated && (
                  <p className="flex items-start gap-2 rounded-2xl border border-amber-400/25 bg-amber-400/10 px-3 py-2 text-sm text-amber-300"><AlertTriangle className="mt-0.5 size-4 shrink-0" />Hanya {result.teams.length} dari {result.summary.total} tim yang ditampilkan. Pilih batch untuk mempersempit daftar.</p>
                )}

                <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
                  <label className="flex-1 space-y-1.5 text-xs text-muted-foreground">Cari tim
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                      <Input type="search" value={filters.q} onChange={(event) => setFilters({ q: event.target.value })} placeholder="Kode, nama, atau email tim..." maxLength={100} className="h-10 rounded-3xl bg-background/60 pl-8 pr-9 [&::-webkit-search-cancel-button]:hidden" />
                      {filters.q && <button type="button" onClick={() => setFilters({ q: '' })} aria-label="Hapus pencarian" className="absolute right-2 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"><X className="size-3.5" /></button>}
                    </div>
                  </label>
                  <div className="space-y-1.5 text-xs text-muted-foreground">
                    <span id="advancement-review-label">Hasil review</span>
                    <div role="group" aria-labelledby="advancement-review-label" className="flex rounded-3xl border border-input bg-background/60 p-0.5">
                      {reviewOptions.map((option) => (
                        <button key={option.value} type="button" aria-pressed={filters.review === option.value} onClick={() => setFilters({ review: option.value })} className={cn('h-9 flex-1 whitespace-nowrap rounded-3xl px-3 text-sm transition-colors lg:flex-none', filters.review === option.value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}>{option.label}</button>
                      ))}
                    </div>
                  </div>
                  <Button variant="outline" onClick={clearFilters} disabled={filterCount === 0}><FilterX />Reset</Button>
                </div>

                <div className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-background/40 p-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex flex-wrap items-center gap-2">
                    <Button variant="outline" size="sm" onClick={toggleAllVisible} disabled={!nextStage || eligibleVisible.length === 0}>{allVisibleSelected ? 'Batalkan semua yang tampil' : `Pilih semua yang tampil (${eligibleVisible.length})`}</Button>
                    <span className="flex items-center gap-1.5 text-sm">
                      <Input type="number" inputMode="numeric" min={1} max={MAX_SELECTION} value={topN} onChange={(event) => setTopN(event.target.value)} aria-label="Jumlah tim teratas" className="h-8 w-20 rounded-3xl bg-background/60" />
                      <Button variant="outline" size="sm" onClick={selectTop} disabled={!nextStage || topNValue < 1 || scoredVisible.length === 0}>Pilih teratas</Button>
                    </span>
                    <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())} disabled={selected.size === 0}>Kosongkan pilihan</Button>
                  </div>
                  <Button onClick={() => { createOperation.reset(); setConfirmOpen(true) }} disabled={!nextStage || selectedTeams.length === 0}><ArrowRight />Loloskan {selectedTeams.length} tim{nextStage ? ` ke ${nextStage.name}` : ''}</Button>
                </div>

                {visible.length === 0 ? (
                  <AdminEmptyState
                    title={filterCount > 0 ? 'Tim tidak ditemukan' : 'Belum ada tim di tahap ini'}
                    description={filterCount > 0 ? 'Tidak ada tim yang cocok dengan pencarian dan filter aktif.' : 'Belum ada tim yang berada di tahap ini pada batch terpilih.'}
                    action={filterCount > 0 ? <Button variant="outline" onClick={clearFilters}><FilterX />Reset pencarian & filter</Button> : undefined}
                  />
                ) : (
                  <>
                    <div className="hidden overflow-hidden rounded-2xl border border-border/60 xl:block">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-10"><input type="checkbox" checked={allVisibleSelected} onChange={toggleAllVisible} disabled={!nextStage || eligibleVisible.length === 0} aria-label="Pilih semua tim yang tampil" className="size-4 accent-primary" /></TableHead>
                            <TableHead>Tim</TableHead>
                            <TableHead>Batch</TableHead>
                            <TableHead>Hasil review</TableHead>
                            <TableHead>Tahap sekarang</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {visible.map((item) => {
                            const checked = selected.has(item.team.id)
                            return (
                              <TableRow key={item.team.id} className={cn(checked && 'bg-primary/5', item.state !== 'eligible' && 'opacity-70')}>
                                <TableCell className="align-top"><input type="checkbox" checked={checked} onChange={() => toggle(item.team.id)} disabled={item.state !== 'eligible'} aria-label={`Pilih ${item.team.code}`} className="size-4 accent-primary" /></TableCell>
                                <TableCell className="max-w-64 whitespace-normal! align-top">
                                  <p className="break-all font-medium">{item.team.code}</p>
                                  <p className="break-words text-xs text-muted-foreground">{item.team.name ?? 'Tanpa nama'}</p>
                                  <p className="break-all text-xs text-muted-foreground">{item.team.email}</p>
                                </TableCell>
                                <TableCell className="align-top text-sm">{item.batch?.name ?? '—'}</TableCell>
                                <TableCell className="align-top"><ReviewCell team={item} /></TableCell>
                                <TableCell className="align-top text-sm">{item.currentStage ? `Tahap ${item.currentStage.order} · ${item.currentStage.name}` : '—'}</TableCell>
                                <TableCell className="max-w-56 whitespace-normal! align-top"><StateCell team={item} /></TableCell>
                              </TableRow>
                            )
                          })}
                        </TableBody>
                      </Table>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2 xl:hidden">
                      {visible.map((item) => {
                        const checked = selected.has(item.team.id)
                        return (
                          <Card key={item.team.id} className={cn('border-border/60 bg-card/70', checked && 'ring-1 ring-primary', item.state !== 'eligible' && 'opacity-70')}>
                            <CardContent className="flex h-full flex-col gap-3 p-4">
                              <label className="flex items-start gap-3">
                                <input type="checkbox" checked={checked} onChange={() => toggle(item.team.id)} disabled={item.state !== 'eligible'} aria-label={`Pilih ${item.team.code}`} className="mt-1 size-4 accent-primary" />
                                <div className="min-w-0 flex-1">
                                  <p className="break-all font-medium">{item.team.code}</p>
                                  <p className="break-words text-xs text-muted-foreground">{item.team.name ?? 'Tanpa nama'}</p>
                                  <p className="break-all text-xs text-muted-foreground">{item.team.email}</p>
                                </div>
                              </label>
                              <div className="flex items-start justify-between gap-3 text-xs">
                                <ReviewCell team={item} />
                                <StateCell team={item} />
                              </div>
                              <p className="text-xs text-muted-foreground">{item.batch?.name ?? '—'} · {item.currentStage ? `Tahap ${item.currentStage.order} · ${item.currentStage.name}` : '—'}</p>
                            </CardContent>
                          </Card>
                        )
                      })}
                    </div>
                    <p className="text-sm text-muted-foreground">Menampilkan {visible.length} dari {teams.length} tim</p>
                  </>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>

      <Dialog open={confirmOpen} onOpenChange={(open) => { if (!createOperation.isPending) setConfirmOpen(open) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Loloskan {selectedTeams.length} tim ke {nextStage?.name}?</DialogTitle>
            <DialogDescription>Tim yang dipilih langsung mendapat akses ke tahap {nextStage?.name} di dashboard mereka. Tim yang tidak dipilih tetap di tahap sekarang.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            {notApproved > 0 && (
              <p className="flex items-start gap-2 rounded-2xl border border-amber-400/25 bg-amber-400/10 px-3 py-2 text-amber-300"><AlertTriangle className="mt-0.5 size-4 shrink-0" />{notApproved} dari {selectedTeams.length} tim belum disetujui juri (belum mengumpulkan, masih ditinjau, atau perlu revisi).</p>
            )}
            <div className="space-y-2 rounded-2xl border border-border/60 bg-background/40 p-3">
              <label className="flex items-start gap-2"><input type="checkbox" checked={sendNotification} onChange={(event) => setSendNotification(event.target.checked)} className="mt-0.5 size-4 accent-primary" /><span>Kirim email pengumuman &quot;Selamat! Lolos ke {nextStage?.name}&quot; ke {selectedTeams.length} tim</span></label>
              <label className="flex items-start gap-2"><input type="checkbox" checked={syncSpreadsheet} onChange={(event) => setSyncSpreadsheet(event.target.checked)} className="mt-0.5 size-4 accent-primary" /><span>Sinkronkan ke spreadsheet</span></label>
            </div>
            {nextStage && <p className="text-xs text-muted-foreground">Tahap tujuan dibuka {formatDateTime(nextStage.startDate)} – {formatDateTime(nextStage.endDate)}. Sebelum itu tim bisa melihat tahapnya tapi belum bisa mengumpulkan.</p>}
            {createOperation.error && <p role="alert" className="rounded-2xl border border-destructive/25 bg-destructive/10 px-3 py-2 text-destructive">{createOperation.error.message}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={createOperation.isPending}>Batal</Button>
            <Button onClick={confirm} disabled={createOperation.isPending || selectedTeams.length === 0}>{createOperation.isPending ? <><Loader2 className="animate-spin" />Memproses...</> : <><Send />Loloskan {selectedTeams.length} tim</>}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

AdminStageAdvancement.layout = adminPageLayout
