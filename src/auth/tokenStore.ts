/**
 * Where the session lives in the browser (decision D-006, gap G12).
 *
 * - The access token is kept in memory only; after a reload a silent refresh restores it.
 * - The refresh token is kept in `localStorage` so the console survives reloads and new tabs.
 *
 * Everything that touches storage goes through this module, so a cookie / BFF implementation
 * can replace it without touching the API client or the session provider.
 */
const REFRESH_TOKEN_KEY = 'novis-admin.refreshToken'

export interface SessionTokens {
  accessToken: string
  refreshToken: string
}

type Listener = () => void

let accessToken: string | null = null
const listeners = new Set<Listener>()

function notify() {
  for (const listener of listeners) listener()
}

function readRefreshToken(): string | null {
  try {
    return window.localStorage.getItem(REFRESH_TOKEN_KEY)
  } catch {
    return null
  }
}

export const tokenStore = {
  getAccessToken(): string | null {
    return accessToken
  },
  getRefreshToken(): string | null {
    return readRefreshToken()
  },
  /** True when a refresh token is stored, i.e. the user may still have a session. */
  hasSession(): boolean {
    return readRefreshToken() !== null
  },
  set(tokens: SessionTokens): void {
    accessToken = tokens.accessToken
    try {
      window.localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken)
    } catch {
      // Storage unavailable (private mode, quota): the session then lasts until the reload.
    }
    notify()
  },
  clear(): void {
    accessToken = null
    try {
      window.localStorage.removeItem(REFRESH_TOKEN_KEY)
    } catch {
      // Nothing to clear.
    }
    notify()
  },
  subscribe(listener: Listener): () => void {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },
}
