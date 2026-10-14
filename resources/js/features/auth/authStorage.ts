const AUTH_TOKEN_KEY = 'isac.authToken'
const AUTH_SESSION_EVENT = 'isac:auth-session-changed'
const SESSION_EXPIRED_NOTICE_KEY = 'isac.sessionExpiredNotice'

export function getAuthToken(): string | null {
  return typeof window === 'undefined' ? null : window.localStorage.getItem(AUTH_TOKEN_KEY)
}

export function setAuthToken(token: string): void {
  clearSessionExpiredNotice()
  window.localStorage.setItem(AUTH_TOKEN_KEY, token)
  window.dispatchEvent(new Event(AUTH_SESSION_EVENT))
}

/** Logout yang dipilih pengguna (tombol Keluar). Tidak menampilkan notifikasi "sesi berakhir". */
export function clearAuthToken(): void {
  window.localStorage.removeItem(AUTH_TOKEN_KEY)
  window.dispatchEvent(new Event(AUTH_SESSION_EVENT))
}

/**
 * Sesi berakhir di luar kehendak pengguna (token ditolak server). Token dihapus dan
 * sebuah penanda disimpan supaya halaman login bisa menjelaskan apa yang terjadi.
 */
export function expireAuthSession(): void {
  try {
    window.sessionStorage.setItem(SESSION_EXPIRED_NOTICE_KEY, '1')
  } catch {
    // sessionStorage bisa tidak tersedia (mode privat); notifikasi saja yang hilang.
  }
  clearAuthToken()
}

export function hasSessionExpiredNotice(): boolean {
  try {
    return typeof window !== 'undefined' && window.sessionStorage.getItem(SESSION_EXPIRED_NOTICE_KEY) !== null
  } catch {
    return false
  }
}

export function clearSessionExpiredNotice(): void {
  try {
    window.sessionStorage.removeItem(SESSION_EXPIRED_NOTICE_KEY)
  } catch {
    // abaikan
  }
}

export function subscribeToAuthSession(listener: () => void): () => void {
  window.addEventListener(AUTH_SESSION_EVENT, listener)
  window.addEventListener('storage', listener)

  return () => {
    window.removeEventListener(AUTH_SESSION_EVENT, listener)
    window.removeEventListener('storage', listener)
  }
}
