import { Link } from '@inertiajs/react'
import { ArrowLeft, Clock3, Layers3, RefreshCw, ShieldCheck, Users } from 'lucide-react'
import { toast } from 'sonner'
import { Seo } from '@/components/seo/Seo'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { AdminPageHeader } from '@/features/admin/components/AdminPageHeader'
import { adminPageLayout } from '@/features/admin/components/AdminShell'
import { AdminStatusBadge } from '@/features/admin/components/AdminStatusBadge'
import { AdminErrorState, AdminLoadingState } from '@/features/admin/components/AdminStates'
import { useAdminOperation, useRetryAdminOperationSpreadsheet } from '@/features/admin/hooks/useAdmin'
import { cn } from '@/lib/utils'

const actionLabels: Record<string, string> = {
  VERIFY_TEAM: 'Verifikasi Tim',
  VERIFY_PAYMENT: 'Verifikasi Pembayaran',
  VERIFY_TEAM_PAYMENT: 'Verifikasi Tim & Pembayaran',
  ADVANCE_STAGE: 'Advance Stage',
  ANNOUNCE_RESULT: 'Pengumuman Hasil',
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('id-ID', { dateStyle: 'long', timeStyle: 'short' }).format(new Date(value))
}

function formatShortId(value: string) {
  return value.slice(0, 8)
}

export default function AdminOperationShow({ operationId }: { operationId: string }) {
  const query = useAdminOperation(operationId)
  const retry = useRetryAdminOperationSpreadsheet(operationId)
  const data = query.data?.data

  if (query.isLoading) return <AdminLoadingState label="Memuat detail operasi..." />
  if (query.error || !data)
    return <AdminErrorState message={query.error?.message ?? 'Detail operasi tidak ditemukan.'} retry={() => query.refetch()} />

  const hasRetryable = data.items?.some((item) => item.spreadsheetStatus === 'PENDING' || item.spreadsheetStatus === 'FAILED') ?? false
  const items = data.items ?? []

  function handleRetry() {
    retry.mutate(undefined, {
      onSuccess: (response) => {
        const queued = (response as unknown as { data?: { queued?: number } })?.data?.queued ?? 0
        toast.success(queued > 0 ? `${queued} sinkronisasi spreadsheet dijadwalkan ulang.` : 'Tidak ada item yang perlu di-retry.')
        query.refetch()
      },
      onError: (error) => {
        toast.error(error instanceof Error ? error.message : 'Gagal menjadwalkan retry spreadsheet.')
      },
    })
  }

  return (
    <>
      <Seo title={`${actionLabels[data.action] ?? data.action} · ${formatShortId(data.id)} · Admin`} description="Detail bulk operation dan status sinkronisasi spreadsheet ISAC 2026." canonical={`/admin/operations/${operationId}`} noindex />
      <AdminPageHeader
        title={`${actionLabels[data.action] ?? data.action.replace(/_/g, ' ')} · ${formatShortId(data.id)}`}
        description={`${data.id} · ${data.totalItems} team · diminta oleh ${data.requestedBy?.name ?? '—'}`}
        action={
          <Link href="/admin/operations" className={cn(buttonVariants({ variant: 'outline' }))}>
            <ArrowLeft />Kembali
          </Link>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1.35fr_.65fr]">
        <div className="space-y-6">
          <Card className="border-border/60 bg-card/70 backdrop-blur-md">
            <CardHeader className="flex-row items-center justify-between gap-3">
              <CardTitle>Ringkasan Operasi</CardTitle>
              <AdminStatusBadge status={data.status} />
            </CardHeader>
            <CardContent className="grid gap-4 text-sm sm:grid-cols-2">
              <div><p className="text-xs text-muted-foreground">Aksi</p><p className="mt-1 font-medium">{actionLabels[data.action] ?? data.action}</p></div>
              <div><p className="text-xs text-muted-foreground">Status</p><div className="mt-1"><AdminStatusBadge status={data.status} /></div></div>
              <div><p className="text-xs text-muted-foreground">Total item</p><p className="mt-1 font-medium">{data.totalItems}</p></div>
              <div className="grid grid-cols-3 gap-3">
                <div><p className="text-xs text-muted-foreground">Sukses</p><p className="mt-1 font-medium text-accent">{data.successCount}</p></div>
                <div><p className="text-xs text-muted-foreground">Skip</p><p className="mt-1">{data.skippedCount}</p></div>
                <div><p className="text-xs text-muted-foreground">Gagal</p><p className={data.failedCount > 0 ? 'mt-1 font-medium text-destructive' : 'mt-1'}>{data.failedCount}</p></div>
              </div>
              {data.targetStage && (
                <div className="flex gap-3 sm:col-span-2">
                  <Layers3 className="mt-0.5 size-4 shrink-0 text-primary" />
                  <div><p className="text-xs text-muted-foreground">Target Stage</p><p>{data.targetStage.name} · Order {data.targetStage.order}</p></div>
                </div>
              )}
              {data.announcement.title && (
                <div className="sm:col-span-2 rounded-2xl border border-border bg-background/30 p-3">
                  <p className="text-xs text-muted-foreground">Pengumuman</p>
                  <p className="mt-1 font-medium">{data.announcement.title}</p>
                  {data.announcement.template && <p className="text-xs text-muted-foreground">Template: {data.announcement.template}</p>}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/60 bg-card/70 backdrop-blur-md">
            <CardHeader><CardTitle>Item & Spreadsheet Status ({items.length})</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {items.length === 0 ? (
                <div className="flex min-h-32 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-background/20 text-center">
                  <Users className="size-6 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Tidak ada item pada operasi ini.</p>
                </div>
              ) : (
                <>
                  <div className="hidden overflow-hidden rounded-2xl border border-border md:block">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Team</TableHead>
                          <TableHead>Processing</TableHead>
                          <TableHead>Spreadsheet</TableHead>
                          <TableHead>Status Before → After</TableHead>
                          <TableHead>Last Error</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {items.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell>
                              <div>
                                <p className="font-medium text-foreground">{item.team?.name ?? '—'}</p>
                                <p className="font-mono text-xs text-muted-foreground">{item.team?.code ?? item.team?.id.slice(0, 8) ?? '—'}</p>
                              </div>
                            </TableCell>
                            <TableCell><AdminStatusBadge status={item.processingStatus} /></TableCell>
                            <TableCell><AdminStatusBadge status={item.spreadsheetStatus} /></TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              <span>{item.statusBefore ?? '—'}</span>
                              <span className="mx-1">→</span>
                              <span className="text-foreground">{item.statusAfter ?? '—'}</span>
                            </TableCell>
                            <TableCell className="max-w-64 whitespace-normal text-xs text-destructive">{item.lastError ?? '—'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  <div className="space-y-3 md:hidden">
                    {items.map((item) => (
                      <div key={item.id} className="rounded-2xl border border-border bg-background/30 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-medium">{item.team?.name ?? '—'}</p>
                            <p className="font-mono text-xs text-muted-foreground">{item.team?.code ?? '—'}</p>
                          </div>
                          <AdminStatusBadge status={item.processingStatus} />
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                          <div><p className="text-muted-foreground">Spreadsheet</p><div className="mt-1"><AdminStatusBadge status={item.spreadsheetStatus} /></div></div>
                          <div><p className="text-muted-foreground">Event</p><p className="mt-1 font-mono text-[11px]">{item.event?.eventId.slice(0, 18) ?? '—'}</p></div>
                        </div>
                        {item.lastError && <div className="mt-3 rounded-xl border border-destructive/25 bg-destructive/10 p-2 text-xs text-destructive">{item.lastError}</div>}
                        <div className="mt-2 text-xs text-muted-foreground">
                          {item.statusBefore ?? '—'} → <span className="text-foreground">{item.statusAfter ?? '—'}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="border-border/60 bg-card/70 backdrop-blur-md">
            <CardHeader className="flex-row items-center justify-between gap-3">
              <CardTitle>Timeline</CardTitle>
              <Clock3 className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div><p className="text-xs text-muted-foreground">Dibuat</p><p className="mt-1">{formatDate(data.createdAt)}</p></div>
              <div><p className="text-xs text-muted-foreground">Dimulai</p><p className="mt-1">{formatDate(data.startedAt)}</p></div>
              <div><p className="text-xs text-muted-foreground">Selesai</p><p className="mt-1">{formatDate(data.completedAt)}</p></div>
              <div className="flex gap-3 rounded-2xl border border-border bg-background/30 p-3">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-secondary" />
                <div><p className="text-xs text-muted-foreground">Diminta oleh</p><p className="font-medium">{data.requestedBy?.name ?? '—'}</p></div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/60 bg-card/70 backdrop-blur-md">
            <CardHeader><CardTitle>Aksi Spreadsheet</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {!hasRetryable ? (
                <p className="text-sm text-muted-foreground">Semua sinkronisasi spreadsheet sudah SYNCED atau SKIPPED. Tidak ada yang perlu di-retry.</p>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">Terdapat item dengan status PENDING/FAILED. Retry akan menjadwalkan ulang sinkronisasi ke Google Sheet via queue.</p>
                  <Button className="w-full" onClick={handleRetry} disabled={retry.isPending}>
                    <RefreshCw className={retry.isPending ? 'animate-spin' : ''} />{retry.isPending ? 'Menjadwalkan...' : 'Retry Spreadsheet'}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  )
}

AdminOperationShow.layout = adminPageLayout
