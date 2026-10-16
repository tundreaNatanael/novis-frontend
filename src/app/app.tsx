import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { useState } from 'react'
import { RouterProvider } from 'react-router/dom'
import { SessionProvider } from '@/auth/session'
import { Toaster } from '@/components/ui/sonner'
import { createQueryClient } from './queryClient'
import { router } from './router'
import { ThemeProvider } from './theme'

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
      {import.meta.env.DEV ? (
        <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-right" />
      ) : null}
    </QueryClientProvider>
  )
}
