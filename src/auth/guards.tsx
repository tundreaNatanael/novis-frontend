import { Navigate, Outlet, useLocation, useParams, useSearchParams } from 'react-router'
import { deriveCapabilities, hasAppAccess, homeFor, isTeacher } from '@/lib/permissions'
import { FullPageSpinner } from '@/components/full-page-spinner'
import { useSession } from './session'

/** Signed in, with a home in this app; otherwise `/login?next=…` or `/no-access`. UX only — the server decides. */
export function RequireAuth() {
  const { status, me } = useSession()
  const location = useLocation()
  if (status === 'loading') return <FullPageSpinner label="Signing you in" />
  if (status === 'anonymous') {
    const next = `${location.pathname}${location.search}`
    return <Navigate to={`/login?next=${encodeURIComponent(next)}`} replace />
  }
  if (!hasAppAccess(me) && location.pathname !== '/no-access') {
    return <Navigate to="/no-access" replace />
  }
  return <Outlet />
}

/** Platform routes: super-admins only. Everyone else is sent to their own home. */
export function RequireSuperAdmin() {
  const { me } = useSession()
  const capabilities = deriveCapabilities(me)
  if (!capabilities.isSuperAdmin) return <Navigate to={homeFor(me)} replace />
  return <Outlet />
}

/** `/org/:orgId/*`: an ADMIN membership in that organization (the super-admin uses `/platform`). */
export function RequireOrgAdmin() {
  const { me } = useSession()
  const { orgId } = useParams<{ orgId: string }>()
  const capabilities = deriveCapabilities(me, orgId)
  if (!orgId || !capabilities.isOrgAdmin) return <Navigate to={homeFor(me)} replace />
  return <Outlet />
}

/** `/teach/*`: a TEACHER of an active organization or a freelance teacher (D-051). */
export function RequireTeacher() {
  const { me } = useSession()
  if (!isTeacher(me)) return <Navigate to={homeFor(me)} replace />
  return <Outlet />
}

/** A same-origin path from `?next=`; anything else (absolute URLs, `//host`) is ignored. */
export function safeNext(value: string | null): string | null {
  return value && value.startsWith('/') && !value.startsWith('//') ? value : null
}

/** Public auth pages bounce signed-in users to `?next=` (when safe) or home. */
export function RedirectIfAuthenticated() {
  const { status, me } = useSession()
  const [searchParams] = useSearchParams()
  if (status === 'loading') return <FullPageSpinner label="Loading" />
  if (status === 'authenticated') {
    return <Navigate to={safeNext(searchParams.get('next')) ?? homeFor(me)} replace />
  }
  return <Outlet />
}

/** `/` → the user's home. */
export function HomeRedirect() {
  const { me } = useSession()
  return <Navigate to={homeFor(me)} replace />
}
