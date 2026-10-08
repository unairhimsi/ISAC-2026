import { useState } from 'react'
import { getAuthToken } from '@/features/auth/authStorage'
import { useUploadThing } from '@/lib/uploadthing'
import { uploadRoutes, type FilePurpose, type FileReference, type UploadedServerData } from '../types/fileTypes'

type UploadStatus = 'idle' | 'uploading' | 'error'

type Options = {
  purpose: FilePurpose
  accept?: string
  maxSizeMB?: number
  onUploaded: (file: FileReference) => void
}

export function useAppUpload({ purpose, accept, maxSizeMB, onUploaded }: Options) {
  const [status, setStatus] = useState<UploadStatus>('idle')
  const [progress, setProgress] = useState(0)
  const [pendingName, setPendingName] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const fail = (message: string) => {
    setErrorMessage(message)
    setStatus('error')
    setProgress(0)
    setPendingName(null)
  }

  const { startUpload } = useUploadThing(uploadRoutes[purpose], {
    headers: () => ({ Authorization: `Bearer ${getAuthToken() ?? ''}` }),
    onUploadBegin: () => {
      setStatus('uploading')
      setProgress(0)
    },
    onUploadProgress: (value) => setProgress(Math.round(value)),
    onClientUploadComplete: (results) => {
      const result = results[0]
      const data = result?.serverData as UploadedServerData | null | undefined

      if (!result || !data?.id) {
        fail('File terupload, tetapi gagal dicatat')
        return
      }

      setStatus('idle')
      setProgress(0)
      setPendingName(null)
      onUploaded({ id: data.id, fileId: data.fileId ?? result.key, url: data.url ?? result.ufsUrl, purpose, name: result.name })
    },
    onUploadError: (error) => fail(error.message || 'Upload gagal, coba lagi'),
  })

  const upload = async (file: File) => {
    const allowed = (accept ?? '').split(',').map((type) => type.trim()).filter(Boolean)

    if (allowed.length > 0 && !allowed.includes(file.type)) {
      fail('Tipe file tidak diizinkan.')
      return
    }
    if (maxSizeMB !== undefined && file.size > maxSizeMB * 1024 * 1024) {
      fail(`Ukuran file melebihi ${maxSizeMB} MB.`)
      return
    }

    setErrorMessage(null)
    setPendingName(file.name)
    await startUpload([file])
  }

  const reset = () => {
    setStatus('idle')
    setProgress(0)
    setPendingName(null)
    setErrorMessage(null)
  }

  return { status, progress, pendingName, errorMessage, isUploading: status === 'uploading', upload, reset }
}
