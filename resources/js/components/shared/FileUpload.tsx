import { useRef } from 'react'
import { FileCheck2, FileText, Loader2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useAppUpload } from '@/features/files/hooks/useAppUpload'
import type { FilePurpose, FileReference } from '@/features/files/types/fileTypes'

export type UploadedFile = FileReference | null

interface FileUploadProps {
  value: UploadedFile
  onChange: (value: UploadedFile) => void
  disabled?: boolean
  accept?: string
  maxSizeMB?: number
  label?: string
  subLabel?: string
  purpose: FilePurpose;
}

export function FileUpload({
  value,
  onChange,
  disabled,
  accept = 'image/png,image/jpeg,image/webp,application/pdf',
  maxSizeMB = 10,
  label = 'Bukti Upload',
  subLabel,
  purpose,
}: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const { status, progress, pendingName, errorMessage, upload, reset } = useAppUpload({
    purpose,
    accept,
    maxSizeMB,
    onUploaded: (file) => onChange(file),
  })

  if (value) {
    return (
      <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <FileCheck2 className="h-4 w-4 shrink-0 text-emerald-400" />
          <span className="truncate text-sm text-white">
            {value.name ?? 'File terupload'}
          </span>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-white/60 hover:bg-white/10 hover:text-white"
          disabled={disabled}
          onClick={() => {
            onChange(null)
            reset()
          }}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    )
  }

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onClick={() => !disabled && status !== 'uploading' && inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click()
        }}
        className={cn(
          'flex cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-white/20 bg-white/5 px-4 py-6 text-center transition-colors hover:bg-white/10',
          (status === 'uploading' || disabled) && 'pointer-events-none opacity-70',
        )}
      >
        {status === 'uploading' ? (
          <>
            <Loader2 className="h-6 w-6 animate-spin text-fuchsia-400" />
            <span className="font-semibold text-fuchsia-400">
              Mengupload{pendingName ? ` "${pendingName}"` : ''}... {progress}%
            </span>
          </>
        ) : (
          <>
            <FileText className="h-6 w-6 text-fuchsia-400" />
            <span className="font-semibold text-fuchsia-400">{label}</span>
            <span className="text-xs text-white/40">
              {subLabel ?? `Max File ${maxSizeMB}mb`}
            </span>
          </>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        hidden
        accept={accept}
        onChange={(e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (file) void upload(file)
        }}
      />
      {errorMessage && <p className="mt-1 text-sm text-red-400">{errorMessage}</p>}
    </>
  )
}
