type ImageKitUploadResult = { url: string; filePath?: string }

export function deliveryUrl(
  upload: ImageKitUploadResult,
  endpoint: string | undefined = import.meta.env.VITE_IMAGEKIT_URL_ENDPOINT,
): string {
  const base = (endpoint ?? '').trim().replace(/\/+$/, '')
  if (base === '' || !upload.filePath) return upload.url

  return `${base}${upload.filePath.startsWith('/') ? '' : '/'}${upload.filePath}`
}
