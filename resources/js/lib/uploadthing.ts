import { generateReactHelpers } from '@uploadthing/react'
import type { FileRouter } from 'uploadthing/types'

export const { useUploadThing } = generateReactHelpers<FileRouter>({ url: '/api/uploadthing' })
