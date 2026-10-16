import { toast } from 'sonner'
import { authApi } from '@/api/auth'
import { ConfirmDialog } from '@/components/confirm-dialog'

/** `POST /auth/forgot-password` for someone else: the server answers generically, by design. */
export function ResetLinkDialog({
  email,
  open,
  onOpenChange,
}: {
  email: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Send a password reset link"
      confirmLabel="Send reset link"
      description={
        <>
          <p>
            Emails <strong>{email}</strong> a link to choose a new password. The link works for one
            hour and once.
          </p>
          <p>In development the API logs the link instead of sending it.</p>
        </>
      }
      onConfirm={async () => {
        await authApi.forgotPassword({ email })
        toast.success('Reset link sent', {
          description: `If ${email} is an active account, the email is on its way.`,
        })
      }}
    />
  )
}
