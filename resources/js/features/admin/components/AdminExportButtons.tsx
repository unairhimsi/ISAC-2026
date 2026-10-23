import { FileSpreadsheet, FileText, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import type { DownloadedFile } from '@/lib/api'
import { saveBlob } from '@/lib/download'
import type { ExportFormat } from '../types/adminTypes'

const formats = [
  { format: 'xlsx', label: 'Excel', icon: FileSpreadsheet },
  { format: 'pdf', label: 'PDF', icon: FileText },
] as const

type AdminExportButtonsProps = {
  /** Harus mengunduh SEMUA data yang cocok dengan filter aktif, bukan hanya halaman yang tampil. */
  onExport: (format: ExportFormat) => Promise<DownloadedFile>
  /** Nama berkas cadangan (tanpa ekstensi) bila server tidak mengirim nama. */
  fallbackName: string
  /** Jumlah data yang cocok dengan filter aktif; 0 menonaktifkan tombol. */
  total?: number
  /** Kata benda untuk keterangan tombol, mis. "tim". */
  noun: string
  disabled?: boolean
}

export function AdminExportButtons({ onExport, fallbackName, total, noun, disabled }: AdminExportButtonsProps) {
  const [pending, setPending] = useState<ExportFormat | null>(null)
  const empty = total === 0
  const hint = empty
    ? `Tidak ada ${noun} untuk diunduh`
    : `Unduh semua${total === undefined ? '' : ` ${total}`} ${noun} sesuai filter, bukan hanya halaman ini`

  async function handleExport(format: ExportFormat) {
    if (pending) return
    setPending(format)

    try {
      const file = await onExport(format)
      saveBlob(file.blob, file.filename ?? `${fallbackName}.${format}`)
      toast.success(`Berkas ${format === 'xlsx' ? 'Excel' : 'PDF'} berhasil diunduh.`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Gagal mengunduh data. Coba lagi nanti.')
    } finally {
      setPending(null)
    }
  }

  return (
    <div className="flex gap-2" role="group" aria-label={`Unduh data ${noun}`}>
      {formats.map(({ format, label, icon: Icon }) => (
        <Button key={format} variant="outline" title={hint} onClick={() => handleExport(format)} disabled={disabled || empty || pending !== null}>
          {pending === format ? <Loader2 className="animate-spin" /> : <Icon />}
          {pending === format ? 'Menyiapkan...' : label}
        </Button>
      ))}
    </div>
  )
}
