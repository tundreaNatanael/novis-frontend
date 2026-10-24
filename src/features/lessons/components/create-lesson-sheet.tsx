import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { isApiError } from '@/api/errors'
import { lessonKeys, lessonsApi } from '@/api/lessons'
import { studentKeys } from '@/api/students'
import { useMe } from '@/auth/session'
import { Field } from '@/components/form/field'
import { FormError } from '@/components/form/form-error'
import { FormSheet } from '@/components/form/form-sheet'
import { SelectField } from '@/components/form/select-field'
import { applyServerErrors } from '@/components/form/server-errors'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { fromDateTimeLocal } from '@/lib/format'
import { deriveCapabilities } from '@/lib/permissions'
import { optionalHttpsUrl } from '@/lib/schemas'
import { FREELANCE, useLessonFilterOptions } from '../hooks/use-lesson-filter-options'
import type { FixedScope } from './lesson-filters'

const schema = z.object({
  org: z.string(),
  teacherId: z.string().min(1, 'Choose a teacher'),
  studentId: z.string().min(1, 'Choose a student'),
  courseId: z.string(),
  scheduledAt: z.string(),
  meetingUrl: optionalHttpsUrl,
  usePrepaid: z.boolean(),
})
type FormValues = z.infer<typeof schema>

interface CreateLessonSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  fixed: FixedScope
  preset?: { studentId?: string; courseId?: string }
  onCreated: (lessonId: string) => void
}

/**
 * `POST /lessons`: teacher → that teacher's student → optional course, date and meeting link.
 * `usePrepaid` (default on) spends one of the student's prepaid lessons when a dated lesson
 * matches; only a payment manager may turn it off, so only they see the box.
 */
export function CreateLessonSheet({
  open,
  onOpenChange,
  fixed,
  preset,
  onCreated,
}: CreateLessonSheetProps) {
  const queryClient = useQueryClient()
  const { canManageStudentPayments } = deriveCapabilities(useMe(), fixed.organizationId)
  const [formError, setFormError] = useState<string | null>(null)
  const defaults = (): FormValues => ({
    org: fixed.organizationId ?? (fixed.teacherId ? FREELANCE : ''),
    teacherId: fixed.teacherId ?? '',
    studentId: preset?.studentId ?? '',
    courseId: preset?.courseId ?? '',
    scheduledAt: '',
    meetingUrl: '',
    usePrepaid: true,
  })
  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: defaults() })
  const org = form.watch('org')
  const teacherId = form.watch('teacherId')
  const options = useLessonFilterOptions({
    org: fixed.teacherId ? undefined : org || undefined,
    teacherId: teacherId || undefined,
    enabled: open,
  })

  useEffect(() => {
    if (open) {
      form.reset(defaults())
      setFormError(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when the sheet opens
  }, [open, fixed.organizationId, fixed.teacherId, preset?.studentId, preset?.courseId])

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      lessonsApi.create({
        studentId: values.studentId,
        teacherId: values.teacherId,
        ...(values.courseId ? { courseId: values.courseId } : {}),
        ...(values.scheduledAt
          ? { scheduledAt: fromDateTimeLocal(values.scheduledAt) ?? undefined }
          : {}),
        ...(values.meetingUrl ? { meetingUrl: values.meetingUrl } : {}),
        ...(canManageStudentPayments ? { usePrepaid: values.usePrepaid } : {}),
      }),
    onSuccess: async (detail) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: lessonKeys.lists() }),
        queryClient.invalidateQueries({ queryKey: studentKeys.all }),
      ])
      toast.success(
        detail.lesson.studentPayment?.paid
          ? 'Lesson created · Prepaid lesson used'
          : 'Lesson created',
      )
      onOpenChange(false)
      onCreated(detail.lesson.id)
    },
    onError: (error) => {
      if (isApiError(error) && error.isNotFound) {
        setFormError(
          'This student is not on the teacher’s roster and not enrolled in one of their courses, so no lesson can be booked between them.',
        )
        return
      }
      setFormError(
        applyServerErrors(error, form.setError, [
          'studentId',
          'teacherId',
          'courseId',
          'scheduledAt',
          'meetingUrl',
        ]),
      )
    },
  })

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title="New lesson"
      description="One session between one teacher and one student. Leave the date empty to create an unscheduled lesson."
      submitLabel="Create lesson"
      isSubmitting={mutation.isPending}
      onSubmit={form.handleSubmit((values) => {
        setFormError(null)
        mutation.mutate(values)
      })}
    >
      <FormError message={formError} />
      {!fixed.organizationId && !fixed.teacherId ? (
        <Field label="Organization" required>
          {(a11y) => (
            <Controller
              control={form.control}
              name="org"
              render={({ field }) => (
                <SelectField
                  id={a11y.id}
                  value={field.value}
                  onChange={(value) => {
                    field.onChange(value)
                    form.setValue('teacherId', '')
                    form.setValue('studentId', '')
                    form.setValue('courseId', '')
                  }}
                  options={options.scopes}
                  placeholder={
                    options.scopesLoading ? 'Loading…' : 'Choose an organization or freelance'
                  }
                />
              )}
            />
          )}
        </Field>
      ) : null}
      {!fixed.teacherId ? (
        <Field label="Teacher" required error={form.formState.errors.teacherId?.message}>
          {(a11y) => (
            <Controller
              control={form.control}
              name="teacherId"
              render={({ field }) => (
                <SelectField
                  id={a11y.id}
                  aria-describedby={a11y['aria-describedby']}
                  aria-invalid={a11y['aria-invalid']}
                  value={field.value}
                  onChange={(value) => {
                    field.onChange(value)
                    form.setValue('studentId', '')
                    form.setValue('courseId', '')
                  }}
                  options={options.teachers}
                  disabled={!options.teachersEnabled}
                  placeholder={
                    !options.teachersEnabled
                      ? 'Choose an organization first'
                      : options.teachersLoading
                        ? 'Loading…'
                        : 'Choose a teacher'
                  }
                  emptyText="No teachers here."
                />
              )}
            />
          )}
        </Field>
      ) : null}
      <Field
        label="Student"
        required
        hint="On the teacher’s roster or enrolled in one of their courses."
        error={form.formState.errors.studentId?.message}
      >
        {(a11y) => (
          <Controller
            control={form.control}
            name="studentId"
            render={({ field }) => (
              <SelectField
                id={a11y.id}
                aria-describedby={a11y['aria-describedby']}
                aria-invalid={a11y['aria-invalid']}
                value={field.value}
                onChange={field.onChange}
                options={options.students}
                disabled={!teacherId}
                placeholder={
                  !teacherId
                    ? 'Choose a teacher first'
                    : options.studentsLoading
                      ? 'Loading…'
                      : 'Choose a student'
                }
                emptyText="This teacher has no students yet."
              />
            )}
          />
        )}
      </Field>
      <Field
        label="Course"
        hint="Optional grouping. Must be one of the teacher’s courses; its default meeting link is used when none is given."
        error={form.formState.errors.courseId?.message}
      >
        {(a11y) => (
          <Controller
            control={form.control}
            name="courseId"
            render={({ field }) => (
              <SelectField
                id={a11y.id}
                value={field.value}
                onChange={field.onChange}
                options={options.courses}
                disabled={!teacherId}
                placeholder={
                  !teacherId
                    ? 'Choose a teacher first'
                    : options.coursesLoading
                      ? 'Loading…'
                      : 'No course'
                }
                emptyText="This teacher has no courses yet."
              />
            )}
          />
        )}
      </Field>
      <Field
        label="Date and time"
        hint="Your local time. Past dates are allowed (logging a lesson after the fact). Empty = unscheduled."
        error={form.formState.errors.scheduledAt?.message}
      >
        {(a11y) => <Input {...a11y} type="datetime-local" {...form.register('scheduledAt')} />}
      </Field>
      <Field
        label="Meeting link"
        hint="Optional absolute https:// link shown as “Join lesson”."
        error={form.formState.errors.meetingUrl?.message}
      >
        {(a11y) => (
          <Input
            {...a11y}
            type="url"
            inputMode="url"
            placeholder="https://meet.example.com/room"
            {...form.register('meetingUrl')}
          />
        )}
      </Field>
      {canManageStudentPayments ? (
        <Controller
          control={form.control}
          name="usePrepaid"
          render={({ field }) => (
            <div className="flex items-start gap-3 rounded-lg border border-border p-3">
              <Checkbox
                id="use-prepaid"
                checked={field.value}
                onCheckedChange={(checked) => field.onChange(checked === true)}
                className="mt-0.5"
              />
              <div className="flex flex-col gap-1">
                <Label htmlFor="use-prepaid" className="font-medium">
                  Use one of the student’s prepaid lessons if available
                </Label>
                <p className="text-xs text-muted-foreground">
                  A dated lesson spends the student’s oldest prepaid lesson with this teacher
                  (bought for this course or for no course) instead of adding an unpaid one.
                  Unscheduled lessons never spend credits. Untick to always add a new unpaid lesson.
                </p>
              </div>
            </div>
          )}
        />
      ) : null}
    </FormSheet>
  )
}
