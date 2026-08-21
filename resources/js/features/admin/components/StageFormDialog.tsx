import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { ApiClientError } from '@/lib/api'
import { useCreateStage, useUpdateStage } from '../hooks/useAdmin'
import type { AdminCompetition, AdminStage, StagePayload, StageType } from '../types/adminTypes'

const stageTypes: Array<{ value: StageType; label: string }> = [
  { value: 'registration', label: 'Registrasi' },
  { value: 'submission', label: 'Pengumpulan' },
  { value: 'selection', label: 'Seleksi' },
  { value: 'exam', label: 'Ujian' },
  { value: 'interview', label: 'Wawancara' },
  { value: 'announcement', label: 'Pengumuman' },
  { value: 'final', label: 'Final' },
]

function dateTimeValue(value: string | null | undefined) {
  if (!value) return ''
  const date = new Date(value)
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return localDate.toISOString().slice(0, 16)
}

function emptyForm(competitionId: string, order: number): StagePayload {
  return {
    competition_id: competitionId,
    name: '',
    type: 'submission',
    description: '',
    order,
    start_date: '',
    end_date: '',
    is_active: true,
  }
}

export function StageFormDialog({
  open,
  onOpenChange,
  stage,
  competitions,
  defaultCompetitionId,
  defaultOrder,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  stage: AdminStage | null
  competitions: AdminCompetition[]
  defaultCompetitionId: string
  defaultOrder: number
}) {
  const [form, setForm] = useState<StagePayload>(() => emptyForm(defaultCompetitionId, defaultOrder))
  const [localError, setLocalError] = useState('')
  const create = useCreateStage()
  const update = useUpdateStage()
  const mutation = stage ? update : create
  const apiError = mutation.error instanceof ApiClientError ? mutation.error : null

  useEffect(() => {
    if (!open) return
    setForm(stage ? {
      competition_id: stage.competitionId,
      name: stage.name,
      type: stage.type,
      description: stage.description ?? '',
      order: stage.order,
      start_date: dateTimeValue(stage.startDate),
      end_date: dateTimeValue(stage.endDate),
      is_active: stage.isActive,
    } : emptyForm(defaultCompetitionId, defaultOrder))
    setLocalError('')
    mutation.reset()
  }, [defaultCompetitionId, defaultOrder, mutation, open, stage])

  function setField<K extends keyof StagePayload>(key: K, value: StagePayload[K]) {
    setForm((current) => ({ ...current, [key]: value }))
    setLocalError('')
    mutation.reset()
  }

  async function submit() {
    if (!form.competition_id || !form.name.trim() || form.order < 1) {
      setLocalError('Kompetisi, nama tahap, dan urutan tahap wajib diisi.')
      return
    }
    if ((form.start_date && !form.end_date) || (!form.start_date && form.end_date)) {
      setLocalError('Isi tanggal mulai dan selesai bersamaan, atau kosongkan keduanya.')
      return
    }
    if (form.start_date && form.end_date && form.end_date < form.start_date) {
      setLocalError('Tanggal selesai tidak boleh sebelum tanggal mulai.')
      return
    }

    try {
      if (stage) {
        const { competition_id: _competitionId, ...payload } = form
        await update.mutateAsync({ id: stage.id, payload })
      } else {
        await create.mutateAsync(form)
      }
      toast.success(stage ? 'Tahap berhasil diperbarui.' : 'Tahap berhasil dibuat.')
      onOpenChange(false)
    } catch {
      // Kesalahan API ditampilkan di bawah formulir.
    }
  }

  const fieldError = (field: string) => apiError?.fields[field]?.[0]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{stage ? 'Edit Tahap Kompetisi' : 'Buat Tahap Kompetisi'}</DialogTitle>
          <DialogDescription>Urutan tahap menentukan alur perpindahan tim. Tahap yang sudah dipakai tim tidak dapat dihapus.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1.5 text-sm sm:col-span-2">Kompetisi
            {stage ? <Input value={stage.competition.name} disabled /> : <select value={form.competition_id} onChange={(event) => setField('competition_id', event.target.value)} className="h-9 w-full rounded-3xl border border-input bg-input/50 px-3" aria-invalid={Boolean(fieldError('competition_id'))}>
              <option value="">Pilih kompetisi</option>
              {competitions.map((competition) => <option key={competition.id} value={competition.id}>{competition.name}</option>)}
            </select>}
            {fieldError('competition_id') && <span className="text-xs text-destructive">{fieldError('competition_id')}</span>}
          </label>
          <label className="space-y-1.5 text-sm">Nama tahap
            <Input value={form.name} onChange={(event) => setField('name', event.target.value)} placeholder="Contoh: Penyisihan" aria-invalid={Boolean(fieldError('name'))} />
            {fieldError('name') && <span className="text-xs text-destructive">{fieldError('name')}</span>}
          </label>
          <label className="space-y-1.5 text-sm">Jenis aktivitas
            <select value={form.type} onChange={(event) => setField('type', event.target.value as StageType)} className="h-9 w-full rounded-3xl border border-input bg-input/50 px-3">
              {stageTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
            </select>
          </label>
          <label className="space-y-1.5 text-sm">Urutan tahap
            <Input type="number" min={1} value={form.order} onChange={(event) => setField('order', Math.max(1, Number(event.target.value) || 1))} aria-invalid={Boolean(fieldError('order'))} />
            {fieldError('order') && <span className="text-xs text-destructive">{fieldError('order')}</span>}
          </label>
          <label className="flex items-end gap-3 pb-2 text-sm"><input type="checkbox" checked={form.is_active} onChange={(event) => setField('is_active', event.target.checked)} className="size-4 accent-primary" />Tahap aktif</label>
          <label className="space-y-1.5 text-sm">Mulai (opsional)<Input type="datetime-local" value={form.start_date ?? ''} onChange={(event) => setField('start_date', event.target.value)} /></label>
          <label className="space-y-1.5 text-sm">Selesai (opsional)<Input type="datetime-local" value={form.end_date ?? ''} onChange={(event) => setField('end_date', event.target.value)} aria-invalid={Boolean(fieldError('end_date'))} /></label>
          <label className="space-y-1.5 text-sm sm:col-span-2">Deskripsi (opsional)<Textarea value={form.description ?? ''} onChange={(event) => setField('description', event.target.value)} placeholder="Jelaskan tujuan atau instruksi tahap." /></label>
        </div>

        {(localError || mutation.error) && <p className="rounded-2xl border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm text-destructive">{localError || mutation.error?.message}</p>}
        <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Batal</Button><Button onClick={submit} disabled={mutation.isPending}>{mutation.isPending ? 'Menyimpan...' : 'Simpan Tahap'}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
