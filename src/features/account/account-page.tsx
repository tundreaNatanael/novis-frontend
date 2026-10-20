import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { z } from 'zod'
import { usersApi } from '@/api/users'
import { useMe, useSession } from '@/auth/session'
import { Field } from '@/components/form/field'
import { FormError } from '@/components/form/form-error'
import { applyServerErrors } from '@/components/form/server-errors'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { enumLabel, formatDateTime } from '@/lib/format'
import { emailSchema, nameSchema, passwordConfirmation } from '@/lib/schemas'
import { usePageTitle } from '@/lib/use-page-title'
import type { RouteHandle } from '@/app/route-handle'

export const handle: RouteHandle = { crumb: () => 'Account', title: 'Account' }

const profileSchema = z.object({ name: nameSchema, email: emailSchema })
type ProfileValues = z.infer<typeof profileSchema>
const passwordFormSchema = z
  .object({ ...passwordConfirmation.shape })
  .refine(passwordConfirmation.refine, passwordConfirmation.error)
type PasswordValues = z.infer<typeof passwordFormSchema>

export function Component() {
  usePageTitle('Account')
  const me = useMe()
  const { refresh, signOut } = useSession()
  const navigate = useNavigate()
  const [profileError, setProfileError] = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)

  const profileForm = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: me.name, email: me.email },
  })
  const passwordForm = useForm<PasswordValues>({
    resolver: zodResolver(passwordFormSchema),
    defaultValues: { password: '', confirmPassword: '' },
  })

  const saveProfile = useMutation({
    mutationFn: (values: ProfileValues) => usersApi.update(me.id, values),
    onSuccess: async (user) => {
      await refresh()
      profileForm.reset({ name: user.name, email: user.email })
      toast.success('Account updated')
    },
    onError: (error) =>
      setProfileError(applyServerErrors(error, profileForm.setError, ['name', 'email'])),
  })

  const changePassword = useMutation({
    mutationFn: (values: PasswordValues) => usersApi.update(me.id, { password: values.password }),
    onSuccess: async () => {
      toast.success('Password changed. Sign in again with the new password.')
      await signOut()
      navigate('/login', { replace: true })
    },
    onError: (error) =>
      setPasswordError(applyServerErrors(error, passwordForm.setError, ['password'])),
  })

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <PageHeader
        title="Account"
        description="Your own profile. Your role is granted by the platform owner or your organization and cannot be changed here."
      />
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>
            {me.role ? enumLabel(me.role) : 'No role'} · member since {formatDateTime(me.createdAt)}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={profileForm.handleSubmit((values) => {
              setProfileError(null)
              saveProfile.mutate(values)
            })}
            noValidate
            className="flex flex-col gap-4"
          >
            <FormError message={profileError} />
            <Field label="Name" required error={profileForm.formState.errors.name?.message}>
              {(a11y) => <Input {...a11y} autoComplete="name" {...profileForm.register('name')} />}
            </Field>
            <Field
              label="Email"
              required
              hint="Changing it changes how you sign in."
              error={profileForm.formState.errors.email?.message}
            >
              {(a11y) => (
                <Input
                  {...a11y}
                  type="email"
                  autoComplete="username"
                  {...profileForm.register('email')}
                />
              )}
            </Field>
            <div>
              <Button
                type="submit"
                disabled={saveProfile.isPending || !profileForm.formState.isDirty}
              >
                {saveProfile.isPending ? (
                  <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden />
                ) : null}
                Save changes
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Password</CardTitle>
          <CardDescription>
            Changing your password signs out every session, including this one.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={passwordForm.handleSubmit((values) => {
              setPasswordError(null)
              changePassword.mutate(values)
            })}
            noValidate
            className="flex flex-col gap-4"
          >
            <FormError message={passwordError} />
            <Field
              label="New password"
              required
              hint="8 to 128 characters."
              error={passwordForm.formState.errors.password?.message}
            >
              {(a11y) => (
                <Input
                  {...a11y}
                  type="password"
                  autoComplete="new-password"
                  {...passwordForm.register('password')}
                />
              )}
            </Field>
            <Field
              label="Repeat the password"
              required
              error={passwordForm.formState.errors.confirmPassword?.message}
            >
              {(a11y) => (
                <Input
                  {...a11y}
                  type="password"
                  autoComplete="new-password"
                  {...passwordForm.register('confirmPassword')}
                />
              )}
            </Field>
            <div>
              <Button type="submit" variant="outline" disabled={changePassword.isPending}>
                {changePassword.isPending ? (
                  <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden />
                ) : null}
                Change password
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Role</CardTitle>
          <CardDescription>Each account holds one role in one place.</CardDescription>
        </CardHeader>
        <CardContent>
          {me.organization ? (
            <p className="flex items-center justify-between gap-3 text-sm">
              <span className="truncate">
                {me.organization.name}
                {me.organization.status === 'ARCHIVED' ? (
                  <span className="ml-2 text-xs text-muted-foreground">(archived)</span>
                ) : null}
              </span>
              <span className="text-muted-foreground">{enumLabel(me.role)}</span>
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              {me.role === 'SUPER_ADMIN'
                ? 'Platform owner: the whole platform, no organization.'
                : 'No organization.'}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
