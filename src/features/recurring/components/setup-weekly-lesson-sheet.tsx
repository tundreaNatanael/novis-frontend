import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { isApiError } from '@/api/errors'
import { lessonKeys } from '@/api/lessons'
import { recurringLessonKeys, recurringLessonsApi } from '@/api/recurring-lessons'
import { studentKeys } from '@/api/students'
import type { CreateRecurringLessonRequest } from '@/api/types'
import { Field } from '@/components/form/field'
import { FormError } from '@/components/form/form-error'
import { FormSheet } from '@/components/form/form-sheet'
import { SelectField } from '@/components/form/select-field'
import { applyServerErrors } from '@/components/form/server-errors'
import { Input } from '@/components/ui/input'
import { OverlapConfirmDialog } from '@/features/lessons/components/overlap-confirm-dialog'
import { useOrgTeachers, useTeacherCourses } from '@/features/org-workspace/hooks/use-org-lookups'
import { toDateTimeLocal } from '@/lib/format'
import { lessonDurationSchema, optionalHttpsUrl } from '@/lib/schemas'
import { useDebouncedValue } from '@/lib/use-debounced-value'
import { REPEAT_OPTIONS, browserTimeZone, recurringBody } from '../recurring-state'
import { OccurrencePreview } from './occurrence-preview'

const DEFAULT_LENGTH = 60

const schema = z.object({
  teacherId: z.string().min(1, 'Choose a teacher'),
  courseId: z.string(),
  firstAt: z.string().min(1, 'Choose the first lesson'),
  intervalWeeks: z.enum(['1', '2']).transform((value) => (value === '2' ? 2 : 1) as 1 | 2),
  durationMinutes: lessonDurationSchema,
  meetingUrl: optionalHttpsUrl,
})
type FormInput = z.input<typeof schema>
type FormValues = z.output<typeof schema>

interface Props {
  studentId: string
  studentName: string
  /** Fixed teacher (the freelance workspace). Without it `organizationId` feeds a teacher picker. */
  teacher?: { id: string; name?: string }
  organizationId?: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * `POST /recurring-lessons`: a permanent weekly lesson of one teacher and this student — the
 * teacher (named, as on `POST /lessons/series`; an admin acts for a teacher of their
 * organization), an optional course, the first lesson on the browser's clock (its weekday and time
 * repeat in the browser's zone), every one or two weeks, the length (the course's default until
 * edited) and a link. The dates up to the horizon are previewed with a dry run as the form is
 * filled; a `409 SCHEDULE_CONFLICT` asks before setting it up anyway (D-045).
 */
export function SetupWeeklyLessonSheet({
  studentId,
  studentName,
  teacher,
  organizationId,
  open,
  onOpenChange,
}: Props) {
  const queryClient = useQueryClient()
  const [formError, setFormError] = useState<string | null>(null)
  const [overlapping, setOverlapping] = useState<CreateRecurringLessonRequest | null>(null)
  const timeZone = useMemo(() => browserTimeZone(), [])
  const defaults = (): FormInput => ({
    teacherId: teacher?.id ?? '',
    courseId: '',
    firstAt: '',
    intervalWeeks: '1',
    durationMinutes: DEFAULT_LENGTH,
    meetingUrl: '',
  })
  const form = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaults(),
  })
  const values = form.watch()
  const teacherId = values.teacherId
  const courseId = values.courseId
  const teachers = useOrgTeachers(organizationId ?? '', open && !teacher && !!organizationId)
  const courses = useTeacherCourses(teacherId, open)
  const courseLength = courseId
    ? (courses.data?.find((c) => c.id === courseId)?.defaultDurationMinutes ?? null)
    : null

  useEffect(() => {
    if (open) {
      form.reset(defaults())
      setFormError(null)
      setOverlapping(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when the sheet opens
  }, [open, teacher?.id])

  useEffect(() => {
    // The length follows the course until it is edited by hand.
    if (!form.getFieldState('durationMinutes').isDirty) {
      form.setValue('durationMinutes', courseLength ?? DEFAULT_LENGTH)
    }
  }, [courseId, courseLength, form])

  // The dry run follows the form: a body once it is complete, debounced so typing does not fire it.
  const parsed = schema.safeParse(values)
  const planBody = useMemo(
    () =>
      parsed.success
        ? recurringBody({
            studentId,
            teacherId: parsed.data.teacherId,
            courseId: parsed.data.courseId,
            firstAt: parsed.data.firstAt,
            timeZone,
            intervalWeeks: parsed.data.intervalWeeks,
            durationMinutes: parsed.data.durationMinutes,
            meetingUrl: parsed.data.meetingUrl,
          })
        : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed by the typed values
    [JSON.stringify(values), studentId, timeZone, parsed.success],
  )
  const debouncedBody = useDebouncedValue(open ? planBody : null)
  const plan = useQuery({
    queryKey: recurringLessonKeys.plan(debouncedBody),
    queryFn: () => recurringLessonsApi.plan(debouncedBody!),
    enabled: debouncedBody !== null,
    retry: false,
    staleTime: 30_000,
  })

  const mutation = useMutation({
    mutationFn: ({ body }: { body: CreateRecurringLessonRequest; allowOverlap: boolean }) =>
      recurringLessonsApi.create(body),
    onSuccess: async (detail) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: recurringLessonKeys.all }),
        queryClient.invalidateQueries({ queryKey: lessonKeys.all }),
        queryClient.invalidateQueries({ queryKey: studentKeys.all }),
      ])
      toast.success('Weekly lesson set up', {
        description: `${detail.lessons.length} ${detail.lessons.length === 1 ? 'lesson' : 'lessons'} booked for the next 8 weeks; the rest follow day by day.`,
      })
      onOpenChange(false)
    },
    onError: (error, { body, allowOverlap }) => {
      // A resend that allows the overlap reports its error in the confirmation.
      if (allowOverlap) return
      if (isApiError(error) && error.is('SCHEDULE_CONFLICT')) {
        setOverlapping(body)
        return
      }
      if (isApiError(error) && error.isNotFound) {
        setFormError(
          'This student is not on the teacher’s roster and not enrolled in one of their courses, so no weekly lesson can be set up between them.',
        )
        return
      }
      setFormError(
        applyServerErrors(error, form.setError, [
          'teacherId',
          'courseId',
          'firstAt',
          'intervalWeeks',
          'durationMinutes',
          'meetingUrl',
        ]),
      )
    },
  })

  return (
    <>
      <FormSheet
        open={open}
        onOpenChange={onOpenChange}
        title="Set up weekly lesson"
        description={`A lesson every week (or every two weeks) for ${studentName}${teacher?.name ? ` with ${teacher.name}` : ''}, at the same time, until it is stopped. Lessons are booked 8 weeks ahead and kept booked day by day.`}
        submitLabel="Set up weekly lesson"
        isSubmitting={mutation.isPending}
        onSubmit={form.handleSubmit((parsedValues) => {
          setFormError(null)
          const body = recurringBody({
            studentId,
            teacherId: parsedValues.teacherId,
            courseId: parsedValues.courseId,
            firstAt: parsedValues.firstAt,
            timeZone,
            intervalWeeks: parsedValues.intervalWeeks,
            durationMinutes: parsedValues.durationMinutes,
            meetingUrl: parsedValues.meetingUrl,
          })
          if (!body) {
            form.setError('firstAt', { type: 'manual', message: 'Choose the first lesson' })
            return
          }
          mutation.mutate({ body, allowOverlap: false })
        })}
      >
        <FormError message={formError} />
        {!teacher ? (
          <Field
            label="Teacher"
            required
            hint="The student must be on this teacher’s roster or enrolled in one of their courses."
            error={form.formState.errors.teacherId?.message}
          >
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
                      form.setValue('courseId', '')
                    }}
                    options={(teachers.data ?? []).map((m) => ({
                      value: m.userId,
                      label: m.name,
                      description: m.email,
                    }))}
                    placeholder={teachers.isPending ? 'Loading teachers…' : 'Choose a teacher'}
                    emptyText="This organization has no teachers yet."
                  />
                )}
              />
            )}
          </Field>
        ) : null}
        <Field
          label="Course"
          hint="Optional grouping. Its default length and meeting link are used when none is given."
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
                  options={(courses.data ?? []).map((c) => ({
                    value: c.id,
                    label: c.title,
                    description: c.status === 'ARCHIVED' ? 'Archived' : undefined,
                  }))}
                  disabled={!teacherId}
                  placeholder={
                    !teacherId
                      ? 'Choose a teacher first'
                      : courses.isPending
                        ? 'Loading courses…'
                        : 'No course'
                  }
                  emptyText="This teacher has no courses yet."
                />
              )}
            />
          )}
        </Field>
        <Field
          label="First lesson"
          required
          hint={`Your local time (${timeZone}); the weekday and time repeat from it. Today or later.`}
          error={form.formState.errors.firstAt?.message}
        >
          {(a11y) => (
            <Input
              {...a11y}
              type="datetime-local"
              min={toDateTimeLocal(new Date().toISOString()).slice(0, 10) + 'T00:00'}
              {...form.register('firstAt')}
            />
          )}
        </Field>
        <Field label="Repeat" required error={form.formState.errors.intervalWeeks?.message}>
          {(a11y) => (
            <Controller
              control={form.control}
              name="intervalWeeks"
              render={({ field }) => (
                <SelectField
                  id={a11y.id}
                  value={field.value}
                  onChange={field.onChange}
                  options={REPEAT_OPTIONS}
                />
              )}
            />
          )}
        </Field>
        <Field
          label="Length (minutes)"
          required
          hint={
            courseLength
              ? 'The course’s default length; change it for this weekly lesson only. 15–240 minutes.'
              : 'Courses can set a default length. 15–240 minutes.'
          }
          error={form.formState.errors.durationMinutes?.message}
        >
          {(a11y) => (
            <Input
              {...a11y}
              type="number"
              inputMode="numeric"
              min={15}
              max={240}
              step={5}
              {...form.register('durationMinutes')}
            />
          )}
        </Field>
        <Field
          label="Meeting link"
          hint="Optional absolute https:// link every lesson gets as “Join lesson”."
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
        <OccurrencePreview
          title="First dates"
          plan={plan.data}
          durationMinutes={parsed.success ? parsed.data.durationMinutes : DEFAULT_LENGTH}
          isPending={debouncedBody !== null && plan.isPending}
          error={plan.error}
          idleText="Choose the teacher and the first lesson to see the dates."
        />
      </FormSheet>
      <OverlapConfirmDialog
        open={overlapping !== null}
        onOpenChange={(next) => {
          if (!next) setOverlapping(null)
        }}
        confirmLabel="Set it up anyway"
        onConfirm={() =>
          overlapping
            ? mutation.mutateAsync({
                body: { ...overlapping, allowOverlap: true },
                allowOverlap: true,
              })
            : undefined
        }
      />
    </>
  )
}
