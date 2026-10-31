import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { authApi } from '@/api/auth'
import { expireSession, onSessionEvent } from '@/api/client'
import { isApiError } from '@/api/errors'
import type { AuthTokens, User } from '@/api/types'
import { userKeys, usersApi } from '@/api/users'
import { tokenStore } from './tokenStore'

export type SessionStatus = 'loading' | 'anonymous' | 'authenticated'

export interface Session {
  status: SessionStatus
  /** The signed-in user; `null` while loading or when anonymous. */
  me: User | null
  /** Why the user is anonymous, when the console signed them out. */
  reason: 'expired' | 'signed-out' | null
  signIn: (tokens: AuthTokens) => Promise<User>
  /** `revoked`: the server already ended the session (a deleted account), so no `/auth/logout`. */
  signOut: (options?: { revoked?: boolean }) => Promise<void>
  refresh: () => Promise<void>
}

const SessionContext = createContext<Session | null>(null)

export function SessionProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [hasSession, setHasSession] = useState(() => tokenStore.hasSession())
  const [reason, setReason] = useState<Session['reason']>(null)

  useEffect(() => tokenStore.subscribe(() => setHasSession(tokenStore.hasSession())), [])
  useEffect(
    () =>
      onSessionEvent(() => {
        setReason('expired')
        queryClient.clear()
      }),
    [queryClient],
  )

  const meQuery = useQuery({
    queryKey: userKeys.me(),
    queryFn: ({ signal }) => usersApi.me(signal),
    enabled: hasSession,
    staleTime: 5 * 60_000,
    retry: false,
  })

  // A failed `me` with a live refresh token (e.g. 500) must not look like a sign-out; a 401 does.
  useEffect(() => {
    if (meQuery.error && isApiError(meQuery.error) && meQuery.error.status === 401) {
      expireSession()
    }
  }, [meQuery.error])

  const signIn = useCallback(
    async (tokens: AuthTokens) => {
      tokenStore.set({ accessToken: tokens.accessToken, refreshToken: tokens.refreshToken })
      setReason(null)
      const me = await queryClient.fetchQuery({
        queryKey: userKeys.me(),
        queryFn: ({ signal }) => usersApi.me(signal),
      })
      return me
    },
    [queryClient],
  )

  const signOut = useCallback(async ({ revoked = false }: { revoked?: boolean } = {}) => {
    const refreshToken = revoked ? null : tokenStore.getRefreshToken()
    tokenStore.clear()
    setReason('signed-out')
    queryClient.clear()
    if (refreshToken) {
      try {
        await authApi.logout(refreshToken)
      } catch {
        // The token is gone locally either way; the server copy expires on its own.
      }
    }
  }, [queryClient])

  const refresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: userKeys.me() })
  }, [queryClient])

  const value = useMemo<Session>(() => {
    let status: SessionStatus
    if (!hasSession) status = 'anonymous'
    else if (meQuery.data) status = 'authenticated'
    else if (meQuery.isError) status = 'anonymous'
    else status = 'loading'
    return {
      status,
      me: status === 'authenticated' ? (meQuery.data ?? null) : null,
      reason,
      signIn,
      signOut,
      refresh,
    }
  }, [hasSession, meQuery.data, meQuery.isError, reason, signIn, signOut, refresh])

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function useSession(): Session {
  const session = useContext(SessionContext)
  if (!session) throw new Error('useSession must be used inside <SessionProvider>')
  return session
}

/** The signed-in user; only valid under a `RequireAuth` route. */
export function useMe(): User {
  const { me } = useSession()
  if (!me) throw new Error('useMe used outside an authenticated route')
  return me
}
