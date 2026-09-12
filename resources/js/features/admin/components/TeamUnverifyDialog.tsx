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
import { useUnverifyAdminTeam } from '../hooks/useAdmin'

export function TeamUnverifyDialog({ teamId, open, onOpenChange }: { teamId: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  const [note, setNote] = useState('')
  const unverify = useUnverifyAdminTeam(teamId)

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
      await unverify.mutateAsync(note.trim() || undefined)
      toast.success('Verifikasi tim dibatalkan. Status kembali menunggu verifikasi.')
      handleOpenChange(false)
    } catch {
      // mutation error displayed
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Batalkan verifikasi tim?</DialogTitle><DialogDescription>Tim akan kembali berstatus Menunggu Verifikasi dan perlu diverifikasi ulang. Berikan alasan koreksi jika diperlukan.</DialogDescription></DialogHeader>
        <label className="space-y-1.5 text-sm">Alasan pembatalan (opsional)
          <Textarea value={note} onChange={(event) => { setNote(event.target.value); unverify.reset() }} placeholder="Contoh: Perlu koreksi data institusi..." maxLength={2000} aria-invalid={Boolean(unverify.error)} />
          <span className="block text-right text-xs text-muted-foreground">{note.length}/2000</span>
        </label>
        {unverify.error && <p className="rounded-2xl border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm text-destructive">{unverify.error.message}</p>}
        <DialogFooter><Button variant="outline" onClick={() => handleOpenChange(false)}>Batal</Button><Button variant="outline" onClick={submit} disabled={unverify.isPending}>{unverify.isPending ? 'Memproses...' : 'Batalkan Verifikasi'}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
