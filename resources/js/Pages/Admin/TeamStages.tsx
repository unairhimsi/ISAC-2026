import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { ArrowRight, Check, ChevronLeft, ChevronRight, FilterX, Layers3, Loader2, Search } from 'lucide-react'
import { Seo } from '@/components/seo/Seo'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { AdminPageHeader } from '@/features/admin/components/AdminPageHeader'
import { AdminStatusBadge } from '@/features/admin/components/AdminStatusBadge'
import { AdminEmptyState, AdminErrorState, AdminLoadingState } from '@/features/admin/components/AdminStates'
import { adminPageLayout } from '@/features/admin/components/AdminShell'
import { useAdminBatches, useAdminCompetitions, useAdminStages, useAdminTeams, useCreateAdminOperation } from '@/features/admin/hooks/useAdmin'
import { cn } from '@/lib/utils'

export default function AdminTeamStages() {
  const [competitionId, setCompetitionId] = useState('')
  const [stageFilter, setStageFilter] = useState('') // current stage id filter
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [targetStageId, setTargetStageId] = useState('')
  const [sendNotification, setSendNotification] = useState(true)
  const [syncSpreadsheet, setSyncSpreadsheet] = useState(true)

  const competitionsQuery = useAdminCompetitions({ perPage: 100 })
  const stagesQuery = useAdminStages(competitionId || undefined)
  const batchesQuery = useAdminBatches(competitionId || undefined)
  const teamsQuery = useAdminTeams({
    page,
    per_page: 20,
    competition_id: competitionId || undefined,
  })

  const createOp = useCreateAdminOperation()

  const competitions = competitionsQuery.data?.data ?? []
  const stages = useMemo(() => [...(stagesQuery.data?.data ?? [])].sort((a,b)=>a.order-b.order), [stagesQuery.data])
  const pagination = teamsQuery.data?.data
  const teams = pagination?.data ?? []

  // filter by stage & search client-side (since API belum support filter current_stage)
  const filteredTeams = useMemo(() => {
    let list = teams
    if (stageFilter) {
      list = list.filter(t => t.currentStage?.id === stageFilter)
    }
    if (search.trim()) {
      const kw = search.trim().toLowerCase()
      list = list.filter(t => {
        const name = t.team.name ?? ''
        const code = t.team.code ?? ''
        const email = t.team.email ?? ''
        return name.toLowerCase().includes(kw) || code.toLowerCase().includes(kw) || email.toLowerCase().includes(kw)
      })
    }
    return list
  }, [teams, stageFilter, search])

  const targetStage = stages.find(s => s.id === targetStageId) || null

  // eligibility check: team.currentStage.order +1 === target.order  OR (null && target.order===1)
  function isEligible(teamCurrent: { order: number } | null | undefined, target: { order: number } | null): boolean {
    if (!target) return false
    if (!teamCurrent) return target.order === 1
    return teamCurrent.order + 1 === target.order
  }

  // also must be VERIFIED (team & registration)
  function canAdvance(team: typeof filteredTeams[number]): boolean {
    if (!targetStage) return false
    const teamOk = team.team.status === 'VERIFIED'
    const regOk = team.registration?.status === 'VERIFIED'
    if (!teamOk || !regOk) return false
    return isEligible(team.currentStage, targetStage)
  }

  const selectedList = useMemo(() => filteredTeams.filter(t => selectedIds.has(t.team.id)), [filteredTeams, selectedIds])
  const eligibleSelected = useMemo(() => selectedList.filter(canAdvance), [selectedList])
  const ineligibleSelected = selectedList.length - eligibleSelected.length

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else {
        if (next.size >= 500) {
          toast.error('Maksimal 500 tim per operasi.')
          return next
        }
        next.add(id)
      }
      return next
    })
  }

  function toggleSelectAll() {
    const allIds = filteredTeams.map(t => t.team.id)
    const allSelected = allIds.length > 0 && allIds.every(id => selectedIds.has(id))
    if (allSelected) setSelectedIds(new Set())
    else setSelectedIds(new Set(allIds.slice(0,500)))
  }

  async function handleAdvance() {
    if (!targetStage) {
      toast.error('Pilih tahap tujuan dulu.')
      return
    }
    if (selectedList.length === 0) {
      toast.error('Pilih minimal 1 tim.')
      return
    }
    if (eligibleSelected.length === 0) {
      toast.error('Tidak ada tim yang eligible untuk tahap ini. Periksa urutan tahap & status VERIFIED.')
      return
    }
    if (ineligibleSelected > 0) {
      toast.warning(`${ineligibleSelected} tim tidak eligible akan di-SKIP / FAILED. Hanya ${eligibleSelected.length} yang akan diproses.`)
    }

    // template otomatis untuk advance stage — backend akan pakai defaultAnnouncementMessage
    const announcementTitle = `Selamat! Lolos ke ${targetStage.name}`
    const announcementMessage = `Selamat, Team Anda berhasil lolos ke tahap ${targetStage.name} ISAC 2026. Silakan cek dashboard untuk jadwal dan petunjuk selanjutnya.`

    try {
      const res = await createOp.mutateAsync({
        action: 'ADVANCE_STAGE',
        team_ids: eligibleSelected.map(t => t.team.id),
        target_stage_id: targetStage.id,
        sync_spreadsheet: syncSpreadsheet,
        announcement: {
          title: announcementTitle,
          template: 'advance_stage',
          message: announcementMessage,
          send_notification: sendNotification,
        }
      })
      toast.success(res.message ?? `Berhasil memproses ${eligibleSelected.length} tim ke ${targetStage.name}`)
      setSelectedIds(new Set())
    } catch (e: any) {
      const msg = e?.message ?? 'Gagal memproses advance stage.'
      toast.error(msg)
    }
  }

  function resetFilters() {
    setCompetitionId('')
    setStageFilter('')
    setSearch('')
    setPage(1)
    setTargetStageId('')
    setSelectedIds(new Set())
  }

  return (
    <>
      <Seo title="Kelola Tahap Team" description="Cek stage tiap team per kompetisi dan loloskan massal ke tahap berikutnya." canonical="/admin/team-stages" noindex />
      <AdminPageHeader
        title="Kelola Tahap Team"
        description="Cek posisi stage tiap team per lomba, pilih yang lolos dan pindahkan massal ke tahap berikutnya. Email pengumuman otomatis 'Selamat team anda lanjut ke ...'."
      />

      <Card className="mb-5 border-border/60 bg-card/70 backdrop-blur-md">
        <CardContent className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-4">
          <label className="space-y-1.5 text-xs text-muted-foreground">Kompetisi
            <select value={competitionId} onChange={e => { setCompetitionId(e.target.value); setStageFilter(''); setPage(1); setTargetStageId('') }} className="h-10 w-full rounded-3xl border border-input bg-background/60 px-3 text-sm">
              <option value="">Semua kompetisi</option>
              {competitions.map(c => <option key={c.id} value={c.id}>{c.name} ({c.type})</option>)}
            </select>
          </label>

          <label className="space-y-1.5 text-xs text-muted-foreground">Filter Tahap Saat Ini
            <select value={stageFilter} onChange={e => { setStageFilter(e.target.value); setPage(1) }} className="h-10 w-full rounded-3xl border border-input bg-background/60 px-3 text-sm" disabled={!competitionId}>
              <option value="">Semua tahap</option>
              {stages.map(s => <option key={s.id} value={s.id}>Tahap {s.order}: {s.name}</option>)}
            </select>
          </label>

          <label className="space-y-1.5 text-xs text-muted-foreground">Cari Tim
            <span className="relative block">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="nama / kode / email" className="h-10 w-full rounded-3xl border border-input bg-background/60 pl-9 pr-3 text-sm" />
            </span>
          </label>

          <div className="flex items-end gap-2">
            <Button variant="outline" className="w-full" onClick={resetFilters}><FilterX />Reset</Button>
          </div>
        </CardContent>
      </Card>

      {/* Target stage selector */}
      <Card className="mb-5 border-border/60 bg-card/70 backdrop-blur-md">
        <CardHeader><CardTitle className="flex items-center gap-2"><Layers3 className="size-4" /> Pindahkan ke Tahap</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-[1fr_auto]">
          <div className="space-y-3">
            <label className="space-y-1.5 text-xs text-muted-foreground">Tujuan Tahap
              <select value={targetStageId} onChange={e => setTargetStageId(e.target.value)} className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm" disabled={!competitionId || stages.length===0}>
                <option value="">{competitionId ? 'Pilih tahap tujuan...' : 'Pilih kompetisi dulu'}</option>
                {stages.map(s => <option key={s.id} value={s.id}>Tahap {s.order}: {s.name} — {s.type}</option>)}
              </select>
            </label>
            {targetStage && (
              <div className="rounded-xl border border-border bg-background/40 p-3 text-xs">
                <p className="font-medium text-foreground">Preview Pengumuman</p>
                <p className="mt-1 font-medium">Subject: [ISAC 2026] Selamat! Lolos ke {targetStage.name}</p>
                <p className="mt-1 text-muted-foreground">Selamat, Team <i>{'{nama}'}</i> berhasil lolos ke tahap <b>{targetStage.name}</b> ISAC 2026. Silakan cek dashboard untuk jadwal dan petunjuk selanjutnya.</p>
                <p className="mt-2 text-[11px] text-muted-foreground">Logo: /logo.png · Pengirim: ISAC 2026 — HIMSI UNAIR · Otomatis per-team (templat tidak perlu diisi manual)</p>
              </div>
            )}
            <div className="flex flex-wrap gap-3 text-xs">
              <label className="flex items-center gap-2"><input type="checkbox" checked={sendNotification} onChange={e=>setSendNotification(e.target.checked)} className="size-4 accent-primary" />Kirim Email</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={syncSpreadsheet} onChange={e=>setSyncSpreadsheet(e.target.checked)} className="size-4 accent-primary" />Sinkron Spreadsheet</label>
            </div>
          </div>
          <div className="flex flex-col justify-between gap-3">
            <div className="text-sm">
              <p className="text-muted-foreground">Terpilih: <span className="font-medium text-foreground">{selectedList.length}</span> tim</p>
              <p className="text-muted-foreground">Eligible: <span className="font-medium text-emerald-600">{eligibleSelected.length}</span> · Tidak eligible: <span className="font-medium text-destructive">{ineligibleSelected}</span></p>
              <p className="mt-1 text-xs text-muted-foreground">Syarat: Team & Registrasi VERIFIED dan urutan tahap berurutan (tahap sekarang order+1 = tujuan).</p>
            </div>
            <Button onClick={handleAdvance} disabled={createOp.isPending || !targetStageId || eligibleSelected.length===0} className="w-full">
              {createOp.isPending ? <Loader2 className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}
              Loloskan {eligibleSelected.length} Tim ke {targetStage?.name ?? '...'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Teams table */}
      {teamsQuery.isLoading ? <AdminLoadingState label="Memuat team..." /> : teamsQuery.error ? <AdminErrorState message={teamsQuery.error.message} retry={()=>teamsQuery.refetch()} /> : filteredTeams.length===0 ? <AdminEmptyState title="Tidak ada tim" description={competitionId ? "Tidak ada tim untuk filter ini." : "Pilih kompetisi untuk melihat daftar team per stage."} /> : (
        <>
          <Card className="hidden overflow-hidden border-border/60 bg-card/70 backdrop-blur-md md:block">
            <Table>
              <TableHeader><TableRow>
                <TableHead className="w-10"><input type="checkbox" checked={filteredTeams.length>0 && filteredTeams.every(t=>selectedIds.has(t.team.id))} onChange={toggleSelectAll} className="size-4 accent-primary" /></TableHead>
                <TableHead>Tim</TableHead>
                <TableHead>Kompetisi / Batch</TableHead>
                <TableHead>Tahap Saat Ini</TableHead>
                <TableHead>Status Tim</TableHead>
                <TableHead>Registrasi</TableHead>
                <TableHead>Eligible</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {filteredTeams.map(item => {
                  const checked = selectedIds.has(item.team.id)
                  const eligible = targetStage ? canAdvance(item) : null
                  return (
                    <TableRow key={item.team.id} className={cn(checked && "bg-primary/5", eligible===false && targetStage && "opacity-60")}>
                      <TableCell><input type="checkbox" checked={checked} onChange={()=>toggleSelect(item.team.id)} className="size-4 accent-primary" /></TableCell>
                      <TableCell><div><p className="font-medium">{item.team.name ?? '—'}</p><p className="text-xs text-muted-foreground">{item.team.code} · {item.team.email}</p></div></TableCell>
                      <TableCell><div><p className="text-sm">{item.registration?.competition.name ?? '—'}</p><p className="text-xs text-muted-foreground">{item.registration?.batch.name ?? '—'}</p></div></TableCell>
                      <TableCell>
                        {item.currentStage ? <span className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2.5 py-1 text-xs"><Layers3 className="size-3" />Tahap {item.currentStage.order}: {item.currentStage.name}</span> : <span className="text-xs text-muted-foreground">Belum ada (REGISTRATION)</span>}
                      </TableCell>
                      <TableCell><AdminStatusBadge status={item.team.status} /></TableCell>
                      <TableCell>{item.registration ? <AdminStatusBadge status={item.registration.status} /> : '—'}</TableCell>
                      <TableCell>
                        {targetStage
                          ? eligible ? <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600"><Check className="size-3.5" />Eligible</span>
                          : <span className="text-xs text-destructive">Tidak</span>
                          : <span className="text-xs text-muted-foreground">—</span>}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </Card>

          <div className="space-y-3 md:hidden">
            {filteredTeams.map(item => {
              const checked = selectedIds.has(item.team.id)
              const eligible = targetStage ? canAdvance(item) : null
              return (
                <Card key={item.team.id} className={cn("border-border/60 bg-card/70", checked && "ring-1 ring-primary")}>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <label className="flex items-start gap-2 flex-1">
                        <input type="checkbox" checked={checked} onChange={()=>toggleSelect(item.team.id)} className="mt-1 size-4 accent-primary" />
                        <div><p className="font-medium text-sm">{item.team.name ?? '—'}</p><p className="text-xs text-muted-foreground">{item.team.code}</p></div>
                      </label>
                      {targetStage && (eligible ? <span className="text-xs font-medium text-emerald-600">Eligible</span> : <span className="text-xs text-destructive">Tidak</span>)}
                    </div>
                    <div className="text-xs space-y-1">
                      <p>Tahap: {item.currentStage ? `Tahap ${item.currentStage.order}: ${item.currentStage.name}` : 'REGISTRATION'}</p>
                      <div className="flex gap-2"><AdminStatusBadge status={item.team.status} />{item.registration && <AdminStatusBadge status={item.registration.status} />}</div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          {pagination && (
            <div className="mt-5 flex flex-col items-center justify-between gap-3 text-sm text-muted-foreground sm:flex-row">
              <p>Menampilkan {pagination.meta.from ?? 0}–{pagination.meta.to ?? 0} dari {pagination.meta.total} tim</p>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" disabled={pagination.meta.current_page <= 1} onClick={() => setPage(p => Math.max(1,p-1))}><ChevronLeft />Sebelumnya</Button>
                <span className="px-2">{pagination.meta.current_page} / {pagination.meta.last_page}</span>
                <Button variant="outline" size="sm" disabled={pagination.meta.current_page >= pagination.meta.last_page} onClick={() => setPage(p => p+1)}>Berikutnya<ChevronRight /></Button>
              </div>
            </div>
          )}
        </>
      )}
    </>
  )
}

AdminTeamStages.layout = adminPageLayout
