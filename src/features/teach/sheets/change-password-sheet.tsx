import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, Lock } from 'lucide-react'
import { useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { z } from 'zod'
import { useSession } from '@/auth/session'
import { Field } from '@/components/form/field'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { TeachSheet } from '../components/teach-sheet'
import { useChangePassword } from '../data/mutations'
import { useT } from '../i18n/use-i18n'
import { describeError } from '../lib/error-message'
import { applyFieldErrors } from '../lib/form'
import { makeSchemas } from '../lib/schemas'

/** `PATCH /users/{me} { password }`: the server ends every session, this one included, so it signs out. */
export function ChangePasswordSheet({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = useT()
  const navigate = useNavigate()
  const { signOut } = useSession()
  const change = useChangePassword()
  const schema = useMemo(() => {
    const s = makeSchemas(t)
    return z
      .object({ password: s.password, confirm: z.string() })
      .refine((v) => v.password === v.confirm, {
        path: ['confirm'],
        message: t('validation.passwordMismatch'),
      })
  }, [t])
  type FormValues = z.infer<typeof schema>
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { password: '', confirm: '' },
  })

  const submit = form.handleSubmit(async ({ password }) => {
    try {
      await change.mutateAsync(password)
      toast.success(t('teacher.changePassword.done'))
      onOpenChange(false)
      await signOut()
      navigate('/login', { replace: true })
    } catch (error) {
      if (!applyFieldErrors(error, form.setError, ['password']))
        toast.error(describeError(error, t))
    }
  })

  return (
    <TeachSheet
      open={open}
      onOpenChange={onOpenChange}
      title={t('teacher.changePassword.title')}
      onSubmit={() => void submit()}
      footer={
        <Button
          type="submit"
          size="lg"
          className="w-full rounded-full sm:w-auto"
          disabled={change.isPending}
        >
          {change.isPending ? (
            <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden />
          ) : (
            <Lock aria-hidden />
          )}
          {t('teacher.changePassword.submit')}
        </Button>
      }
    >
      <Field
        label={t('teacher.changePassword.newPassword')}
        required
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
        label={t('teacher.changePassword.confirmPassword')}
        required
        error={form.formState.errors.confirm?.message}
      >
        {(a11y) => (
          <Input
            {...a11y}
            type="password"
            autoComplete="new-password"
            {...form.register('confirm')}
          />
        )}
      </Field>
    </TeachSheet>
  )
}
