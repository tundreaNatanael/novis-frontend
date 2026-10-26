import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate, useParams } from 'react-router'
import { z } from 'zod'
import { authApi } from '@/api/auth'
import { CONFLICT_COPY, errorMessage, isApiError } from '@/api/errors'
import { useSession } from '@/auth/session'
import { Field } from '@/components/form/field'
import { FormError } from '@/components/form/form-error'
import { applyServerErrors } from '@/components/form/server-errors'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { hasAppAccess, homeFor } from '@/lib/permissions'
import { nameSchema, passwordConfirmation } from '@/lib/schemas'
import { usePageTitle } from '@/lib/use-page-title'
import { AuthLayout } from './auth-layout'

const schema = z
  .object({ name: nameSchema, ...passwordConfirmation.shape })
  .refine(passwordConfirmation.refine, passwordConfirmation.error)
type FormValues = z.infer<typeof schema>

/** `400 INVITE_PASSWORD_MISMATCH`: an existing account accepts with its current password. */
const EXISTING_ACCOUNT_PASSWORD =
  'This email already has a Novis account: enter its current password.'

export function Component() {
  usePageTitle('Accept your invitation')
  const { token = '' } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const { signIn } = useSession()
  const [formError, setFormError] = useState<string | null>(null)
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', password: '', confirmPassword: '' },
  })

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError(null)
    try {
      const tokens = await authApi.acceptInvite({
        token,
        name: values.name,
        password: values.password,
      })
      const me = await signIn(tokens)
      navigate(hasAppAccess(me) ? homeFor(me) : '/no-access', { replace: true })
    } catch (error) {
      if (isApiError(error) && error.is('INVITE_PASSWORD_MISMATCH')) {
        // An existing account accepts with its current password, not a new one.
        form.setError(
          'password',
          { type: 'server', message: EXISTING_ACCOUNT_PASSWORD },
          { shouldFocus: true },
        )
        return
      }
      setFormError(
        acceptErrorMessage(error) ?? applyServerErrors(error, form.setError, ['name', 'password']),
      )
    }
  })

  return (
    <AuthLayout
      title="Accept your invitation"
      description="Choose the name colleagues will see and a password. Your role and organization come from the invitation. If this email already has a Novis account, enter its current password instead: the account keeps its name and password."
      footer={
        <span>
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-primary underline-offset-4 hover:underline">
            Sign in
          </Link>
        </span>
      }
    >
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <FormError message={formError} />
        <Field label="Your name" required error={form.formState.errors.name?.message}>
          {(a11y) => <Input {...a11y} autoComplete="name" autoFocus {...form.register('name')} />}
        </Field>
        <Field
          label="Password"
          required
          hint="8 to 128 characters. If this email already has an account, its current password."
          error={form.formState.errors.password?.message}
        >
          {(a11y) => (
            <Input
              {...a11y}
              type="password"
              autoComplete="new-password"
              {...form.register('password')}
            />
          )}
        </Field>
        <Field
          label="Repeat the password"
          required
          error={form.formState.errors.confirmPassword?.message}
        >
          {(a11y) => (
            <Input
              {...a11y}
              type="password"
              autoComplete="new-password"
              {...form.register('confirmPassword')}
            />
          )}
        </Field>
        <Button type="submit" className="mt-2 w-full" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? (
            <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden />
          ) : null}
          Accept invitation
        </Button>
      </form>
    </AuthLayout>
  )
}

/**
 * The accept errors that are not about a form field (API.md §4, `POST /auth/accept-invite`),
 * told apart by code. The invitation stays unused when the server refuses it, so it can still be
 * revoked or re-sent.
 */
function acceptErrorMessage(error: unknown): string | null {
  if (!isApiError(error)) return null
  if (error.is('ROLE_CONFLICT')) {
    return `${CONFLICT_COPY.ROLE_CONFLICT} This invitation cannot be accepted with it; ask whoever invited you to use another email.`
  }
  if (error.is('INVITE_ACCOUNT_DISABLED')) {
    return 'This account is disabled, so the invitation cannot be accepted. Ask the platform owner.'
  }
  if (error.is('INVITE_ORGANIZATION_INACTIVE')) {
    return 'The organization of this invitation is no longer active. Ask the platform owner.'
  }
  if (error.isConflict) return errorMessage(error)
  if (error.status !== 400 || error.fieldErrors.length > 0) return null
  return 'This invitation is invalid, already used or expired (invitations last 7 days). Ask for a new one.'
}
