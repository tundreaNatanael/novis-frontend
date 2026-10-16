import { QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw/http'
import { createMemoryRouter } from 'react-router'
import { RouterProvider } from 'react-router/dom'
import { API_BASE_URL } from '@/api/client'
import type { User } from '@/api/types'
import { createQueryClient } from '@/app/queryClient'
import { routes } from '@/app/router'
import { ThemeProvider } from '@/app/theme'
import { SessionProvider } from '@/auth/session'
import { tokenStore } from '@/auth/tokenStore'
import { Toaster } from '@/components/ui/sonner'
import { server } from './server'

export const api = (path: string) => `${API_BASE_URL}${path}`

/** Puts tokens in the store and answers `GET /users/me` with the given user. */
export function signedInAs(me: User) {
  tokenStore.set({ accessToken: 'test-access', refreshToken: 'test-refresh' })
  server.use(http.get(api('/users/me'), () => HttpResponse.json(me)))
}

/** Mounts the real route tree at a path with the real providers (query client, theme, session). */
export function renderApp(initialPath: string) {
  const queryClient = createQueryClient()
  const router = createMemoryRouter(routes, { initialEntries: [initialPath] })
  const user = userEvent.setup()
  const utils = render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <SessionProvider>
          <RouterProvider router={router} />
          <Toaster />
        </SessionProvider>
      </ThemeProvider>
    </QueryClientProvider>,
  )
  return { ...utils, router, queryClient, user }
}

/** An `ApiError` body as the backend sends it. */
export function apiError(
  status: number,
  code: string,
  message: string,
  fieldErrors: { field: string; message: string }[] = [],
) {
  return HttpResponse.json(
    { timestamp: new Date().toISOString(), status, code, message, fieldErrors },
    { status },
  )
}
