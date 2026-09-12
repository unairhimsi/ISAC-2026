import { Link } from '@inertiajs/react'
import { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  CalendarDays,
  CircleAlert,
  Clock3,
  FileCheck2,
  FileText,
  Hourglass,
  Info,
  UploadCloud,
  CheckCircle2,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Seo } from '@/components/seo/Seo'
import { DashboardBackdrop } from '@/features/dashboard/components/DashboardBackdrop'
import {
  DashboardError,
  DashboardLoading,
} from '@/features/dashboard/components/DashboardStates'
import { useSubmissionShell } from '@/features/dashboard/hooks/useDashboard'
import { FileUpload, type UploadedFile } from '@/components/shared/FileUpload'
import { formatDate } from '@/lib/formatters'
import { cn } from '@/lib/utils'

function formatRemaining(ms: number | null): string {
  if (ms === null || ms <= 0) return '—'
  const totalSeconds = Math.floor(ms / 1000)
  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  if (days > 0) return `${days} hari ${hours} jam`
  if (hours > 0) return `${hours} jam ${minutes} menit`
  return `${minutes} menit`
}

function WindowStatus({
  isOpen,
  isOverdue,
  startDate,
  endDate,
  remainingMs,
}: {
  isOpen: boolean
  isOverdue: boolean
  startDate: string | null
  endDate: string | null
  remainingMs: number | null
}) {
  if (isOverdue) {
    return {
      label: 'Berakhir',
      title: 'Periode pengumpulan telah berakhir',
      description: 'Batas waktu kumpul karya sudah lewat. Hubungi panitia jika ada kendala.',
      Icon: CircleAlert,
      variant: 'destructive' as const,
    }
  }
  if (!isOpen && startDate && new Date(startDate).getTime() > Date.now()) {
    return {
      label: 'Akan Datang',
      title: 'Belum dibuka',
      description: `Pengumpulan akan dibuka pada ${formatDate(startDate, { dateStyle: 'medium', timeStyle: 'short' })}.`,
      Icon: Hourglass,
      variant: 'outline' as const,
    }
  }
  if (isOpen) {
    return {
      label: 'Dibuka',
      title: 'Pengumpulan dibuka — langsung kumpul',
      description: `Sisa waktu ${formatRemaining(remainingMs)}. Pembayaran sudah lunas di registrasi awal, tidak ada pembayaran tambahan di tahap ini.`,
      Icon: UploadCloud,
      variant: 'default' as const,
    }
  }
  return {
    label: 'Terkunci',
    title: 'Tidak tersedia',
    description: 'Tahap ini tidak tersedia untuk team kamu saat ini.',
    Icon: Info,
    variant: 'outline' as const,
  }
}

export default function SubmissionShell({
  stageId,
}: {
  stageId: string
}) {
  const query = useSubmissionShell(stageId)
  const data = query.data?.data

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [file, setFile] = useState<UploadedFile>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (data?.submission) {
      setTitle(data.submission.title ?? '')
      setDescription(data.submission.description ?? '')
      if (data.submission.file) {
        setFile({
          id: data.submission.file.id,
          fileId: data.submission.file.fileId,
          url: data.submission.file.url,
          name: data.submission.file.url.split('/').pop() ?? 'File terupload',
        })
      }
    }
  }, [data?.submission])

  // live countdown tick
  useEffect(() => {
    if (!data?.window.isOpen) return
    const id = setInterval(() => setTick((t) => t + 1), 60000)
    return () => clearInterval(id)
  }, [data?.window.isOpen])

  const remainingDisplay = useMemo(() => {
    if (!data) return null
    // recompute remaining based on tick to trigger re-render
    void tick
    return formatRemaining(data.window.remainingMs)
  }, [data, tick])

  if (query.isLoading) {
    return <DashboardLoading />
  }

  if (query.error || !data) {
    return (
      <DashboardError
        message={
          query.error?.message ??
          'Tahap pengumpulan tidak tersedia untuk Team ini.'
        }
        retry={() => query.refetch()}
      />
    )
  }

  const windowStatus = WindowStatus({
    isOpen: data.window.isOpen,
    isOverdue: data.window.isOverdue,
    startDate: data.window.startDate,
    endDate: data.window.endDate,
    remainingMs: data.window.remainingMs,
  })
  const WindowIcon = windowStatus.Icon

  const submission = data.submission
  const canSubmit = data.canSubmit && data.window.isOpen

  const statusBadge = submission
    ? submission.status === 'approved'
      ? { label: 'Disetujui', variant: 'default' as const }
      : submission.status === 'rejected'
        ? { label: 'Ditolak', variant: 'destructive' as const }
        : submission.status === 'revision_requested'
          ? { label: 'Revisi', variant: 'outline' as const }
          : submission.status === 'submitted' || submission.status === 'under_review'
            ? { label: 'Terkumpul', variant: 'secondary' as const }
            : { label: 'Draft', variant: 'outline' as const }
    : null

  return (
    <main className="error-portal-shell relative min-h-screen overflow-hidden px-4 pb-24 pt-28 sm:px-6 sm:pt-32">
      <Seo
        title={`${data.stage.name} — Pengumpulan Karya ISAC 2026`}
        description={`Kelola pengumpulan karya ${data.stage.name} ISAC 2026 Symphony of System — langsung kumpul tanpa pembayaran tambahan.`}
        canonical={`/dashboard/submission/${stageId}`}
        noindex
      />

      <DashboardBackdrop />

      <div className="relative z-20 mx-auto max-w-4xl space-y-6">
        <Link
          href="/dashboard"
          className={cn(
            buttonVariants({
              variant: 'outline',
            }),
            'backdrop-blur-xl',
          )}
        >
          <ArrowLeft />
          Kembali ke Dashboard
        </Link>

        <section className="error-portal-card relative">
          <span aria-hidden="true" className="error-border-portal" />
          <span aria-hidden="true" className="error-border-comet" />
          <span aria-hidden="true" className="error-border-pulse" />
          <div className="relative z-10 overflow-hidden rounded-[2rem] border border-white/10 bg-card/55 p-6 shadow-2xl shadow-black/35 backdrop-blur-2xl sm:p-9">
            <span aria-hidden="true" className="error-scanline" />
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <Badge variant="outline">{data.competition.name}</Badge>
                <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
                  {data.stage.name}
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
                  {data.stage.description ?? `Kumpulkan karya untuk tahap ${data.stage.name}. Pembayaran sudah lunas di awal registrasi — di sini cukup kumpul langsung.`}
                </p>
              </div>
              <Badge className="shrink-0 bg-secondary/15 text-secondary">
                {data.competition.type.replace(/_/g, ' ')}
              </Badge>
            </div>
            <div className="mt-7 flex flex-wrap gap-3 text-sm text-muted-foreground">
              <span className="flex items-center gap-2">
                <CalendarDays className="size-4 text-secondary" />
                {formatDate(data.stage.startDate, { dateStyle: 'medium' })} –{' '}
                {formatDate(data.stage.endDate, { dateStyle: 'medium' })}
              </span>
              {data.window.isOpen && (
                <span className="flex items-center gap-2">
                  <Clock3 className="size-4 text-secondary" />
                  Sisa {remainingDisplay}
                </span>
              )}
            </div>
          </div>
        </section>

        {/* WINDOW STATUS — no payment */}
        <Card
          className={cn(
            'border bg-card/50 backdrop-blur-xl',
            data.window.isOpen ? 'border-accent/25' : 'border-white/10',
          )}
        >
          <CardHeader>
            <div className="flex items-start gap-3">
              <div
                className={cn(
                  'flex size-11 shrink-0 items-center justify-center rounded-2xl',
                  data.window.isOpen ? 'bg-accent/10' : 'bg-secondary/10',
                )}
              >
                <WindowIcon
                  className={cn(
                    'size-5',
                    data.window.isOpen ? 'text-accent' : 'text-secondary',
                  )}
                />
              </div>
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle className="text-xl font-bold">{windowStatus.title}</CardTitle>
                  <Badge variant={windowStatus.variant === 'destructive' ? 'destructive' : windowStatus.variant === 'default' ? 'default' : 'outline'}>
                    {windowStatus.label}
                  </Badge>
                </div>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {windowStatus.description}
                </p>
              </div>
            </div>
          </CardHeader>
          {data.window.isOpen && (
            <CardContent>
              <div className="flex items-center gap-2 rounded-2xl border border-accent/20 bg-accent/5 p-4">
                <CheckCircle2 className="size-5 shrink-0 text-accent" />
                <p className="text-sm font-medium">Tidak ada pembayaran di tahap ini — semua biaya sudah dibayar saat registrasi awal (UPFRONT untuk OLIMPIADE, BUSINESS_PLAN, BUSINESS_IT_CASE).</p>
              </div>
            </CardContent>
          )}
        </Card>

        {/* SUBMISSION EXISTING */}
        {submission && (
          <Card className="border border-white/10 bg-card/50 backdrop-blur-xl">
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-lg font-bold flex items-center gap-2">
                    <FileText className="size-5 text-primary" />
                    Status Pengumpulan
                  </CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">Terakhir diperbarui {formatDate(submission.submittedAt ?? submission.reviewedAt, { dateStyle: 'medium', timeStyle: 'short' })}</p>
                </div>
                {statusBadge && <Badge variant={statusBadge.variant}>{statusBadge.label}</Badge>}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-background/30 p-4">
                  <p className="text-xs text-muted-foreground">Judul</p>
                  <p className="mt-1 font-medium">{submission.title}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-background/30 p-4">
                  <p className="text-xs text-muted-foreground">Nilai</p>
                  <p className="mt-1 font-medium">{submission.score ?? '— Belum dinilai'}</p>
                </div>
              </div>
              {submission.description && (
                <div className="rounded-2xl border border-white/10 bg-background/30 p-4">
                  <p className="text-xs text-muted-foreground">Deskripsi</p>
                  <p className="mt-1 text-sm leading-6">{submission.description}</p>
                </div>
              )}
              {submission.feedback && (
                <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
                  <p className="font-semibold text-amber-600">Feedback juri</p>
                  <p className="mt-1 leading-6 text-muted-foreground">{submission.feedback}</p>
                </div>
              )}
              {submission.file && (
                <a href={submission.file.url} target="_blank" rel="noopener noreferrer" className={cn(buttonVariants({ variant: 'outline' }), 'w-full justify-between')}>
                  Lihat File Terkumpul <FileCheck2 className="size-4" />
                </a>
              )}
            </CardContent>
          </Card>
        )}

        {/* DIRECT COLLECTION FORM — no payment */}
        <Card className={cn('border bg-card/55 backdrop-blur-xl', canSubmit ? 'border-primary/20' : 'border-white/10 opacity-80')}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl font-bold">
              <UploadCloud className="size-5 text-primary" />
              {submission ? 'Perbarui Pengumpulan' : 'Kumpul Karya — Langsung'}
            </CardTitle>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              {canSubmit
                ? 'Isi judul, deskripsi, dan upload file karya. File akan di-upload ke ImageKit lalu dicatat sebagai submission. Tidak ada form pembayaran di sini.'
                : data.window.isOverdue
                  ? 'Periode telah berakhir, pengumpulan ditutup.'
                  : 'Pengumpulan belum dibuka atau tidak tersedia untuk team ini.'}
            </p>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="submission-title">Judul Karya</Label>
                <Input
                  id="submission-title"
                  placeholder="Contoh: Prototype Smart City"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  disabled={!canSubmit}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="submission-desc">Deskripsi</Label>
                <Textarea
                  id="submission-desc"
                  placeholder="Jelaskan karya secara singkat..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={!canSubmit}
                  rows={4}
                />
              </div>
              <div className="grid gap-2">
                <Label>File Karya (PDF / Gambar)</Label>
                <FileUpload
                  value={file}
                  onChange={setFile}
                  disabled={!canSubmit}
                  folder={`/submissions/${stageId}`}
                  accept="application/pdf,image/png,image/jpeg,image/webp"
                  maxSizeMB={20}
                  label="Upload File Karya"
                  subLabel="PDF / PNG / JPG max 20mb — langsung tanpa bayar"
                  purpose="SUBMISSION"
                />
                <p className="text-xs text-muted-foreground">File di-upload langsung ke ImageKit (signed), lalu `file_id` akan dipakai saat menyimpan submission.</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button type="button" disabled={!canSubmit || !title.trim()} className="min-w-32">
                Simpan Draft
              </Button>
              <Button type="button" variant="secondary" disabled={!canSubmit || !title.trim() || !file} className="min-w-32">
                Kumpulkan Sekarang
              </Button>
              {!canSubmit && (
                <span className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock3 className="size-4" /> Menunggu periode dibuka / team tidak eligible
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
