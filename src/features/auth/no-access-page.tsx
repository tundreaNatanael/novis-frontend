import { useNavigate } from 'react-router'
import { useSession } from '@/auth/session'
import { Button } from '@/components/ui/button'
import { usePageTitle } from '@/lib/use-page-title'
import { AuthLayout } from './auth-layout'

/**
 * Signed in, but with no home here: neither the super-admin, nor the admin of an active
 * organization, nor a teacher with a place to work in (D-051).
 */
export function Component() {
  usePageTitle('No access')
  const { me, signOut } = useSession()
  const navigate = useNavigate()
  const staffOfArchivedOrg =
    (me?.role === 'ADMIN' || me?.role === 'TEACHER') && me.organization?.status !== 'ACTIVE'
  return (
    <AuthLayout
      title="Nothing to open yet"
      description={
        staffOfArchivedOrg ? (
          <>
            You are signed in as <span className="font-medium text-foreground">{me?.email}</span>,
            {me?.role === 'ADMIN' ? ' the administrator' : ' a teacher'} of an archived
            organization. Ask the platform owner to restore it.
          </>
        ) : (
          <>
            You are signed in as <span className="font-medium text-foreground">{me?.email}</span>,
            which has no administrator or teacher role. Students use the Novis app instead. If you
            expected access, ask the platform owner or your school's administrator.
          </>
        )
      }
    >
      <Button
        className="w-full"
        onClick={() => {
          void signOut().then(() => navigate('/login', { replace: true }))
        }}
      >
        Sign out
      </Button>
    </AuthLayout>
  )
}
