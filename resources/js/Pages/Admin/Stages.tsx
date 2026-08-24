import { CalendarDays, ClipboardList, FileQuestion, Pencil, Plus, Trash2, UsersRound } from 'lucide-react'
import { useState } from 'react'
import { Link } from '@inertiajs/react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Seo } from '@/components/seo/Seo'
import { AdminPageHeader } from '@/features/admin/components/AdminPageHeader'
import { adminPageLayout } from '@/features/admin/components/AdminShell'
import { ConfirmActionDialog } from '@/features/admin/components/ConfirmActionDialog'
import { StageFormDialog } from '@/features/admin/components/StageFormDialog'
import { AdminEmptyState, AdminErrorState, AdminLoadingState } from '@/features/admin/components/AdminStates'
import { useAdminCompetitions, useAdminStages, useDeleteStage } from '@/features/admin/hooks/useAdmin'
import type { AdminStage } from '@/features/admin/types/adminTypes'
import { useAuthSession } from '@/features/auth/context/AuthProvider'

const stageLabels: Record<AdminStage['type'], string> = {
  registration: 'Registrasi', submission: 'Pengumpulan', selection: 'Seleksi', exam: 'Ujian', interview: 'Wawancara', announcement: 'Pengumuman', final: 'Final',
}

function formatDate(value: string | null) {
  return value ? new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : 'Belum dijadwalkan'
}

function StageCard({ stage, canManage, onEdit, onDelete }: { stage: AdminStage; canManage: boolean; onEdit: (stage: AdminStage) => void; onDelete: (stage: AdminStage) => void }) {
  const canManageQuestions = stage.competition.type === 'OLIMPIADE'
  return (
    <Card className="flex h-full flex-col border-border/60 bg-card/70 backdrop-blur-md transition-colors hover:border-primary/20 hover:bg-card/80">
      <CardContent className="flex flex-1 flex-col p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <Badge variant="outline" className="shrink-0 text-[11px] sm:text-xs">Tahap {stage.order}</Badge>
              <Badge variant={stage.isActive ? 'secondary' : 'outline'} className="shrink-0 text-[11px] sm:text-xs">{stage.isActive ? 'Aktif' : 'Nonaktif'}</Badge>
              <Badge variant="secondary" className="shrink-0 text-[11px] sm:text-xs">{stageLabels[stage.type]}</Badge>
            </div>
            <h2 className="mt-2.5 line-clamp-2 break-words text-base font-semibold leading-tight sm:text-lg">{stage.name}</h2>
            <p className="mt-1 line-clamp-1 break-all text-xs text-muted-foreground sm:text-sm" title={stage.competition.name}>{stage.competition.name}</p>
          </div>
          {canManage && (
            <div className="flex shrink-0 gap-1">
              <Button variant="ghost" size="icon-sm" onClick={() => onEdit(stage)} aria-label={`Edit ${stage.name}`} className="hover:bg-muted">
                <Pencil className="size-4" />
              </Button>
              <Button variant="ghost" size="icon-sm" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => onDelete(stage)} aria-label={`Hapus ${stage.name}`}>
                <Trash2 className="size-4" />
              </Button>
            </div>
          )}
        </div>

        <p className="mt-3 flex-1 text-sm leading-6 text-muted-foreground line-clamp-3 sm:min-h-[3.25rem]">{stage.description ?? 'Belum ada deskripsi tahap.'}</p>

        <div className="mt-4 flex flex-col gap-3 border-t border-border/60 pt-4">
          <div className="flex gap-2.5 text-sm">
            <CalendarDays className="mt-0.5 size-4 shrink-0 text-primary" />
            <div className="min-w-0 flex-1 leading-5">
              <p className="truncate text-foreground">{formatDate(stage.startDate)}</p>
              <p className="truncate text-xs text-muted-foreground sm:text-sm">sampai {formatDate(stage.endDate)}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground sm:text-sm">
            <span className="inline-flex items-center gap-1.5">
              <FileQuestion className="size-3.5 shrink-0" />
              {stage.examCount} ujian
            </span>
            <span className="inline-flex items-center gap-1.5">
              <ClipboardList className="size-3.5 shrink-0" />
              {stage.submissionCount} pengumpulan
            </span>
            <span className="inline-flex items-center gap-1.5">
              <UsersRound className="size-3.5 shrink-0" />
              {stage.teamCount} tim
            </span>
          </div>
        </div>

        {canManageQuestions && (
          <Link
            href={`/admin/questions?stage=${stage.id}`}
            className="mt-4 inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-3xl border border-border bg-background/60 px-3 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-auto"
          >
            <FileQuestion className="size-4" />
            Kelola soal Olimpiade
          </Link>
        )}
      </CardContent>
    </Card>
  )
}

export default function AdminStages() {
  const { principal } = useAuthSession()
  const competitionsQuery = useAdminCompetitions({ perPage: 100 })
  const [competitionId, setCompetitionId] = useState('')
  const stagesQuery = useAdminStages(competitionId || undefined)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<AdminStage | null>(null)
  const [deleting, setDeleting] = useState<AdminStage | null>(null)
  const deleteMutation = useDeleteStage()
  const admin = principal?.principalType === 'ADMIN' ? principal.admin : null
  const canManage = admin?.role === 'super_admin' || admin?.role === 'admin_registration'
  const competitions = competitionsQuery.data?.data ?? []
  const stages = stagesQuery.data?.data ?? []
  const nextOrder = Math.max(0, ...stages.map((stage) => stage.order)) + 1

  function openCreate() { setEditing(null); setFormOpen(true) }
  function openEdit(stage: AdminStage) { setEditing(stage); setFormOpen(true) }
  async function confirmDelete() {
    if (!deleting) return
    try { await deleteMutation.mutateAsync(deleting.id); toast.success('Tahap berhasil dihapus.'); setDeleting(null) } catch (error) { toast.error(error instanceof Error ? error.message : 'Tahap tidak dapat dihapus.') }
  }

  return <>
    <Seo title="Tahapan Kompetisi" description="Kelola urutan dan periode tahap setiap kompetisi ISAC 2026." canonical="/admin/stages" noindex />
    <AdminPageHeader title="Tahapan Kompetisi" description="Atur urutan, jadwal, dan status tahap. Urutan ini menjadi dasar perpindahan tim." action={canManage ? <Button onClick={openCreate}><Plus />Buat Tahap</Button> : undefined} />
    <Card className="mb-5 border-border/60 bg-card/70 backdrop-blur-md"><CardContent className="p-4 sm:p-5"><label className="block w-full max-w-md space-y-1.5 text-sm"><span className="text-xs font-medium text-muted-foreground sm:text-sm">Filter kompetisi</span><select value={competitionId} onChange={(event) => setCompetitionId(event.target.value)} className="h-9 w-full rounded-3xl border border-input bg-background/60 px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><option value="">Semua kompetisi</option>{competitions.map((competition) => <option key={competition.id} value={competition.id}>{competition.name}</option>)}</select></label></CardContent></Card>
    {stagesQuery.isLoading ? <AdminLoadingState label="Memuat tahapan kompetisi..." /> : stagesQuery.error ? <AdminErrorState message={stagesQuery.error.message} retry={() => stagesQuery.refetch()} /> : !stages.length ? <AdminEmptyState title="Belum ada tahap" description="Buat tahap pertama untuk mengatur alur kompetisi." /> : <div className="grid auto-rows-fr gap-4 sm:gap-5 md:grid-cols-2 2xl:grid-cols-3">{stages.map((stage) => <StageCard key={stage.id} stage={stage} canManage={canManage} onEdit={openEdit} onDelete={setDeleting} />)}</div>}
    <StageFormDialog open={formOpen} onOpenChange={setFormOpen} stage={editing} competitions={competitions} defaultCompetitionId={competitionId} defaultOrder={nextOrder} />
    <ConfirmActionDialog open={Boolean(deleting)} onOpenChange={(open) => { if (!open) setDeleting(null) }} title="Hapus tahap?" description={`Tahap ${deleting?.name ?? ''} hanya dapat dihapus jika belum memiliki ujian, pengumpulan, tim, atau checkpoint pembayaran.`} confirmLabel="Hapus Tahap" pending={deleteMutation.isPending} onConfirm={confirmDelete} />
  </>
}

AdminStages.layout = adminPageLayout

