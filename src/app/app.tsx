import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { useState } from 'react'
import { RouterProvider } from 'react-router/dom'
import { SessionProvider } from '@/auth/session'
import { Toaster } from '@/components/ui/sonner'
import { createQueryClient } from './queryClient'
import { router } from './router'
import { ThemeProvider } from './theme'

/** Opt in with `localStorage.setItem('novis-admin.devtools', '1')`; the floating button otherwise covers controls. */
function devtoolsEnabled(): boolean {
  try {
    return window.localStorage.getItem('novis-admin.devtools') === '1'
  } catch {
    return false
  }
}

export function App() {
  const [queryClient] = useState(createQueryClient)
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <SessionProvider>
          <RouterProvider router={router} />
          <Toaster />
        </SessionProvider>
      </ThemeProvider>
      {import.meta.env.DEV && devtoolsEnabled() ? (
        <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />
      ) : null}
    </QueryClientProvider>
  )
}
