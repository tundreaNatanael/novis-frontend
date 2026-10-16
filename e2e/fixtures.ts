import { readFileSync } from 'node:fs'
import { test as base } from '@playwright/test'

/** The API the dev server talks to: `VITE_API_BASE_URL` from the environment or `.env`. */
export function apiBaseUrl(): string {
  if (process.env.VITE_API_BASE_URL) return process.env.VITE_API_BASE_URL
  try {
    const env = readFileSync(new URL('../.env', import.meta.url), 'utf8')
    const line = env.split('\n').find((l) => l.startsWith('VITE_API_BASE_URL='))
    if (line)
      return line
        .slice('VITE_API_BASE_URL='.length)
        .trim()
        .replace(/^["']|["']$/g, '')
  } catch {
    // no .env: fall through to the default
  }
  return 'http://localhost:8080'
}

/** The dev super-admin from the backend README; override with E2E_EMAIL / E2E_PASSWORD. */
export const credentials = {
  email: process.env.E2E_EMAIL ?? 'admin@novis.local',
  password: process.env.E2E_PASSWORD ?? 'ChangeMe123!',
}

export interface Tokens {
  accessToken: string
  refreshToken: string
}

export async function api<T>(
  tokens: Tokens | null,
  method: string,
  path: string,
  body?: unknown,
): Promise<{ status: number; data: T }> {
  const res = await fetch(`${apiBaseUrl()}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(tokens ? { Authorization: `Bearer ${tokens.accessToken}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await res.text()
  return { status: res.status, data: (text ? JSON.parse(text) : null) as T }
}

/**
 * Signs in once per worker through the API and seeds the console's token stores before each
 * page load (access token per tab in sessionStorage, refresh token in localStorage), so no test
 * spends a login attempt (throttled 5/min per email) and no page load refreshes.
 */
export const test = base.extend<{ signedIn: void }, { tokens: Tokens }>({
  tokens: [
    // eslint-disable-next-line no-empty-pattern -- Playwright reads the fixture's dependencies from this pattern
    async ({}, use) => {
      const { status, data } = await api<Tokens>(null, 'POST', '/auth/login', credentials)
      if (status !== 200) {
        throw new Error(
          `Could not sign in to ${apiBaseUrl()} as ${credentials.email} (HTTP ${status}). Is the backend running with the dev seed?`,
        )
      }
      await use(data)
    },
    { scope: 'worker' },
  ],
  signedIn: [
    async ({ page, tokens }, use) => {
      await page.addInitScript(
        ([access, refresh]) => {
          if (!window.sessionStorage.getItem('novis-admin.accessToken')) {
            window.sessionStorage.setItem('novis-admin.accessToken', access)
          }
          if (!window.localStorage.getItem('novis-admin.refreshToken')) {
            window.localStorage.setItem('novis-admin.refreshToken', refresh)
          }
        },
        [tokens.accessToken, tokens.refreshToken] as const,
      )
      await use()
      // A refresh rotates the token: keep the newest one for the next test of this worker.
      const latest = await page
        .evaluate(() => window.localStorage.getItem('novis-admin.refreshToken'))
        .catch(() => null)
      if (latest) tokens.refreshToken = latest
    },
    { auto: true },
  ],
})

export { expect } from '@playwright/test'
