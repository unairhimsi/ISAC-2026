import { Link, usePage } from '@inertiajs/react'
import { ArrowLeft, ExternalLink, FileText, Loader2 } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { Seo } from '@/components/seo/Seo'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { AdminPageHeader } from '@/features/admin/components/AdminPageHeader'
import { adminPageLayout } from '@/features/admin/components/AdminShell'
import { AdminErrorState, AdminLoadingState } from '@/features/admin/components/AdminStates'
import { SubmissionStatusBadge } from '@/features/admin/components/SubmissionStatusBadge'
import { useAdminSubmission, useReviewAdminSubmission } from '@/features/admin/hooks/useAdmin'
import type { AdminSubmission, AdminSubmissionAction, AdminSubmissionReviewPayload } from '@/features/admin/types/adminTypes'
import { formatDateTime } from '@/features/admin/utils/judging'
import { availableReviewActions, reviewActionLabels, safeFileUrl } from '@/features/admin/utils/submissions'
import { useAuthSession } from '@/features/auth/context/AuthProvider'
import { cn } from '@/lib/utils'

const FEEDBACK_MAX = 2000

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return <div className="space-y-0.5"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="break-words text-sm">{children}</dd></div>
}

function ReviewForm({ submission }: { submission: AdminSubmission }) {
  const actions = availableReviewActions(submission.status)
  const review = useReviewAdminSubmission(submission.id)
  const [action, setAction] = useState<AdminSubmissionAction | null>(null)
  const [score, setScore] = useState('')
  const [feedback, setFeedback] = useState('')

  if (actions.length === 0) {
    return <p className="rounded-2xl border border-dashed border-border/60 p-4 text-sm text-muted-foreground">Tidak ada aksi untuk status ini. Submission menunggu tim mengirim ulang atau sudah final.</p>
  }

  const needsScore = action === 'approved'
  const needsFeedback = action === 'rejected' || action === 'revision_requested'
  const parsedScore = Number(score)
  const scoreValid = score.trim() !== '' && Number.isInteger(parsedScore) && parsedScore >= 0 && parsedScore <= 100
  const scoreError = needsScore && score.trim() !== '' && !scoreValid ? 'Nilai harus bilangan bulat 0–100.' : null
  const canSubmit = action !== null && !review.isPending && (!needsScore || scoreValid) && (!needsFeedback || feedback.trim().length > 0)

  function choose(next: AdminSubmissionAction) {
    setAction(next)
    review.reset()
  }

  async function submit() {
    if (!action || !canSubmit) return
    const payload: AdminSubmissionReviewPayload = { action }
    if (needsScore) payload.score = parsedScore
    if (feedback.trim()) payload.feedback = feedback.trim()
    try {
      await review.mutateAsync(payload)
      toast.success('Penilaian disimpan dan tercatat di audit log.')
      setAction(null)
      setScore('')
      setFeedback('')
    } catch {
      // pesan galat ditampilkan dari state mutasi
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <span id="review-action-label" className="text-xs text-muted-foreground">Keputusan</span>
        <div role="group" aria-labelledby="review-action-label" className="flex flex-wrap gap-2">
          {actions.map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={action === option}
              onClick={() => choose(option)}
              className={cn(
                'h-9 rounded-3xl border px-4 text-sm transition-colors',
                action === option ? (option === 'rejected' ? 'border-destructive bg-destructive text-white' : 'border-primary bg-primary text-primary-foreground') : 'border-input bg-background/60 text-muted-foreground hover:text-foreground',
              )}
            >{reviewActionLabels[option]}</button>
          ))}
        </div>
      </div>

      {action === 'rejected' && (
        <p className="rounded-2xl border border-amber-400/25 bg-amber-400/10 px-3 py-2 text-xs text-amber-300">Penolakan belum final: selama jendela tahap masih dibuka, tim masih bisa memperbaiki dan mengirim ulang submission ini.</p>
      )}

      {needsScore && (
        <label className="block space-y-1.5 text-sm">Nilai (0–100)
          <Input type="number" inputMode="numeric" min={0} max={100} step={1} value={score} onChange={(event) => { setScore(event.target.value); review.reset() }} aria-invalid={Boolean(scoreError)} className="h-10 max-w-40 rounded-3xl bg-background/60" />
          {scoreError && <span className="block text-xs text-destructive">{scoreError}</span>}
        </label>
      )}

      {action !== null && action !== 'under_review' && (
        <label className="block space-y-1.5 text-sm">{needsFeedback ? 'Catatan untuk tim (wajib)' : 'Catatan untuk tim (opsional)'}
          <Textarea value={feedback} onChange={(event) => { setFeedback(event.target.value); review.reset() }} placeholder={needsFeedback ? 'Jelaskan alasan atau bagian yang perlu diperbaiki...' : 'Tambahkan masukan untuk tim...'} rows={4} maxLength={FEEDBACK_MAX} />
          <span className="block text-right text-xs text-muted-foreground">{feedback.length}/{FEEDBACK_MAX}</span>
        </label>
      )}

      {review.error && <p role="alert" className="rounded-2xl border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm text-destructive">{review.error.message}</p>}

      <Button variant={action === 'rejected' ? 'destructive' : 'default'} onClick={submit} disabled={!canSubmit}>
        {review.isPending ? <><Loader2 className="animate-spin" />Menyimpan...</> : action ? `${reviewActionLabels[action]}` : 'Pilih keputusan'}
      </Button>
    </div>
  )
}

export default function AdminSubmissionReviewShow({ submissionId }: { submissionId: string }) {
  const { url } = usePage()
  const listQuery = url.includes('?') ? `?${url.split('?')[1]}` : ''
  const { principal } = useAuthSession()
  const role = principal?.principalType === 'ADMIN' ? principal.admin.role : null
  const canReview = role === 'judge' || role === 'super_admin'
  const canOpenTeam = role === 'super_admin' || role === 'admin_registration'
  const query = useAdminSubmission(submissionId)
  const submission = query.data?.data

  if (query.isLoading) return <AdminLoadingState label="Memuat detail submission..." />
  if (query.error || !submission) return <AdminErrorState message={query.error?.message ?? 'Submission tidak ditemukan.'} retry={() => query.refetch()} />

  const fileUrl = safeFileUrl(submission.file?.url)
  const teamLabel = submission.team?.code ?? submission.teamId

  return (
    <>
      <Seo title={`${teamLabel} · Review Submission`} description="Detail dan penilaian submission ISAC 2026." canonical={`/admin/submission-review/${submissionId}`} noindex />
      <AdminPageHeader
        title={`${teamLabel}${submission.team?.name ? ` · ${submission.team.name}` : ''}`}
        description={`${submission.stage ? `Tahap ${submission.stage.order} · ${submission.stage.name} · ` : ''}${submission.title}`}
        action={<Link href={`/admin/submission-review${listQuery}`} className={cn(buttonVariants({ variant: 'outline' }))}><ArrowLeft />Kembali</Link>}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-border/60 bg-card/70 backdrop-blur-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><FileText className="size-4 text-primary" />Submission</CardTitle>
            <CardDescription>Yang dikumpulkan tim pada tahap ini.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <dl className="grid gap-4 sm:grid-cols-2">
              <Fact label="Judul">{submission.title}</Fact>
              <Fact label="Dikumpulkan">{formatDateTime(submission.submittedAt)}</Fact>
            </dl>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Deskripsi</p>
              {submission.description?.trim() ? <p className="whitespace-pre-wrap break-words text-sm">{submission.description}</p> : <p className="text-sm text-muted-foreground">Tanpa deskripsi.</p>}
            </div>
            {fileUrl
              ? <a href={fileUrl} target="_blank" rel="noopener noreferrer" className={cn(buttonVariants({ variant: 'outline' }))}><ExternalLink />Buka file submission</a>
              : <p className="rounded-2xl border border-dashed border-border/60 p-3 text-sm text-muted-foreground">Submission ini tidak punya file.</p>}
            {canOpenTeam && submission.team && <Link href={`/admin/teams/${submission.team.id}`} className={cn(buttonVariants({ variant: 'ghost' }), 'px-0 text-primary')}>Buka detail tim</Link>}
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/70 backdrop-blur-md">
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center justify-between gap-2">Status &amp; Penilaian <SubmissionStatusBadge status={submission.status} /></CardTitle>
            <CardDescription>Hasil peninjauan terakhir.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <dl className="grid gap-4 sm:grid-cols-2">
              <Fact label="Nilai">{submission.score !== null ? <span className="font-medium tabular-nums">{submission.score}<span className="text-muted-foreground">/100</span></span> : '—'}</Fact>
              <Fact label="Ditinjau">{formatDateTime(submission.reviewedAt)}</Fact>
              <Fact label="Oleh">{submission.reviewedByAdmin?.name ?? '—'}</Fact>
            </dl>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Catatan untuk tim</p>
              {submission.feedback?.trim() ? <p className="whitespace-pre-wrap break-words rounded-2xl border border-border/60 bg-muted/30 p-3 text-sm">{submission.feedback}</p> : <p className="text-sm text-muted-foreground">Belum ada catatan.</p>}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/70 backdrop-blur-md lg:col-span-2">
          <CardHeader>
            <CardTitle>Beri Penilaian</CardTitle>
            <CardDescription>{canReview ? 'Setiap keputusan tercatat di audit log. Nilai wajib untuk persetujuan, catatan wajib untuk penolakan dan permintaan revisi.' : 'Hanya juri dan super admin yang dapat menilai submission.'}</CardDescription>
          </CardHeader>
          <CardContent>
            {canReview ? <ReviewForm key={`${submission.id}:${submission.status}`} submission={submission} /> : <p className="rounded-2xl border border-dashed border-border/60 p-4 text-sm text-muted-foreground">Peran Anda hanya dapat melihat submission.</p>}
          </CardContent>
        </Card>
      </div>
    </>
  )
}

AdminSubmissionReviewShow.layout = adminPageLayout
