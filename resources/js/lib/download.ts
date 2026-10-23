/** Nama berkas dari header Content-Disposition (mendukung `filename*=UTF-8''...` dan `filename="..."`). */
export function filenameFromContentDisposition(header: string | null): string | null {
  if (!header) return null

  const encoded = /filename\*\s*=\s*UTF-8''([^;]+)/i.exec(header)?.[1]
  if (encoded) {
    try {
      return decodeURIComponent(encoded.trim())
    } catch {
      // Lanjut ke bentuk filename biasa.
    }
  }

  const plain = /filename\s*=\s*(?:"([^"]+)"|([^;]+))/i.exec(header)
  const name = (plain?.[1] ?? plain?.[2])?.trim()

  return name || null
}

/** Memicu dialog simpan browser untuk Blob yang sudah ada di memori. */
export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.style.display = 'none'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()

  // Beri browser waktu memulai unduhan sebelum URL sementara dicabut.
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
