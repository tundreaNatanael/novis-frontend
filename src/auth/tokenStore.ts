/**
 * Where the session lives in the browser (decisions D-006 and D-021, gap G12).
 *
 * - The access token (≈15 min) is kept in memory and mirrored in `sessionStorage`, so a reload
 *   or a navigation does not need a refresh; a new tab gets one refresh.
 * - The refresh token (90 days, rotating) is kept in `localStorage` so the console survives
 *   reloads and new tabs.
 *
 * Refreshing on every page load would race with rotation: a reload that interrupts an in-flight
 * `POST /auth/refresh` makes the next load reuse the rotated token, which the server treats as
 * theft and answers by revoking every session (gap G17). Keeping the access token per tab avoids
 * that in normal use.
 *
 * Everything that touches storage goes through this module, so a cookie / BFF implementation
 * can replace it without touching the API client or the session provider.
 */
const REFRESH_TOKEN_KEY = 'novis-admin.refreshToken'
const ACCESS_TOKEN_KEY = 'novis-admin.accessToken'

export interface SessionTokens {
  accessToken: string
  refreshToken: string
}

type Listener = () => void

let accessToken: string | null = readAccessToken()
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

function readAccessToken(): string | null {
  try {
    return window.sessionStorage.getItem(ACCESS_TOKEN_KEY)
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
      window.sessionStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken)
      window.localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken)
    } catch {
      // Storage unavailable (private mode, quota): the session then lasts until the reload.
    }
    notify()
  },
  clear(): void {
    accessToken = null
    try {
      window.sessionStorage.removeItem(ACCESS_TOKEN_KEY)
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
