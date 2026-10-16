import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useParams } from 'react-router'
import { z } from 'zod'
import { authApi } from '@/api/auth'
import { isApiError } from '@/api/errors'
import { Field } from '@/components/form/field'
import { FormError } from '@/components/form/form-error'
import { applyServerErrors } from '@/components/form/server-errors'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { passwordConfirmation } from '@/lib/schemas'
import { usePageTitle } from '@/lib/use-page-title'
import { AuthLayout } from './auth-layout'

const schema = z
  .object({ ...passwordConfirmation.shape })
  .refine(passwordConfirmation.refine, passwordConfirmation.error)
type FormValues = z.infer<typeof schema>

export function Component() {
  usePageTitle('Choose a new password')
  const { token = '' } = useParams<{ token: string }>()
  const [formError, setFormError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { password: '', confirmPassword: '' },
  })

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError(null)
    try {
      await authApi.resetPassword({ token, password: values.password })
      setDone(true)
    } catch (error) {
      if (isApiError(error) && error.status === 400 && error.fieldErrors.length === 0) {
        setFormError(
          'This reset link is invalid, already used or older than one hour. Request a new one.',
        )
        return
      }
      setFormError(applyServerErrors(error, form.setError, ['password']))
    }
  })

  return (
    <AuthLayout
      title="Choose a new password"
      footer={
        <Link to="/login" className="font-medium text-primary underline-offset-4 hover:underline">
          {done ? 'Sign in' : 'Back to sign in'}
        </Link>
      }
    >
      {done ? (
        <Alert>
          <AlertTitle>Password updated</AlertTitle>
          <AlertDescription>
            Other sessions were signed out. Sign in with your new password.
          </AlertDescription>
        </Alert>
      ) : (
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          <FormError message={formError} />
          <Field
            label="New password"
            required
            hint="8 to 128 characters."
            error={form.formState.errors.password?.message}
          >
            {(a11y) => (
              <Input
                {...a11y}
                type="password"
                autoComplete="new-password"
                autoFocus
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
            Set password
          </Button>
        </form>
      )}
    </AuthLayout>
  )
}
