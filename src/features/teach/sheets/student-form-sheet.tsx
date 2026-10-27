import { zodResolver } from '@hookform/resolvers/zod'
import { Check, Loader2, Phone, UserPlus } from 'lucide-react'
import { useEffect, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { isApiError } from '@/api/errors'
import { useMe } from '@/auth/session'
import { Field } from '@/components/form/field'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SwitchRow } from '../components/form-controls'
import { TeachSheet } from '../components/teach-sheet'
import { useChangeMeetingLink, useCreateStudent, useRenameStudent } from '../data/mutations'
import { useMeetingLinks, useStudent } from '../data/roster'
import { useT } from '../i18n/use-i18n'
import { describeError } from '../lib/error-message'
import { applyFieldErrors } from '../lib/form'
import { makeSchemas } from '../lib/schemas'
import { meetingLinkChange } from '../students/utils'
import { useTeachSheets } from './use-teach-sheets'

/**
 * Create (`name` + `email`) or edit a student: the name (`PATCH /students/{id}`) and how you two
 * meet (D-057, `PUT` / `DELETE /students/{id}/meeting-links/{me}`), which every lesson of the two
 * opens: a link, or a WhatsApp call on your number (D-058). Without a number the switch is off and
 * "Add WhatsApp number" opens that sheet, which comes back here. Each goes out only when it changed.
 */
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
  const me = useMe()
  const sheets = useTeachSheets()
  const editing = !!studentId
  const { student, rosterStudent } = useStudent(studentId ?? '')
  const links = useMeetingLinks(studentId ?? '', editing && open)
  const myLink = links.data?.find((link) => link.teacherId === me.id)
  const currentWhatsApp = myLink?.whatsapp ?? false
  const currentLink = currentWhatsApp
    ? null
    : (myLink?.meetingUrl ?? rosterStudent?.meetingUrl ?? null)
  const myNumber = me.whatsappNumber ?? null
  const create = useCreateStudent()
  const rename = useRenameStudent()
  const changeLink = useChangeMeetingLink()

  const schema = useMemo(() => {
    const s = makeSchemas(t)
    return z
      .object({
        name: s.name,
        email: editing ? z.string() : s.email,
        whatsapp: z.boolean(),
        meetingUrl: z.string(),
      })
      .superRefine((values, ctx) => {
        // A WhatsApp call hides the link field: what it holds is not checked then.
        if (values.whatsapp) return
        const link = s.optionalHttpsUrl.safeParse(values.meetingUrl)
        if (!link.success)
          ctx.addIssue({
            code: 'custom',
            path: ['meetingUrl'],
            message: link.error.issues[0]?.message,
          })
      })
  }, [t, editing])
  type FormValues = z.infer<typeof schema>
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', email: '', whatsapp: false, meetingUrl: '' },
  })
  const whatsapp = form.watch('whatsapp')

  useEffect(() => {
    if (editing && student && !form.formState.isDirty) {
      form.reset({
        name: student.name,
        email: student.email,
        whatsapp: currentWhatsApp,
        meetingUrl: currentLink ?? '',
      })
    }
  }, [editing, student, currentWhatsApp, currentLink, form])

  const submit = form.handleSubmit(async (values) => {
    try {
      if (editing && studentId) {
        if (values.name !== student?.name)
          await rename.mutateAsync({ id: studentId, name: values.name })
        const change = meetingLinkChange(
          { whatsapp: currentWhatsApp, meetingUrl: currentLink },
          values,
        )
        if (change.kind !== 'none') await changeLink.mutateAsync({ studentId, change })
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
      } else if (!applyFieldErrors(error, form.setError, ['name', 'email', 'meetingUrl'])) {
        toast.error(describeError(error, t))
      }
    }
  })

  const busy = create.isPending || rename.isPending || changeLink.isPending

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
        <>
          <p className="text-sm text-muted-foreground">{student?.email ?? ''}</p>
          <SwitchRow
            label={t('teacher.studentForm.whatsappCall')}
            hint={
              myNumber
                ? t('teacher.studentForm.whatsappCallHint', { number: myNumber })
                : t('teacher.studentForm.whatsappCallNeedsNumber')
            }
            checked={whatsapp}
            onCheckedChange={(checked) => form.setValue('whatsapp', checked, { shouldDirty: true })}
            // Without a number it can only be switched off (a call set before the number was removed).
            disabled={!myNumber && !whatsapp}
          />
          {!myNumber && studentId ? (
            <Button
              type="button"
              variant="outline"
              className="self-start rounded-full"
              onClick={() =>
                sheets.open({ kind: 'whatsapp', afterSave: { kind: 'student', studentId } })
              }
            >
              <Phone aria-hidden />
              {t('teacher.studentForm.addWhatsappNumber')}
            </Button>
          ) : null}
          {whatsapp ? null : (
            <Field
              label={t('teacher.studentForm.meetingLink')}
              hint={t('teacher.studentForm.meetingLinkHint')}
              error={form.formState.errors.meetingUrl?.message}
            >
              {(a11y) => (
                <Input
                  {...a11y}
                  type="url"
                  inputMode="url"
                  autoComplete="off"
                  placeholder={t('lesson.meetingLinkPlaceholder')}
                  {...form.register('meetingUrl')}
                />
              )}
            </Field>
          )}
        </>
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
