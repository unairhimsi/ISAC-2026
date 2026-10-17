import { z } from 'zod'

// Same hosts the API accepts, so a link that is already saved can be saved again.
const googleDriveHosts = ['drive.google.com', 'docs.google.com']

const googleDriveUrl = z
  .string()
  .trim()
  .min(1, 'Link Google Drive wajib diisi')
  .url('URL tidak valid')
  .refine((value) => {
    try {
      return googleDriveHosts.includes(new URL(value).hostname)
    } catch {
      return false
    }
  }, 'Link harus berasal dari Google Drive')

export const documentSchema = z.object({
  document_url: googleDriveUrl,
  twibbon_url: googleDriveUrl,
})

export type DocumentFormData = z.infer<typeof documentSchema>
