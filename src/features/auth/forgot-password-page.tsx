import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router'
import { z } from 'zod'
import { authApi } from '@/api/auth'
import { Field } from '@/components/form/field'
import { FormError } from '@/components/form/form-error'
import { applyServerErrors } from '@/components/form/server-errors'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { emailSchema } from '@/lib/schemas'
import { usePageTitle } from '@/lib/use-page-title'
import { AuthLayout } from './auth-layout'

const schema = z.object({ email: emailSchema })
type FormValues = z.infer<typeof schema>

export function Component() {
  usePageTitle('Reset your password')
  const [formError, setFormError] = useState<string | null>(null)
  const [sentTo, setSentTo] = useState<string | null>(null)
  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { email: '' } })

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError(null)
    try {
      await authApi.forgotPassword(values)
      setSentTo(values.email)
    } catch (error) {
      setFormError(applyServerErrors(error, form.setError, ['email']))
    }
  })

  return (
    <AuthLayout
      title="Reset your password"
      description="Enter your email. If an administrator account exists for it, you will receive a link to choose a new password. The link works for one hour."
      footer={
        <Link to="/login" className="font-medium text-primary underline-offset-4 hover:underline">
          Back to sign in
        </Link>
      }
    >
      {sentTo ? (
        <Alert>
          <AlertTitle>Check your inbox</AlertTitle>
          <AlertDescription>
            If an account exists for {sentTo}, a reset link is on its way. In development the API
            logs the link instead of sending it.
          </AlertDescription>
        </Alert>
      ) : (
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
          <Button type="submit" className="mt-2 w-full" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? (
              <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden />
            ) : null}
            Send reset link
          </Button>
        </form>
      )}
    </AuthLayout>
  )
}
