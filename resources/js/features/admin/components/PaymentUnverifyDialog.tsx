import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { useUnverifyAdminPayment } from '../hooks/useAdmin'

export function PaymentUnverifyDialog({ registrationId, open, onOpenChange }: { registrationId: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  const [note, setNote] = useState('')
  const unverify = useUnverifyAdminPayment(registrationId)

  function reset() {
    setNote('')
    unverify.reset()
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) reset()
    onOpenChange(nextOpen)
  }

  async function submit() {
    try {
      await unverify.mutateAsync(note.trim())
      toast.success('Verifikasi pembayaran dibatalkan.')
      handleOpenChange(false)
    } catch {
      // mutation error displayed
    }
  }

  const invalid = note.trim().length === 0

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Batalkan verifikasi pembayaran?</DialogTitle><DialogDescription>Pembayaran akan kembali berstatus Menunggu Verifikasi.</DialogDescription></DialogHeader>
        <label className="space-y-1.5 text-sm">Alasan pembatalan
          <Textarea value={note} onChange={(event) => { setNote(event.target.value); unverify.reset() }} placeholder="Contoh: Bukti perlu diperiksa ulang..." maxLength={2000} aria-invalid={Boolean(unverify.error)} />
          <span className="block text-right text-xs text-muted-foreground">{note.length}/2000</span>
        </label>
        {unverify.error && <p className="rounded-2xl border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm text-destructive">{unverify.error.message}</p>}
        <DialogFooter><Button variant="outline" onClick={() => handleOpenChange(false)}>Batal</Button><Button onClick={submit} disabled={unverify.isPending || invalid}>{unverify.isPending ? 'Memproses...' : 'Batalkan Verifikasi'}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
