import { tokenStore, type SessionTokens } from '@/auth/tokenStore'
import { ApiError, NetworkError } from './errors'

/** Base URL of the API, without a trailing slash. */
export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080').replace(
  /\/+$/,
  '',
)

export type QueryValue = string | number | boolean | null | undefined
/** Arrays repeat the parameter (`sort=name,asc&sort=createdAt,desc`). */
export type Query = Record<string, QueryValue | QueryValue[]>

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  body?: unknown
  query?: Query
  /** Send the bearer token and run the refresh flow on 401. Default `true`. */
  auth?: boolean
  signal?: AbortSignal
}

export type SessionEvent = 'expired'
type SessionListener = (event: SessionEvent) => void
const sessionListeners = new Set<SessionListener>()

/** Fires once when the session is gone for good (refresh rejected, account unavailable). */
export function onSessionEvent(listener: SessionListener): () => void {
  sessionListeners.add(listener)
  return () => {
    sessionListeners.delete(listener)
  }
}

export function buildUrl(path: string, query?: Query): string {
  const url = new URL(API_BASE_URL + path)
  for (const [key, value] of Object.entries(query ?? {})) {
    for (const item of Array.isArray(value) ? value : [value]) {
      if (item === undefined || item === null || item === '') continue
      url.searchParams.append(key, String(item))
    }
  }
  return url.toString()
}

/** Codes after which the session cannot be recovered (API.md §1.2). */
const FATAL_401_CODES = new Set(['INVALID_REFRESH_TOKEN', 'ACCOUNT_UNAVAILABLE', 'INVALID_TOKEN'])

/**
 * Typed JSON request. Adds the bearer header, parses `ApiError` bodies, and on
 * `401 TOKEN_EXPIRED` runs exactly one shared refresh before retrying the request once.
 */
export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { auth = true } = options
  const response = await send(path, options)
  if (response.status !== 401 || !auth) {
    return parse<T>(response)
  }
  const error = await parseError(response)
  if (FATAL_401_CODES.has(error.code)) {
    expireSession()
    throw error
  }
  // TOKEN_EXPIRED, or UNAUTHORIZED because the in-memory access token was lost: refresh once.
  if (tokenStore.getRefreshToken() && (await refreshSession())) {
    return parse<T>(await send(path, options))
  }
  expireSession()
  throw error
}

async function send(path: string, options: RequestOptions): Promise<Response> {
  const { method = 'GET', body, query, auth = true, signal } = options
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (auth) {
    const token = await ensureAccessToken()
    if (token) headers.Authorization = `Bearer ${token}`
  }
  try {
    return await fetch(buildUrl(path, query), {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    })
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === 'AbortError') throw cause
    throw new NetworkError()
  }
}

/** The access token, refreshed first when only the refresh token survived a reload. */
async function ensureAccessToken(): Promise<string | null> {
  const current = tokenStore.getAccessToken()
  if (current) return current
  if (!tokenStore.getRefreshToken()) return null
  await refreshSession()
  return tokenStore.getAccessToken()
}

let refreshInFlight: Promise<boolean> | null = null

/**
 * Rotates the refresh token (`POST /auth/refresh`) and stores both new tokens. Concurrent callers
 * share one in-flight request. Resolves `false` when the session is over; a network failure keeps
 * the stored tokens so the next attempt can try again.
 */
export function refreshSession(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = doRefresh().finally(() => {
      refreshInFlight = null
    })
  }
  return refreshInFlight
}

async function doRefresh(): Promise<boolean> {
  const refreshToken = tokenStore.getRefreshToken()
  if (!refreshToken) return false
  let response: Response
  try {
    response = await fetch(buildUrl('/auth/refresh'), {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    })
  } catch {
    return false
  }
  if (!response.ok) {
    expireSession()
    return false
  }
  const tokens = (await response.json()) as SessionTokens
  tokenStore.set({ accessToken: tokens.accessToken, refreshToken: tokens.refreshToken })
  return true
}

/** Clears the stored session and tells the app to go to the sign-in screen. */
export function expireSession(): void {
  if (!tokenStore.hasSession() && !tokenStore.getAccessToken()) return
  tokenStore.clear()
  for (const listener of sessionListeners) listener('expired')
}

async function parse<T>(response: Response): Promise<T> {
  if (!response.ok) throw await parseError(response)
  if (response.status === 204 || response.headers.get('content-length') === '0') {
    return undefined as T
  }
  const text = await response.text()
  return (text ? JSON.parse(text) : undefined) as T
}

async function parseError(response: Response): Promise<ApiError> {
  const fallback = response.statusText || `Request failed with status ${response.status}`
  try {
    const body: unknown = await response.clone().json()
    return ApiError.fromBody(response.status, body, fallback)
  } catch {
    return ApiError.fromBody(response.status, null, fallback)
  }
}

/** Shorthands used by the resource modules. */
export const http = {
  get: <T>(path: string, query?: Query, signal?: AbortSignal) =>
    request<T>(path, { method: 'GET', query, signal }),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PUT', body }),
  delete: (path: string) => request<void>(path, { method: 'DELETE' }),
}
