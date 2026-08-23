import { Link } from '@inertiajs/react'
import { ChevronLeft, ChevronRight, Eye, Play } from 'lucide-react'
import { useState } from 'react'
import { Seo } from '@/components/seo/Seo'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { AdminPageHeader } from '@/features/admin/components/AdminPageHeader'
import { AdminStatusBadge } from '@/features/admin/components/AdminStatusBadge'
import { RunOperationDialog } from '@/features/admin/components/RunOperationDialog'
import { AdminEmptyState, AdminErrorState, AdminLoadingState } from '@/features/admin/components/AdminStates'
import { adminPageLayout } from '@/features/admin/components/AdminShell'
import { useAdminOperations } from '@/features/admin/hooks/useAdmin'
import type { AdminOperationFilters } from '@/features/admin/types/adminTypes'
import { cn } from '@/lib/utils'

const actionLabels: Record<string, string> = {
  VERIFY_TEAM: 'Verifikasi Tim',
  VERIFY_PAYMENT: 'Verifikasi Pembayaran',
  ADVANCE_STAGE: 'Advance Stage',
  ANNOUNCE_RESULT: 'Pengumuman',
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

function formatShortId(value: string) {
  return value.slice(0, 8)
}

export default function AdminOperationsIndex() {
  const [filters, setFilters] = useState<AdminOperationFilters>({ page: 1, per_page: 15 })
  const [runOpen, setRunOpen] = useState(false)
  const operationsQuery = useAdminOperations(filters)
  const pagination = operationsQuery.data?.data
  const operations = pagination?.data ?? []

  return (
    <>
      <Seo title="Operasi Admin" description="Riwayat bulk operation dan status sinkronisasi spreadsheet ISAC 2026." canonical="/admin/operations" noindex />
      <AdminPageHeader
        title="Operasi & Spreadsheet"
        description="Pantau bulk operation (verifikasi, advance stage, pengumuman) dan status sinkronisasi ke Google Spreadsheet. Gunakan tombol Detail untuk melihat per-team spreadsheet_status dan retry jika gagal."
      />

      <div className="mb-5 flex justify-end">
        <Button onClick={() => setRunOpen(true)}>
          <Play />Jalankan Operasi
        </Button>
      </div>

      <RunOperationDialog open={runOpen} onOpenChange={setRunOpen} />

      {operationsQuery.isLoading ? (
        <AdminLoadingState label="Memuat riwayat operasi..." />
      ) : operationsQuery.error ? (
        <AdminErrorState message={operationsQuery.error.message} retry={() => operationsQuery.refetch()} />
      ) : operations.length === 0 ? (
        <AdminEmptyState title="Belum ada operasi" description="Bulk operation akan muncul di sini setelah admin menjalankan aksi massal. Saat ini semua sinkronisasi spreadsheet masih idle." />
      ) : (
        <>
          <Card className="hidden overflow-hidden border-border/60 bg-card/70 backdrop-blur-md md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Operasi</TableHead>
                  <TableHead>Aksi</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Sukses</TableHead>
                  <TableHead>Gagal</TableHead>
                  <TableHead>Diminta</TableHead>
                  <TableHead>Dibuat</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {operations.map((operation) => (
                  <TableRow key={operation.id}>
                    <TableCell>
                      <div>
                        <p className="font-mono text-xs text-foreground">{formatShortId(operation.id)}</p>
                        <p className="text-xs text-muted-foreground">{operation.id.slice(0, 18)}…</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-foreground">{actionLabels[operation.action] ?? operation.action.replace(/_/g, ' ')}</span>
                      {operation.targetStage && <p className="text-xs text-muted-foreground">→ {operation.targetStage.name}</p>}
                    </TableCell>
                    <TableCell><AdminStatusBadge status={operation.status} /></TableCell>
                    <TableCell className="text-sm">{operation.totalItems}</TableCell>
                    <TableCell className="text-sm text-accent">{operation.successCount}</TableCell>
                    <TableCell className={operation.failedCount > 0 ? 'text-sm text-destructive' : 'text-sm text-muted-foreground'}>{operation.failedCount}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{operation.requestedBy?.name ?? '—'}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatDate(operation.createdAt)}</TableCell>
                    <TableCell className="text-right">
                      <Link href={`/admin/operations/${operation.id}`} className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}>
                        <Eye />Detail
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          <div className="space-y-3 md:hidden">
            {operations.map((operation) => (
              <Card key={operation.id} className="border-border/60 bg-card/70">
                <CardContent className="space-y-4 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-mono text-xs font-medium">{formatShortId(operation.id)}</p>
                      <p className="text-xs text-muted-foreground">{actionLabels[operation.action] ?? operation.action}</p>
                      {operation.targetStage && <p className="text-xs text-secondary">→ {operation.targetStage.name}</p>}
                    </div>
                    <AdminStatusBadge status={operation.status} />
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-xs">
                    <div><p className="text-muted-foreground">Total</p><p className="mt-1 font-medium">{operation.totalItems}</p></div>
                    <div><p className="text-muted-foreground">Sukses</p><p className="mt-1 text-accent">{operation.successCount}</p></div>
                    <div><p className="text-muted-foreground">Gagal</p><p className={operation.failedCount > 0 ? 'mt-1 text-destructive' : 'mt-1'}>{operation.failedCount}</p></div>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{operation.requestedBy?.name ?? '—'}</span>
                    <span>{formatDate(operation.createdAt)}</span>
                  </div>
                  <Link href={`/admin/operations/${operation.id}`} className={cn(buttonVariants({ variant: 'outline' }), 'w-full')}>
                    <Eye />Lihat Detail
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>

          {pagination && (
            <div className="mt-5 flex flex-col items-center justify-between gap-3 text-sm text-muted-foreground sm:flex-row">
              <p>Menampilkan {pagination.meta.from ?? 0}–{pagination.meta.to ?? 0} dari {pagination.meta.total} operasi</p>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" disabled={pagination.meta.current_page <= 1} onClick={() => setFilters((current) => ({ ...current, page: (current.page ?? 1) - 1 }))}>
                  <ChevronLeft />Sebelumnya
                </Button>
                <span className="px-2">{pagination.meta.current_page} / {pagination.meta.last_page}</span>
                <Button variant="outline" size="sm" disabled={pagination.meta.current_page >= pagination.meta.last_page} onClick={() => setFilters((current) => ({ ...current, page: (current.page ?? 1) + 1 }))}>
                  Berikutnya<ChevronRight />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </>
  )
}

AdminOperationsIndex.layout = adminPageLayout
