import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Check, Loader2, Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { ApiClientError } from '@/lib/api'
import { cn } from '@/lib/utils'
import { useAdminStages, useAdminTeams, useCreateAdminOperation } from '../hooks/useAdmin'
import type { AdminOperationAction } from '../types/adminTypes'

const MAX_TEAMS = 500

const actionOptions: Array<{ value: AdminOperationAction; label: string; description: string }> = [
  { value: 'VERIFY_TEAM_PAYMENT', label: 'Verifikasi Tim & Pembayaran', description: 'Template otomatis + email pengumuman ke peserta.' },
  { value: 'VERIFY_TEAM', label: 'Verifikasi Tim', description: 'Template otomatis + email pengumuman.' },
  { value: 'VERIFY_PAYMENT', label: 'Verifikasi Pembayaran', description: 'Template otomatis + email pengumuman.' },
  { value: 'ADVANCE_STAGE', label: 'Advance Stage', description: 'Template otomatis + email kelolosan tahap.' },
  { value: 'ANNOUNCE_RESULT', label: 'Pengumuman Finalis', description: 'Tulis pesan custom untuk finalis / hasil.' },
]

const TEMPLATE_MAP: Record<string, { title: string; message: string }> = {
  VERIFY_TEAM: {
    title: 'Verifikasi Data Team',
    message: 'Data Team Anda telah diverifikasi oleh panitia ISAC 2026. Silakan lanjutkan ke tahap pembayaran jika diperlukan.',
  },
  VERIFY_PAYMENT: {
    title: 'Verifikasi Pembayaran',
    message: 'Pembayaran Team Anda telah diverifikasi oleh panitia ISAC 2026. Anda dapat melanjutkan ke tahap berikutnya.',
  },
  VERIFY_TEAM_PAYMENT: {
    title: 'Verifikasi Tim & Pembayaran',
    message: 'Data dan pembayaran Team Anda telah diverifikasi oleh panitia ISAC 2026. Anda dapat melanjutkan ke tahap berikutnya.',
  },
  ADVANCE_STAGE: {
    title: 'Pengumuman Kelolosan Tahap',
    message: 'Selamat! Team Anda dinyatakan lolos ke tahap berikutnya ISAC 2026. Pantau dashboard untuk jadwal selanjutnya.',
  },
}

const TEMPLATE_ACTIONS = new Set(['VERIFY_TEAM', 'VERIFY_PAYMENT', 'VERIFY_TEAM_PAYMENT', 'ADVANCE_STAGE'])

type SelectedTeam = { id: string; name: string }

export function RunOperationDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [action, setAction] = useState<AdminOperationAction | ''>('')
  const [selectedTeams, setSelectedTeams] = useState<SelectedTeam[]>([])
  const [search, setSearch] = useState('')
  const [competitionId, setCompetitionId] = useState('')
  const [stageId, setStageId] = useState('')
  const [announcementTitle, setAnnouncementTitle] = useState('')
  const [announcementTemplate, setAnnouncementTemplate] = useState('')
  const [announcementMessage, setAnnouncementMessage] = useState('')
  const [sendNotification, setSendNotification] = useState(true)
  const [syncSpreadsheet, setSyncSpreadsheet] = useState(true)
  const [localError, setLocalError] = useState('')

  const teamsQuery = useAdminTeams(
    open ? { page: 1, per_page: 100, competition_id: competitionId || undefined } : { page: 1 },
  )
  const stagesQuery = useAdminStages()
  const create = useCreateAdminOperation()

  useEffect(() => {
    if (!open) {
      setAction('')
      setSelectedTeams([])
      setSearch('')
      setCompetitionId('')
      setStageId('')
      setAnnouncementTitle('')
      setAnnouncementTemplate('')
      setAnnouncementMessage('')
      setSendNotification(true)
      setSyncSpreadsheet(true)
      setLocalError('')
    }
  }, [open])

  const teams = useMemo(() => teamsQuery.data?.data?.data ?? [], [teamsQuery.data])
  const stages = useMemo(() => stagesQuery.data?.data ?? [], [stagesQuery.data])

  const filteredTeams = useMemo(() => {
    const keyword = search.trim().toLowerCase()
    if (!keyword) return teams
    return teams.filter((item) => {
      const name = item.team.name ?? ''
      const email = item.team.email ?? ''
      const code = item.team.code ?? ''
      return (
        name.toLowerCase().includes(keyword)
        || email.toLowerCase().includes(keyword)
        || code.toLowerCase().includes(keyword)
      )
    })
  }, [teams, search])

  const selectedIds = new Set(selectedTeams.map((team) => team.id))

  const toggleTeam = (id: string, name: string | null) => {
    setLocalError('')
    setSelectedTeams((current) => {
      if (current.some((team) => team.id === id)) {
        return current.filter((team) => team.id !== id)
      }
      if (current.length >= MAX_TEAMS) {
        setLocalError(`Maksimal ${MAX_TEAMS} tim per operasi.`)
        return current
      }
      return [...current, { id, name: name ?? id }]
    })
  }

  const activeAction = actionOptions.find((option) => option.value === action)

  const isTemplateAction = TEMPLATE_ACTIONS.has(action)
  const isAnnounceCustom = action === 'ANNOUNCE_RESULT'

  const canSubmit = Boolean(
    action
      && selectedTeams.length > 0
      && (action !== 'ADVANCE_STAGE' || stageId),
  ) && !create.isPending
    // Untuk ANNOUNCE_RESULT, peserta harus isi pesan custom
    && (isAnnounceCustom ? announcementMessage.trim().length > 0 : true)

  const showAnnouncement = Boolean(action)
  const handleSubmit = async () => {
    if (!action || selectedTeams.length === 0) {
      setLocalError('Pilih aksi dan minimal satu tim.')
      return
    }
    if (action === 'ADVANCE_STAGE' && !stageId) {
      setLocalError('Target Stage wajib dipilih untuk advance stage.')
      return
    }
    if (isAnnounceCustom && !announcementMessage.trim()) {
      setLocalError('Isi pesan pengumuman finalis tidak boleh kosong.')
      return
    }

    const templateForAction = TEMPLATE_MAP[action as string]

    try {
      const response = await create.mutateAsync({
        action,
        team_ids: selectedTeams.map((team) => team.id),
        target_stage_id: action === 'ADVANCE_STAGE' ? stageId : null,
        sync_spreadsheet: syncSpreadsheet,
        announcement: showAnnouncement
          ? {
              title: isTemplateAction ? (templateForAction?.title ?? null) : (announcementTitle.trim() || null),
              template: isTemplateAction ? action.toLowerCase() : (announcementTemplate.trim() || null),
              message: isTemplateAction ? (templateForAction?.message ?? null) : (announcementMessage.trim() || null),
              send_notification: sendNotification,
            }
          : undefined,
      })

      toast.success(response.message ?? 'Operasi admin diterima dan diproses di background.')
      onOpenChange(false)
    } catch (error) {
      const message = error instanceof ApiClientError
        ? error.fields[Object.keys(error.fields)[0] ?? '_']?.[0] ?? error.message
        : 'Gagal menjalankan operasi.'
      setLocalError(message)
      toast.error(message)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Jalankan Operasi Massal</DialogTitle>
          <DialogDescription>
            Operasi diproses di background. Pantau progresnya pada tabel riwayat operasi.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-2">
            <p className="text-sm font-semibold">Aksi</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {actionOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => { setAction(option.value); setLocalError('') }}
                  className={cn(
                    'rounded-xl border p-3 text-left transition-colors',
                    action === option.value
                      ? 'border-primary bg-primary/10'
                      : 'border-border/60 hover:border-primary/50',
                  )}
                >
                  <p className="text-sm font-semibold">{option.label}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{option.description}</p>
                </button>
              ))}
            </div>
          </div>

          {action === 'ADVANCE_STAGE' && (
            <div className="space-y-2">
              <label className="text-sm font-semibold" htmlFor="run-op-stage">Target Stage</label>
              <select
                id="run-op-stage"
                value={stageId}
                onChange={(event) => setStageId(event.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Pilih stage tujuan...</option>
                {stages.map((stage) => (
                  <option key={stage.id} value={stage.id}>{stage.name}</option>
                ))}
              </select>
            </div>
          )}

          {showAnnouncement && (
            <div className="space-y-3 rounded-xl border border-border/60 p-4">
              {isTemplateAction ? (
                <>
                  <p className="text-sm font-semibold">Email Template Otomatis</p>
                  <div className="rounded-xl border border-border bg-background/40 p-3">
                    <p className="text-xs text-muted-foreground">Judul</p>
                    <p className="text-sm font-medium">{TEMPLATE_MAP[action]?.title}</p>
                    <p className="mt-2 text-xs text-muted-foreground">Pesan (akan dipersonalisasi per Team)</p>
                    <p className="text-sm whitespace-pre-wrap">{TEMPLATE_MAP[action]?.message}</p>
                    <p className="mt-2 text-xs text-muted-foreground">Logo: <span className="font-mono">/logo.png</span> dari public · Pengirim: <span className="font-mono">ISAC 2026 — HIMSI UNAIR</span></p>
                  </div>
                  <p className="text-xs text-muted-foreground">Template otomatis dipakai — admin tidak perlu input manual. Akan tetap terkirim sebagai pengumuman walau status Team sudah VERIFIED.</p>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={sendNotification}
                      onChange={(event) => setSendNotification(event.target.checked)}
                      className="size-4 accent-primary"
                    />
                    Kirim email pengumuman ke tim
                  </label>
                </>
              ) : (
                <>
                  <p className="text-sm font-semibold">Pesan Pengumuman Finalis (Custom)</p>
                  <Input
                    placeholder="Judul pengumuman"
                    value={announcementTitle}
                    onChange={(event) => setAnnouncementTitle(event.target.value)}
                    maxLength={160}
                  />
                  <Textarea
                    placeholder="Tulis pesan pengumuman finalis di sini... (hanya text, tanpa template)"
                    value={announcementMessage}
                    onChange={(event) => setAnnouncementMessage(event.target.value)}
                    rows={5}
                    maxLength={5000}
                  />
                  <p className="text-xs text-muted-foreground">Untuk Finalis: isi pesan manual. Template tidak dipakai — hanya text yang kamu tulis yang akan dikirim.</p>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={sendNotification}
                      onChange={(event) => setSendNotification(event.target.checked)}
                      className="size-4 accent-primary"
                    />
                    Kirim notifikasi email ke tim
                  </label>
                </>
              )}
            </div>
          )}

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold">Tim Terpilih ({selectedTeams.length}/{MAX_TEAMS})</p>
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={syncSpreadsheet}
                  onChange={(event) => setSyncSpreadsheet(event.target.checked)}
                  className="size-4 accent-primary"
                />
                Sinkron Spreadsheet
              </label>
            </div>

            {selectedTeams.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {selectedTeams.map((team) => (
                  <span key={team.id} className="flex items-center gap-1 rounded-full bg-primary/15 px-3 py-1 text-xs font-medium">
                    {team.name}
                    <button
                      type="button"
                      aria-label={`Hapus ${team.name}`}
                      onClick={() => toggleTeam(team.id, team.name)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <X className="size-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Cari nama / email / kode tim..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="pl-9"
              />
            </div>

            <div className="max-h-56 space-y-1 overflow-y-auto rounded-xl border border-border/60 p-2">
              {teamsQuery.isLoading ? (
                <p className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" /> Memuat tim...
                </p>
              ) : filteredTeams.length === 0 ? (
                <p className="p-3 text-sm text-muted-foreground">Tidak ada tim yang cocok.</p>
              ) : (
                filteredTeams.map((item) => {
                  const isSelected = selectedIds.has(item.team.id)
                  return (
                    <button
                      key={item.team.id}
                      type="button"
                      onClick={() => toggleTeam(item.team.id, item.team.name)}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-accent/50',
                        isSelected && 'bg-primary/10',
                      )}
                    >
                      <span className={cn(
                        'flex size-5 shrink-0 items-center justify-center rounded border',
                        isSelected ? 'border-primary bg-primary text-primary-foreground' : 'border-input',
                      )}>
                        {isSelected && <Check className="size-3.5" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{item.team.name ?? '(Tanpa nama)'}</span>
                        <span className="block truncate text-xs text-muted-foreground">{item.team.email}</span>
                      </span>
                    </button>
                  )
                })
              )}
            </div>
          </div>

          {localError && <p className="text-sm text-destructive">{localError}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={create.isPending}>
            Batal
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {create.isPending && <Loader2 className="size-4 animate-spin" />}
            Jalankan Operasi
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
