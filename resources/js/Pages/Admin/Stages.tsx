import { CalendarDays, ClipboardList, FileQuestion, Pencil, Plus, Trash2, UsersRound } from 'lucide-react'
import { useState } from 'react'
import { Link } from '@inertiajs/react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
  return <Card className="border-border/60 bg-card/70 backdrop-blur-md"><CardContent className="p-5">
    <div className="flex flex-wrap items-start justify-between gap-4"><div className="min-w-0"><div className="mb-2 flex flex-wrap items-center gap-2"><Badge variant="outline">Tahap {stage.order}</Badge><Badge variant={stage.isActive ? 'secondary' : 'outline'}>{stage.isActive ? 'Aktif' : 'Nonaktif'}</Badge><Badge variant="secondary">{stageLabels[stage.type]}</Badge></div><h2 className="text-lg font-semibold">{stage.name}</h2><p className="mt-1 text-sm text-muted-foreground">{stage.competition.name}</p></div>{canManage && <div className="flex gap-1"><Button variant="ghost" size="icon-sm" onClick={() => onEdit(stage)} aria-label={`Edit ${stage.name}`}><Pencil /></Button><Button variant="ghost" size="icon-sm" className="text-destructive" onClick={() => onDelete(stage)} aria-label={`Hapus ${stage.name}`}><Trash2 /></Button></div>}</div>
    <p className="mt-4 min-h-10 text-sm text-muted-foreground">{stage.description ?? 'Belum ada deskripsi tahap.'}</p>
    <div className="mt-4 grid gap-3 border-t border-border/60 pt-4 text-sm sm:grid-cols-2"><div className="flex gap-2"><CalendarDays className="mt-0.5 size-4 shrink-0 text-primary" /><span>{formatDate(stage.startDate)}<br /><span className="text-muted-foreground">sampai {formatDate(stage.endDate)}</span></span></div><div className="flex items-center gap-4 text-muted-foreground"><span className="inline-flex items-center gap-1"><FileQuestion className="size-4" />{stage.examCount} ujian</span><span className="inline-flex items-center gap-1"><ClipboardList className="size-4" />{stage.submissionCount} pengumpulan</span><span className="inline-flex items-center gap-1"><UsersRound className="size-4" />{stage.teamCount} tim</span></div></div>
    {canManageQuestions && <div className="mt-4"><Link href={`/admin/questions?stage=${stage.id}`} className="inline-flex h-9 items-center justify-center rounded-3xl border border-input bg-background/60 px-3 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"><FileQuestion className="mr-2 size-4" />Kelola soal Olimpiade</Link></div>}
  </CardContent></Card>
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
    <Card className="mb-5 border-border/60 bg-card/70"><CardContent className="p-4"><label className="block max-w-md space-y-1.5 text-sm">Filter kompetisi<select value={competitionId} onChange={(event) => setCompetitionId(event.target.value)} className="h-9 w-full rounded-3xl border border-input bg-background/60 px-3"><option value="">Semua kompetisi</option>{competitions.map((competition) => <option key={competition.id} value={competition.id}>{competition.name}</option>)}</select></label></CardContent></Card>
    {stagesQuery.isLoading ? <AdminLoadingState label="Memuat tahapan kompetisi..." /> : stagesQuery.error ? <AdminErrorState message={stagesQuery.error.message} retry={() => stagesQuery.refetch()} /> : !stages.length ? <AdminEmptyState title="Belum ada tahap" description="Buat tahap pertama untuk mengatur alur kompetisi." /> : <div className="grid gap-4 xl:grid-cols-2">{stages.map((stage) => <StageCard key={stage.id} stage={stage} canManage={canManage} onEdit={openEdit} onDelete={setDeleting} />)}</div>}
    <StageFormDialog open={formOpen} onOpenChange={setFormOpen} stage={editing} competitions={competitions} defaultCompetitionId={competitionId} defaultOrder={nextOrder} />
    <ConfirmActionDialog open={Boolean(deleting)} onOpenChange={(open) => { if (!open) setDeleting(null) }} title="Hapus tahap?" description={`Tahap ${deleting?.name ?? ''} hanya dapat dihapus jika belum memiliki ujian, pengumpulan, tim, atau checkpoint pembayaran.`} confirmLabel="Hapus Tahap" pending={deleteMutation.isPending} onConfirm={confirmDelete} />
  </>
}

AdminStages.layout = adminPageLayout

