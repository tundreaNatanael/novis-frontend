import { http, HttpResponse } from 'msw/http'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { tokenStore } from '@/auth/tokenStore'
import { server } from '@/test/server'
import { API_BASE_URL, buildUrl, onSessionEvent, request } from './client'
import { ApiError, NetworkError } from './errors'

const url = (path: string) => `${API_BASE_URL}${path}`

afterEach(() => {
  tokenStore.clear()
})

describe('buildUrl', () => {
  it('appends query parameters, repeats arrays and drops empty values', () => {
    const built = buildUrl('/lessons', {
      page: 0,
      size: 20,
      sort: ['scheduledAt,asc', 'createdAt,desc'],
      paid: false,
      q: '',
      x: null,
    })
    expect(built).toBe(
      `${API_BASE_URL}/lessons?page=0&size=20&sort=scheduledAt%2Casc&sort=createdAt%2Cdesc&paid=false`,
    )
  })
})

describe('request', () => {
  it('sends the bearer header and parses JSON', async () => {
    tokenStore.set({ accessToken: 'access-1', refreshToken: 'refresh-1' })
    server.use(
      http.get(url('/orgs'), ({ request: req }) => {
        expect(req.headers.get('authorization')).toBe('Bearer access-1')
        expect(req.headers.get('accept')).toBe('application/json')
        return HttpResponse.json({ content: [], totalElements: 0 })
      }),
    )
    await expect(request('/orgs')).resolves.toEqual({ content: [], totalElements: 0 })
  })

  it('returns undefined for 204 and parses ApiError bodies', async () => {
    tokenStore.set({ accessToken: 'a', refreshToken: 'r' })
    server.use(
      http.delete(url('/orgs/1'), () => new HttpResponse(null, { status: 204 })),
      http.post(url('/orgs'), () =>
        HttpResponse.json(
          {
            timestamp: 'now',
            status: 400,
            code: 'VALIDATION_FAILED',
            message: 'Validation failed',
            fieldErrors: [{ field: 'slug', message: 'must match' }],
          },
          { status: 400 },
        ),
      ),
    )
    await expect(request('/orgs/1', { method: 'DELETE' })).resolves.toBeUndefined()
    const error = await request('/orgs', { method: 'POST', body: {} }).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiError)
    const apiError = error as ApiError
    expect(apiError.status).toBe(400)
    expect(apiError.code).toBe('VALIDATION_FAILED')
    expect(apiError.fieldErrors).toEqual([{ field: 'slug', message: 'must match' }])
    expect(apiError.isValidation).toBe(true)
  })

  it('refreshes once for concurrent TOKEN_EXPIRED answers, stores both tokens and retries', async () => {
    tokenStore.set({ accessToken: 'old', refreshToken: 'refresh-1' })
    let refreshCalls = 0
    server.use(
      http.get(url('/students'), ({ request: req }) => {
        if (req.headers.get('authorization') === 'Bearer old') {
          return HttpResponse.json({ code: 'TOKEN_EXPIRED', message: 'expired' }, { status: 401 })
        }
        return HttpResponse.json({ ok: req.headers.get('authorization') })
      }),
      http.post(url('/auth/refresh'), async ({ request: req }) => {
        refreshCalls += 1
        const body = (await req.json()) as { refreshToken: string }
        expect(body.refreshToken).toBe('refresh-1')
        return HttpResponse.json({
          accessToken: 'new',
          refreshToken: 'refresh-2',
          tokenType: 'Bearer',
          expiresInSeconds: 900,
          scope: 'USER',
        })
      }),
    )
    const results = await Promise.all([
      request('/students'),
      request('/students'),
      request('/students'),
    ])
    expect(results).toEqual(Array(3).fill({ ok: 'Bearer new' }))
    expect(refreshCalls).toBe(1)
    expect(tokenStore.getAccessToken()).toBe('new')
    expect(tokenStore.getRefreshToken()).toBe('refresh-2')
  })

  it('restores the access token from the refresh token after a reload', async () => {
    window.localStorage.setItem('novis-admin.refreshToken', 'refresh-1')
    server.use(
      http.post(url('/auth/refresh'), () =>
        HttpResponse.json({
          accessToken: 'fresh',
          refreshToken: 'refresh-2',
          tokenType: 'Bearer',
          expiresInSeconds: 900,
          scope: 'USER',
        }),
      ),
      http.get(url('/users/me'), ({ request: req }) =>
        HttpResponse.json({ auth: req.headers.get('authorization') }),
      ),
    )
    await expect(request('/users/me')).resolves.toEqual({ auth: 'Bearer fresh' })
  })

  it('clears the session and notifies when the refresh token is rejected', async () => {
    tokenStore.set({ accessToken: 'old', refreshToken: 'dead' })
    const expired = vi.fn()
    const unsubscribe = onSessionEvent(expired)
    server.use(
      http.get(url('/orgs'), () =>
        HttpResponse.json({ code: 'TOKEN_EXPIRED', message: 'expired' }, { status: 401 }),
      ),
      http.post(url('/auth/refresh'), () =>
        HttpResponse.json({ code: 'INVALID_REFRESH_TOKEN', message: 'nope' }, { status: 401 }),
      ),
    )
    await expect(request('/orgs')).rejects.toMatchObject({ code: 'TOKEN_EXPIRED' })
    expect(tokenStore.hasSession()).toBe(false)
    expect(tokenStore.getAccessToken()).toBeNull()
    expect(expired).toHaveBeenCalledWith('expired')
    unsubscribe()
  })

  it('signs out immediately on ACCOUNT_UNAVAILABLE without trying to refresh', async () => {
    tokenStore.set({ accessToken: 'a', refreshToken: 'r' })
    const refresh = vi.fn()
    server.use(
      http.get(url('/orgs'), () =>
        HttpResponse.json({ code: 'ACCOUNT_UNAVAILABLE', message: 'disabled' }, { status: 401 }),
      ),
      http.post(url('/auth/refresh'), () => {
        refresh()
        return HttpResponse.json({}, { status: 500 })
      }),
    )
    await expect(request('/orgs')).rejects.toMatchObject({ code: 'ACCOUNT_UNAVAILABLE' })
    expect(refresh).not.toHaveBeenCalled()
    expect(tokenStore.hasSession()).toBe(false)
  })

  it('turns a failed fetch into a NetworkError', async () => {
    server.use(http.get(url('/orgs'), () => HttpResponse.error()))
    await expect(request('/orgs', { auth: false })).rejects.toBeInstanceOf(NetworkError)
  })
})
