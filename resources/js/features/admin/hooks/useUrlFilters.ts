import { router, usePage } from '@inertiajs/react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

type FilterValues = Record<string, string>

/**
 * Menyimpan filter halaman daftar admin di query string URL lewat client-side visit Inertia,
 * sehingga pencarian/filter/halaman bertahan saat admin membuka detail lalu kembali.
 * Nilai yang sama dengan default tidak ditulis ke URL agar URL tetap pendek.
 */
export function useUrlFilters<T extends FilterValues>(defaults: T) {
  const { url } = usePage()
  const defaultsRef = useRef(defaults)
  const [path, query = ''] = url.split('?')

  const filters = useMemo(() => {
    const params = new URLSearchParams(query)
    const values: FilterValues = { ...defaultsRef.current }
    for (const key of Object.keys(values)) {
      const value = params.get(key)
      if (value !== null) values[key] = value
    }
    return values as T
  }, [query])

  // Ref menjaga setFilters tetap stabil dan selalu membaca URL terbaru, termasuk saat dipanggil
  // dari timer debounce yang dibuat sebelum filter lain diubah.
  const latest = useRef({ filters, path })
  latest.current = { filters, path }

  const setFilters = useCallback((patch: Partial<T>) => {
    const next: FilterValues = { ...latest.current.filters, ...(patch as FilterValues) }
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(next)) {
      if (value !== '' && value !== defaultsRef.current[key]) params.set(key, value)
    }
    const nextQuery = params.toString()
    router.replace({
      url: nextQuery ? `${latest.current.path}?${nextQuery}` : latest.current.path,
      preserveScroll: true,
      preserveState: true,
    })
  }, [])

  const resetFilters = useCallback(() => {
    router.replace({ url: latest.current.path, preserveScroll: true, preserveState: true })
  }, [])

  return { filters, setFilters, resetFilters, queryString: query ? `?${query}` : '' }
}

/** Input pencarian yang baru dikirim ke `commit` setelah pengguna berhenti mengetik. */
export function useDebouncedSearch(committed: string, commit: (value: string) => void, delay = 350) {
  const [input, setInput] = useState(committed)
  const commitRef = useRef(commit)
  commitRef.current = commit

  useEffect(() => {
    const value = input.trim()
    if (value === committed) return
    const timer = setTimeout(() => commitRef.current(value), delay)
    return () => clearTimeout(timer)
    // `committed` sengaja tidak jadi dependency: efek hanya perlu dijadwalkan ulang saat pengguna mengetik.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input, delay])

  return [input, setInput] as const
}
