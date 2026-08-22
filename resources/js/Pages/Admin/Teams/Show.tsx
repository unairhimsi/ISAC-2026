import { Link } from '@inertiajs/react'
import { ArrowLeft, Banknote, CheckCircle2, Clock, ExternalLink, FileText, History, Mail, MapPin, Pencil, Phone, RotateCcw, ShieldX, StickyNote, User, UserRound } from 'lucide-react'
import { useState } from 'react'
import { Seo } from '@/components/seo/Seo'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AdminPageHeader } from '@/features/admin/components/AdminPageHeader'
import { adminPageLayout } from '@/features/admin/components/AdminShell'
import { AdminStatusBadge } from '@/features/admin/components/AdminStatusBadge'
import { AdminErrorState, AdminLoadingState } from '@/features/admin/components/AdminStates'
import { AdminTeamEditDialog } from '@/features/admin/components/AdminTeamEditDialog'
import { TeamReviewDialog } from '@/features/admin/components/TeamReviewDialog'
import { useAdminTeam } from '@/features/admin/hooks/useAdmin'
import { useAuthSession } from '@/features/auth/context/AuthProvider'
import { formatInstitutionAddress } from '@/features/registrations/utils/institutionAddress'
import { cn } from '@/lib/utils'

function display(value: string | null | undefined) {
  return value || '—'
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('id-ID', { dateStyle: 'long', timeStyle: 'short' }).format(new Date(value))
}

export default function AdminTeamShow({ teamId }: { teamId: string }) {
  const { principal } = useAuthSession()
  const query = useAdminTeam(teamId)
  const [reviewAction, setReviewAction] = useState<'verify' | 'revise' | 'reject' | null>(null)
  const data = query.data?.data
  const role = principal?.principalType === 'ADMIN' ? principal.admin.role : null
  const [editOpen, setEditOpen] = useState(false)
  const canReview = role === 'super_admin' || role === 'admin_registration'
  const canEdit = role === 'super_admin' || role === 'admin_registration'
  const waitingReview = data?.team.status === 'WAITING_VERIFICATION'

  const paymentAvailable = data?.registration?.paymentAvailable === true
  const competitionType = data?.registration?.competition.type
  const identityLabel = competitionType === 'BUSINESS_IT_CASE' ? 'NIM' : 'NISN'
  if (query.isLoading) return <AdminLoadingState label="Memuat detail tim..." />
  if (query.error || !data) return <AdminErrorState message={query.error?.message ?? 'Detail tim tidak ditemukan.'} retry={() => query.refetch()} />

  return (
    <>
      <Seo title={`${data.team.name ?? data.team.code} · Admin`} description="Detail pendaftaran tim ISAC 2026." canonical={`/admin/teams/${teamId}`} noindex />
      <AdminPageHeader
        title={data.team.name ?? data.team.code}
        description={`${data.team.code} · ${data.registration?.competition.name ?? 'Belum memilih kompetisi'}`}
        action={<div className="flex flex-wrap gap-2"><Link href="/admin/teams" className={cn(buttonVariants({ variant: 'outline' }))}><ArrowLeft />Kembali</Link>{canEdit && data.registration && <Button variant="outline" onClick={() => setEditOpen(true)}><Pencil />Edit Data</Button>}</div>}
      />

      <div className="grid gap-6 xl:grid-cols-[1.3fr_.7fr]">
        <div className="space-y-6">
          <Card className="border-border/60 bg-card/70 backdrop-blur-md">
            <CardHeader className="flex-row items-center justify-between gap-3"><CardTitle>Profil Tim</CardTitle><AdminStatusBadge status={data.team.status} /></CardHeader>
            <CardContent className="grid gap-4 text-sm sm:grid-cols-2">
              <div className="flex gap-3"><Mail className="mt-0.5 size-4 shrink-0 text-secondary" /><div><p className="text-xs text-muted-foreground">Email</p><p>{display(data.team.email)}</p></div></div>
              <div className="flex gap-3"><Phone className="mt-0.5 size-4 shrink-0 text-secondary" /><div><p className="text-xs text-muted-foreground">Nomor telepon</p><p>{display(data.team.phone)}</p></div></div>
              <div className="flex gap-3"><UserRound className="mt-0.5 size-4 shrink-0 text-primary" /><div><p className="text-xs text-muted-foreground">Sekolah / Institusi</p><p>{display(data.team.institutionName)}</p></div></div>
              <div className="flex gap-3"><MapPin className="mt-0.5 size-4 shrink-0 text-primary" /><div><p className="text-xs text-muted-foreground">Alamat</p><p>{formatInstitutionAddress(data.team.institutionAddress) || '—'}</p></div></div>
            </CardContent>
          </Card>

          <Card className="border-border/60 bg-card/70 backdrop-blur-md">
            <CardHeader>
              <CardTitle>Peserta ({data.members.length})</CardTitle>
              <CardDescription>Foto dan identitas peserta sesuai upload registrasi · klik foto untuk lihat penuh</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {data.members.map((member) => {
                const photoUrl = (member as unknown as { photoUrl?: string | null; photo?: { url?: string | null } | null }).photoUrl ?? (member as unknown as { photo?: { url?: string | null } | null }).photo?.url ?? null
                const initials = member.name
                  .split(' ')
                  .filter(Boolean)
                  .slice(0, 2)
                  .map((w) => w[0]?.toUpperCase() ?? '')
                  .join('')
                return (
                  <div key={member.id} className="group flex flex-col overflow-hidden rounded-3xl border border-border/60 bg-background/30 backdrop-blur-sm transition-colors hover:border-primary/20 hover:bg-background/50">
                    <div className="relative flex flex-col items-center gap-3 bg-card/30 p-5 text-center">
                      <div className="relative">
                        <div className="h-24 w-24 overflow-hidden rounded-2xl border border-border bg-muted shadow-sm sm:h-28 sm:w-28">
                          {photoUrl ? (
                            <a href={photoUrl} target="_blank" rel="noreferrer" className="block h-full w-full" aria-label={`Lihat foto ${member.name}`}>
                              <img src={photoUrl} alt={`Foto ${member.name}`} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" loading="lazy" />
                            </a>
                          ) : (
                            <div className="flex h-full w-full items-center justify-center bg-muted text-muted-foreground">
                              {initials ? <span className="text-lg font-semibold tracking-wide">{initials}</span> : <UserRound className="size-8" />}
                            </div>
                          )}
                        </div>
                        <span
                          className={cn(
                            'absolute -bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-semibold shadow-sm ring-1 ring-border/50',
                            member.role === 'LEADER' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground',
                          )}
                        >
                          {member.role === 'LEADER' ? 'Ketua' : 'Anggota'}
                        </span>
                      </div>
                      <div className="mt-3 w-full min-w-0">
                        <p className="truncate text-sm font-semibold sm:text-[15px]" title={member.name}>
                          {member.name}
                        </p>
                        <p className="truncate text-xs text-muted-foreground" title={member.email}>
                          {member.email}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-1 flex-col gap-3 p-4">
                      <dl className="space-y-2.5 text-xs">
                        <div className="flex items-center justify-between gap-2 rounded-xl bg-muted/40 px-3 py-2">
                          <dt className="text-muted-foreground">{identityLabel}</dt>
                          <dd className="font-medium text-foreground">{member.studentId}</dd>
                        </div>
                        {member.major && (
                          <div>
                            <dt className="text-muted-foreground">Program studi</dt>
                            <dd className="mt-0.5 text-sm font-medium leading-5 text-foreground">{member.major}</dd>
                          </div>
                        )}
                        {member.faculty && (
                          <div>
                            <dt className="text-muted-foreground">Fakultas</dt>
                            <dd className="mt-0.5 text-sm font-medium leading-5 text-foreground">{member.faculty}</dd>
                          </div>
                        )}
                        {!member.major && !member.faculty && (
                          <p className="rounded-xl border border-dashed border-border/60 bg-background/20 px-3 py-2 text-xs leading-4 text-muted-foreground">
                            {identityLabel === 'NIM' ? 'Data prodi/fakultas belum diisi.' : 'Data prodi/fakultas tidak diisi (kategori SMA).'}
                          </p>
                        )}
                      </dl>
                      <div className="mt-auto pt-1">
                        {photoUrl ? (
                          <a
                            href={photoUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex w-full items-center justify-center gap-1.5 rounded-2xl border border-border bg-background/60 px-3 py-2 text-xs font-medium transition-colors hover:border-primary/20 hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            <ExternalLink className="size-3.5" />
                            Lihat foto penuh
                          </a>
                        ) : (
                          <div className="rounded-2xl border border-dashed border-border/60 bg-background/20 px-3 py-2 text-center text-xs leading-4 text-muted-foreground">Foto belum diunggah</div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </CardContent>
          </Card>

          <Card className="border-border/60 bg-card/70 backdrop-blur-md">
            <CardHeader><CardTitle>Dokumen</CardTitle></CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              {data.team.documentUrl ? <a href={data.team.documentUrl} target="_blank" rel="noreferrer" className={cn(buttonVariants({ variant: 'outline' }), 'justify-between')}><span className="flex items-center gap-2"><FileText />Folder Dokumen</span><ExternalLink /></a> : <div className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">Folder dokumen belum tersedia.</div>}
              {data.team.twibbonUrl ? <a href={data.team.twibbonUrl} target="_blank" rel="noreferrer" className={cn(buttonVariants({ variant: 'outline' }), 'justify-between')}><span className="flex items-center gap-2"><FileText />Folder Twibbon</span><ExternalLink /></a> : <div className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">Folder twibbon belum tersedia.</div>}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="border-border/60 bg-card/70 backdrop-blur-md">
            <CardHeader><CardTitle>Registrasi</CardTitle></CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div><p className="text-xs text-muted-foreground">Status</p><div className="mt-1">{data.registration ? <AdminStatusBadge status={data.registration.status} /> : '—'}</div></div>
              <div><p className="text-xs text-muted-foreground">Kompetisi</p><p>{display(data.registration?.competition.name)}</p></div>
              <div><p className="text-xs text-muted-foreground">Batch</p><p>{display(data.registration?.batch.name)}</p></div>
              <div><p className="text-xs text-muted-foreground">Dikirim</p><p>{formatDate(data.registration?.submittedAt)}</p></div>
              {(data.verificationNote ?? data.team.verificationNote) && (
                <div className="rounded-2xl border border-amber-400/25 bg-amber-400/10 p-3 text-amber-100">
                  <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-200"><StickyNote className="size-3.5" />Catatan minta revisi aktif</p>
                  <p className="mt-1 text-sm leading-5">{data.verificationNote ?? data.team.verificationNote}</p>
                  {data.revisionStep ?? data.team.revisionStep ? <p className="mt-2 text-xs text-amber-200/80">Target revisi: <span className="font-medium text-amber-100">{String(data.revisionStep ?? data.team.revisionStep)}</span></p> : null}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/60 bg-card/70 backdrop-blur-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><History className="size-4 text-primary" />Catatan Perubahan</CardTitle>
              <CardDescription>Riwayat alasan admin saat edit data / minta revisi / tolak — paling baru di atas (5 terakhir)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {!data.auditLogs?.length ? (
                <div className="rounded-2xl border border-dashed border-border/60 bg-background/20 p-4 text-center">
                  <StickyNote className="mx-auto size-5 text-muted-foreground/60" />
                  <p className="mt-2 text-sm font-medium text-foreground">Belum ada catatan perubahan</p>
                  <p className="mt-1 text-xs leading-4 text-muted-foreground">Setiap edit via “Edit Data” atau aksi “Minta Revisi/Tolak” akan tercatat di sini dengan alasan.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {data.auditLogs.map((log) => {
                    const label: Record<string, string> = {
                      'team.registration_updated': 'Edit Data',
                      'team.verify': 'Verifikasi',
                      'team.revision_requested': 'Minta Revisi',
                      'team.rejected': 'Tolak',
                      'payment.verify': 'Verifikasi Pembayaran',
                      'payment.revision_requested': 'Revisi Pembayaran',
                      'payment.rejected': 'Tolak Pembayaran',
                    }
                    return (
                      <div key={log.id} className="rounded-2xl border border-border/60 bg-background/30 p-3 transition-colors hover:border-primary/20">
                        <div className="flex items-start justify-between gap-2">
                          <span className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2 py-1 text-[11px] font-medium">
                            <Clock className="size-3 text-muted-foreground" />
                            {label[log.action] ?? log.action}
                          </span>
                          <span className="shrink-0 text-xs text-muted-foreground">{formatDate(log.createdAt)}</span>
                        </div>
                        <p className="mt-2 text-sm leading-5 text-foreground">“{log.reason}”</p>
                        <p className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground">
                          <User className="size-3" />
                          {log.adminName} {log.requestId ? <span className="rounded bg-muted px-1 py-0.5 font-mono text-[10px]">{log.requestId.slice(0, 8)}</span> : null}
                        </p>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/60 bg-card/70 backdrop-blur-md">
            <CardHeader><CardTitle>Keputusan Review</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {!canReview ? <p className="text-sm text-muted-foreground">Role Anda hanya dapat melihat detail tim.</p> : !waitingReview ? <p className="text-sm text-muted-foreground">Aksi review hanya tersedia ketika tim berstatus Menunggu Verifikasi.</p> : <><Button className="w-full" onClick={() => setReviewAction('verify')}><CheckCircle2 />Verifikasi Tim</Button><Button variant="outline" className="w-full" onClick={() => setReviewAction('revise')}><RotateCcw />Minta Revisi</Button><Button variant="destructive" className="w-full" onClick={() => setReviewAction('reject')}><ShieldX />Tolak Tim</Button></>}
            </CardContent>
          </Card>

          {data.registration && paymentAvailable && (
            <Card className="border-border/60 bg-card/70 backdrop-blur-md">
              <CardHeader><CardTitle>Pembayaran</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div><p className="text-xs text-muted-foreground">Status registrasi</p><div className="mt-1"><AdminStatusBadge status={data.registration.status} /></div></div>
                {data.registration.paymentRequiredAt && <div><p className="text-xs text-muted-foreground">Pembayaran diwajibkan</p><p className="mt-1">{new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(data.registration.paymentRequiredAt))}</p></div>}
                <Link href={`/admin/payments/${data.registration.id}`} className={cn(buttonVariants({ variant: 'outline' }), 'w-full')}><Banknote />Detail Pembayaran</Link>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {reviewAction && <TeamReviewDialog teamId={teamId} action={reviewAction} open onOpenChange={(open) => { if (!open) setReviewAction(null) }} />}
      {data.registration && <AdminTeamEditDialog data={data} open={editOpen} onOpenChange={setEditOpen} />}
    </>
  )
}

AdminTeamShow.layout = adminPageLayout
