import { afterEach, describe, expect, it, vi } from 'vitest'
import { tokenStore } from './tokenStore'

afterEach(() => tokenStore.clear())

describe('tokenStore', () => {
  it('keeps the access token in memory and the refresh token in localStorage', () => {
    tokenStore.set({ accessToken: 'a', refreshToken: 'r' })
    expect(tokenStore.getAccessToken()).toBe('a')
    expect(window.localStorage.getItem('novis-admin.refreshToken')).toBe('r')
    expect(tokenStore.hasSession()).toBe(true)
  })

  it('clears both and notifies subscribers', () => {
    const listener = vi.fn()
    const unsubscribe = tokenStore.subscribe(listener)
    tokenStore.set({ accessToken: 'a', refreshToken: 'r' })
    tokenStore.clear()
    expect(tokenStore.getAccessToken()).toBeNull()
    expect(tokenStore.getRefreshToken()).toBeNull()
    expect(tokenStore.hasSession()).toBe(false)
    expect(listener).toHaveBeenCalledTimes(2)
    unsubscribe()
    tokenStore.set({ accessToken: 'b', refreshToken: 's' })
    expect(listener).toHaveBeenCalledTimes(2)
  })
})
