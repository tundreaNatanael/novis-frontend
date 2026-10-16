import { useNavigate } from 'react-router'
import { useSession } from '@/auth/session'
import { Button } from '@/components/ui/button'
import { usePageTitle } from '@/lib/use-page-title'
import { AuthLayout } from './auth-layout'

/** Signed in, but neither super-admin nor an organization admin. */
export function Component() {
  usePageTitle('No access')
  const { me, signOut } = useSession()
  const navigate = useNavigate()
  return (
    <AuthLayout
      title="This console is for administrators"
      description={
        <>
          You are signed in as <span className="font-medium text-foreground">{me?.email}</span>,
          which has no administrator role. Teachers and students use the Novis app instead. If you
          expected access, ask the platform owner or your school's administrator.
        </>
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
