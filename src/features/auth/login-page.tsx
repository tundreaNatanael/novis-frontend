import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { z } from 'zod'
import { authApi } from '@/api/auth'
import { isApiError } from '@/api/errors'
import { useSession } from '@/auth/session'
import { Field } from '@/components/form/field'
import { FormError } from '@/components/form/form-error'
import { applyServerErrors } from '@/components/form/server-errors'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { hasConsoleAccess, homeFor } from '@/lib/permissions'
import { emailSchema } from '@/lib/schemas'
import { usePageTitle } from '@/lib/use-page-title'
import { AuthLayout } from './auth-layout'

const schema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Enter your password').max(128),
})
type FormValues = z.infer<typeof schema>

export function Component() {
  usePageTitle('Sign in')
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { signIn } = useSession()
  const [formError, setFormError] = useState<string | null>(null)
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  })
  const expired = searchParams.get('reason') === 'expired'
  const next = searchParams.get('next')

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError(null)
    try {
      const tokens = await authApi.login(values)
      const me = await signIn(tokens)
      if (!hasConsoleAccess(me)) {
        navigate('/no-access', { replace: true })
        return
      }
      navigate(next && next.startsWith('/') && !next.startsWith('//') ? next : homeFor(me), {
        replace: true,
      })
    } catch (error) {
      if (isApiError(error) && error.code === 'INVALID_CREDENTIALS') {
        setFormError('The email or password is incorrect.')
        return
      }
      if (isApiError(error) && error.code === 'ACCOUNT_UNAVAILABLE') {
        setFormError('This account is disabled. Ask the platform owner to re-enable it.')
        return
      }
      setFormError(applyServerErrors(error, form.setError, ['email', 'password']))
    }
  })

  return (
    <AuthLayout
      title="Sign in"
      description="Administrators sign in with their email and password."
      footer={
        <Link
          to="/forgot-password"
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          Forgot your password?
        </Link>
      }
    >
      {expired ? (
        <Alert className="mb-4">
          <AlertDescription>Your session ended. Sign in again to continue.</AlertDescription>
        </Alert>
      ) : null}
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <FormError message={formError} />
        <Field label="Email" required error={form.formState.errors.email?.message}>
          {(a11y) => (
            <Input
              {...a11y}
              type="email"
              autoComplete="username"
              inputMode="email"
              autoFocus
              {...form.register('email')}
            />
          )}
        </Field>
        <Field label="Password" required error={form.formState.errors.password?.message}>
          {(a11y) => (
            <Input
              {...a11y}
              type="password"
              autoComplete="current-password"
              {...form.register('password')}
            />
          )}
        </Field>
        <Button type="submit" className="mt-2 w-full" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? (
            <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden />
          ) : null}
          Sign in
        </Button>
      </form>
    </AuthLayout>
  )
}
