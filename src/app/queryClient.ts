import { QueryClient } from '@tanstack/react-query'
import { isApiError } from '@/api/errors'

/** Client errors are final: a 400 / 401 / 403 / 404 / 409 will not change on retry. */
function shouldRetry(failureCount: number, error: unknown): boolean {
  if (isApiError(error) && error.status < 500) return false
  return failureCount < 2
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: shouldRetry,
        staleTime: 30_000,
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: false,
      },
    },
  })
}
