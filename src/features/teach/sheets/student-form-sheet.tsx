import { zodResolver } from '@hookform/resolvers/zod'
import { Check, Loader2, UserPlus } from 'lucide-react'
import { useEffect, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { isApiError } from '@/api/errors'
import { Field } from '@/components/form/field'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { TeachSheet } from '../components/teach-sheet'
import { useCreateStudent, useRenameStudent } from '../data/mutations'
import { useStudent } from '../data/roster'
import { useT } from '../i18n/use-i18n'
import { describeError } from '../lib/error-message'
import { applyFieldErrors } from '../lib/form'
import { makeSchemas } from '../lib/schemas'

/** Create (`name` + `email`) or rename (`name`) a student. */
export function StudentFormSheet({
  studentId,
  open,
  onOpenChange,
}: {
  studentId?: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = useT()
  const editing = !!studentId
  const { student } = useStudent(studentId ?? '')
  const create = useCreateStudent()
  const rename = useRenameStudent()

  const schema = useMemo(() => {
    const s = makeSchemas(t)
    return z.object({ name: s.name, email: editing ? z.string() : s.email })
  }, [t, editing])
  type FormValues = z.infer<typeof schema>
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', email: '' },
  })

  useEffect(() => {
    if (editing && student && !form.formState.isDirty) {
      form.reset({ name: student.name, email: student.email })
    }
  }, [editing, student, form])

  const submit = form.handleSubmit(async (values) => {
    try {
      if (editing && studentId) {
        await rename.mutateAsync({ id: studentId, name: values.name })
        toast.success(t('teacher.studentForm.saved'))
      } else {
        // The server adds the student to the teacher's own place (school or freelance roster). Siblings
        // share one email: a new name on a known email is a new profile, the same name the same child.
        const created = await create.mutateAsync({ name: values.name, email: values.email })
        toast.success(
          created.profileCreated
            ? t('teacher.studentForm.profileCreated', { name: created.name })
            : t('teacher.studentForm.added'),
        )
      }
      onOpenChange(false)
    } catch (error) {
      if (!editing && isApiError(error) && error.is('ROLE_CONFLICT')) {
        form.setError('email', { type: 'server', message: t('teacher.studentForm.roleConflict') })
      } else if (!editing && isApiError(error) && error.is('INVITE_PENDING')) {
        form.setError('email', { type: 'server', message: t('teacher.studentForm.invitePending') })
      } else if (!applyFieldErrors(error, form.setError, ['name', 'email'])) {
        toast.error(describeError(error, t))
      }
    }
  })

  const busy = create.isPending || rename.isPending

  return (
    <TeachSheet
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? t('teacher.studentForm.editTitle') : t('teacher.studentForm.addTitle')}
      onSubmit={() => void submit()}
      footer={
        <Button type="submit" size="lg" className="w-full rounded-full sm:w-auto" disabled={busy}>
          {busy ? (
            <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden />
          ) : editing ? (
            <Check aria-hidden />
          ) : (
            <UserPlus aria-hidden />
          )}
          {editing ? t('teacher.studentForm.submitEdit') : t('teacher.studentForm.submitAdd')}
        </Button>
      }
    >
      <Field
        label={t('teacher.studentForm.name')}
        required
        error={form.formState.errors.name?.message}
      >
        {(a11y) => (
          <Input
            {...a11y}
            autoFocus
            autoComplete="name"
            placeholder={t('teacher.studentForm.namePlaceholder')}
            {...form.register('name')}
          />
        )}
      </Field>
      {editing ? (
        <p className="text-sm text-muted-foreground">{student?.email ?? ''}</p>
      ) : (
        <Field
          label={t('teacher.studentForm.email')}
          required
          hint={t('teacher.studentForm.emailHint')}
          error={form.formState.errors.email?.message}
        >
          {(a11y) => (
            <Input
              {...a11y}
              type="email"
              inputMode="email"
              autoComplete="off"
              placeholder={t('teacher.studentForm.emailPlaceholder')}
              {...form.register('email')}
            />
          )}
        </Field>
      )}
    </TeachSheet>
  )
}
