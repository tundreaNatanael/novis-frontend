import { zodResolver } from '@hookform/resolvers/zod'
import { AlertTriangle, Loader2, Trash2, Users } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { z } from 'zod'
import { useMe, useSession } from '@/auth/session'
import { Field } from '@/components/form/field'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { TeachConfirmDialog } from '../components/confirm-dialog'
import { TeachSheet } from '../components/teach-sheet'
import { useDeleteAccount } from '../data/mutations'
import { useRosterCount } from '../data/roster'
import { useT } from '../i18n/use-i18n'
import { teachCapabilities } from '../lib/capabilities'
import { fieldErrorOf, isApiStatus } from '../lib/error-message'

/**
 * Delete account (`DELETE /users/me { password }`, D-060): what goes and what stays for this teacher,
 * their password, a last confirmation; then the session is cleared without `/auth/logout` (the server
 * already ended it) and the app goes to sign-in. A freelance teacher removes their students first: the
 * server answers `409` until then, so the sheet says how many are left and offers no button that would fail.
 */
export function DeleteAccountSheet({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = useT()
  const me = useMe()
  const navigate = useNavigate()
  const { signOut } = useSession()
  const remove = useDeleteAccount()
  const { place } = teachCapabilities(me)
  const freelance = place.kind === 'freelance'
  const school = place.kind === 'org' ? place.organization.name : null
  const rosterCount = useRosterCount(freelance)
  const studentsLeft = freelance ? (rosterCount.data ?? 0) : 0
  // Until the count is in, a freelance teacher cannot tell whether the delete would go through.
  const blocked = studentsLeft > 0 || (freelance && rosterCount.isPending)
  const [confirming, setConfirming] = useState(false)

  const schema = useMemo(
    () => z.object({ password: z.string().min(1, t('validation.required')) }),
    [t],
  )
  type FormValues = z.infer<typeof schema>
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { password: '' },
  })
  const submit = form.handleSubmit(() => setConfirming(true))

  const deleteAccount = async () => {
    try {
      await remove.mutateAsync(form.getValues('password'))
    } catch (error) {
      if (freelance && isApiStatus(error, 409)) void rosterCount.refetch()
      if (fieldErrorOf(error, 'password')) {
        // The server words a wrong password in English: the field gets the workspace's own copy.
        setConfirming(false)
        form.setError('password', { type: 'server', message: t('teacher.deleteAccount.wrongPassword') })
        return
      }
      throw error
    }
    toast.success(t('teacher.deleteAccount.deleted'))
    onOpenChange(false)
    await signOut({ revoked: true })
    navigate('/login', { replace: true })
  }

  return (
    <TeachSheet
      open={open}
      onOpenChange={onOpenChange}
      title={t('teacher.deleteAccount.title')}
      onSubmit={() => void submit()}
      footer={
        <Button
          type="submit"
          variant="destructive"
          size="lg"
          className="w-full rounded-full sm:w-auto"
          disabled={blocked || remove.isPending}
        >
          {remove.isPending ? (
            <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden />
          ) : (
            <Trash2 aria-hidden />
          )}
          {t('teacher.deleteAccount.submit')}
        </Button>
      }
    >
      <p className="text-sm text-foreground">
        {school
          ? t('teacher.deleteAccount.schoolBody', { school })
          : t('teacher.deleteAccount.freelanceBody')}
      </p>
      {studentsLeft > 0 ? (
        <div className="flex flex-col gap-3 rounded-xl bg-warning-soft p-4 text-sm text-foreground">
          <p className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
            <span>{t('teacher.deleteAccount.studentsLeft', { count: studentsLeft })}</span>
          </p>
          <Button
            type="button"
            variant="outline"
            className="self-start rounded-full"
            onClick={() => {
              onOpenChange(false)
              navigate('/teach/students')
            }}
          >
            <Users aria-hidden />
            {t('teacher.deleteAccount.goToStudents')}
          </Button>
        </div>
      ) : null}
      {blocked ? null : (
        <Field
          label={t('teacher.deleteAccount.password')}
          hint={t('teacher.deleteAccount.passwordHint')}
          required
          error={form.formState.errors.password?.message}
        >
          {(a11y) => (
            <Input
              {...a11y}
              type="password"
              autoComplete="current-password"
              autoFocus
              {...form.register('password')}
            />
          )}
        </Field>
      )}
      <TeachConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={t('teacher.deleteAccount.confirmTitle')}
        body={t('teacher.deleteAccount.confirmBody')}
        confirmLabel={t('teacher.deleteAccount.submit')}
        destructive
        onConfirm={deleteAccount}
      />
    </TeachSheet>
  )
}
