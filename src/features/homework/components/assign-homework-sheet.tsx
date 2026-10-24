import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Circle, Plus, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Controller, useFieldArray, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { isApiError } from '@/api/errors'
import { homeworkApi, homeworkKeys } from '@/api/homework'
import { studentKeys, studentsApi } from '@/api/students'
import type { Homework } from '@/api/types'
import { Field } from '@/components/form/field'
import { FormError } from '@/components/form/form-error'
import { FormSheet } from '@/components/form/form-sheet'
import { SelectField } from '@/components/form/select-field'
import { applyServerErrors } from '@/components/form/server-errors'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useOrgTeachers } from '@/features/org-workspace/hooks/use-org-lookups'
import { endOfLocalDay, formatDateTime, toDateInput } from '@/lib/format'
import { checklistSchema, longTextSchema, optionalTitleSchema } from '@/lib/schemas'
import { cn } from '@/lib/utils'
import {
  checklistLines,
  checklistWithTicks,
  homeworkChanges,
  homeworkWriteError,
} from '../homework-state'

/** The course select cannot go back to empty, so "no course" is an option of its own. */
const NO_COURSE = 'none'
const ENROLLMENTS = { page: 0, size: 100, sort: 'enrolledAt,desc' }

const schema = z.object({
  teacherId: z.string().min(1, 'Choose a teacher'),
  title: optionalTitleSchema,
  notes: longTextSchema,
  dueDate: z.string(),
  courseId: z.string(),
  items: checklistSchema,
})
type FormValues = z.infer<typeof schema>

/** Where "Assign homework" was opened. */
export interface AssignHomeworkContext {
  studentId: string
  studentName: string
  /** Fixed teacher (lesson detail, freelance workspace). Without it `organizationId` feeds a teacher picker. */
  teacher?: { id: string; name?: string }
  organizationId?: string
  /** Opened from a lesson: the homework refers to it, and its course is preselected. */
  lesson?: { id: string; label: string; courseId: string | null }
}

interface Props extends AssignHomeworkContext {
  /** Edit this homework (`PATCH /homework/{id}`) instead of assigning a new one. */
  homework?: Homework
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The server answered `403` to an edit: the panel disables that row's actions. */
  onForbidden?: (homeworkId: string) => void
}

/**
 * `POST /homework`: a checklist for one student with one teacher (admins always name the
 * teacher), optionally referring to a course the student is actively enrolled in with that
 * teacher and, from a lesson page, to the lesson.
 *
 * With `homework` the same sheet edits it (`PATCH /homework/{id}`, only what changed): title,
 * notes, due date (moved, added or removed) and the checklist lines. The teacher, course and lesson
 * stay as assigned; the ticks stay the student's (re-read right before the checklist is replaced).
 */
export function AssignHomeworkSheet({
  studentId,
  studentName,
  teacher,
  organizationId,
  lesson,
  homework,
  open,
  onOpenChange,
  onForbidden,
}: Props) {
  const queryClient = useQueryClient()
  const [formError, setFormError] = useState<string | null>(null)
  const editing = !!homework
  const defaults = (): FormValues =>
    homework
      ? {
          teacherId: homework.teacherId,
          title: homework.title ?? '',
          notes: homework.notes ?? '',
          dueDate: toDateInput(homework.dueAt),
          courseId: homework.courseId ?? NO_COURSE,
          items:
            homework.items.length > 0
              ? homework.items.map((item) => ({
                  text: item.text,
                  itemId: item.id,
                  done: item.done,
                }))
              : [{ text: '' }],
        }
      : {
          teacherId: teacher?.id ?? '',
          title: '',
          notes: '',
          dueDate: '',
          courseId: lesson?.courseId ?? NO_COURSE,
          items: [{ text: '' }],
        }
  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: defaults() })
  const items = useFieldArray({ control: form.control, name: 'items' })
  const teacherId = form.watch('teacherId')
  const courseId = form.watch('courseId')
  const dueDate = form.watch('dueDate')
  const teachers = useOrgTeachers(
    organizationId ?? '',
    open && !editing && !teacher && !!organizationId,
  )
  const enrollments = useQuery({
    queryKey: studentKeys.enrollments(studentId, ENROLLMENTS),
    queryFn: ({ signal }) => studentsApi.enrollments(studentId, ENROLLMENTS, signal),
    enabled: open && !editing,
  })
  // Only courses the student is actively enrolled in with this teacher: anything else is a 400.
  const courses = (enrollments.data?.content ?? []).filter(
    (e) => e.status === 'ACTIVE' && e.courseStatus === 'ACTIVE' && e.teacherId === teacherId,
  )
  const courseIds = courses.map((e) => e.courseId).join()

  useEffect(() => {
    if (open) {
      form.reset(defaults())
      setFormError(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when the sheet opens
  }, [open, teacher?.id, lesson?.id, homework?.id])

  // A preselected course the student is not (or no longer) actively enrolled in falls back to none.
  useEffect(() => {
    if (
      !editing &&
      enrollments.isSuccess &&
      courseId !== NO_COURSE &&
      !courseIds.split(',').includes(courseId)
    ) {
      form.setValue('courseId', NO_COURSE)
    }
  }, [editing, enrollments.isSuccess, courseId, courseIds, form])

  const create = useMutation({
    mutationFn: (values: FormValues) =>
      homeworkApi.create({
        studentId,
        teacherId: values.teacherId,
        ...(lesson ? { lessonId: lesson.id } : {}),
        ...(values.courseId !== NO_COURSE ? { courseId: values.courseId } : {}),
        ...(values.title ? { title: values.title } : {}),
        ...(values.notes ? { notes: values.notes } : {}),
        ...(values.dueDate ? { dueAt: endOfLocalDay(values.dueDate) ?? undefined } : {}),
        items: values.items
          .map((item) => item.text)
          .filter(Boolean)
          .map((text) => ({ text })),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: homeworkKeys.lists() })
      toast.success('Homework assigned')
      onOpenChange(false)
    },
    onError: (error) => {
      if (isApiError(error) && error.isNotFound) {
        setFormError(
          'This student is not on the teacher’s roster and not enrolled in one of their courses, so no homework can be assigned between them.',
        )
        return
      }
      setFormError(
        applyServerErrors(error, form.setError, [
          'teacherId',
          'title',
          'notes',
          'courseId',
          'items',
        ]),
      )
    },
  })

  const save = useMutation({
    mutationFn: async ({ target, values }: { target: Homework; values: FormValues }) => {
      const body = homeworkChanges(target, values)
      if (Object.keys(body).length === 0) return null
      if (body.items) {
        // `items` replaces every item: take the ticks as they are now, not as the sheet opened.
        const latest = await homeworkApi.get(target.id)
        body.items = checklistWithTicks(checklistLines(values.items), latest)
      }
      return homeworkApi.update(target.id, body)
    },
    onSuccess: async (saved) => {
      if (saved) {
        await queryClient.invalidateQueries({ queryKey: homeworkKeys.lists() })
        toast.success('Homework saved')
      }
      onOpenChange(false)
    },
    onError: (error, { target }) => {
      if (isApiError(error) && (error.isNotFound || error.isForbidden)) {
        if (error.isNotFound) {
          void queryClient.invalidateQueries({ queryKey: homeworkKeys.lists() })
        } else {
          onForbidden?.(target.id)
        }
        setFormError(homeworkWriteError(error))
        return
      }
      setFormError(applyServerErrors(error, form.setError, ['title', 'notes', 'items']))
    },
  })

  const itemsError =
    form.formState.errors.items?.root?.message ?? form.formState.errors.items?.message
  const description = homework
    ? `For ${homework.studentName} from ${homework.teacherName}${
        homework.courseTitle ? ` in ${homework.courseTitle}` : ''
      }${
        homework.lessonId
          ? homework.lessonScheduledAt
            ? `, for the lesson on ${formatDateTime(homework.lessonScheduledAt)}`
            : ', for a lesson'
          : ''
      }. The teacher, course and lesson stay as assigned.`
    : `A checklist for ${studentName}${teacher?.name ? ` from ${teacher.name}` : ''}${
        lesson ? `, for the lesson on ${lesson.label}` : ''
      }. It starts open; the student ticks it off in the app.`

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? 'Edit homework' : 'Assign homework'}
      description={description}
      submitLabel={editing ? 'Save homework' : 'Assign homework'}
      isSubmitting={create.isPending || save.isPending}
      onSubmit={form.handleSubmit((values) => {
        setFormError(null)
        if (!homework) {
          create.mutate(values)
          return
        }
        save.mutate({ target: homework, values })
      })}
    >
      <FormError message={formError} />
      {!teacher && !editing ? (
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
                    form.setValue('courseId', NO_COURSE)
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
        label="Title"
        hint="Optional, e.g. “Weekly practice”."
        error={form.formState.errors.title?.message}
      >
        {(a11y) => <Input {...a11y} {...form.register('title')} />}
      </Field>
      <Field label="Notes" error={form.formState.errors.notes?.message}>
        {(a11y) => <Textarea {...a11y} rows={3} {...form.register('notes')} />}
      </Field>
      <Field label="Due date" hint="Optional. Open homework is overdue from the next day on.">
        {(a11y) => (
          <div className="flex items-center gap-2">
            <Input {...a11y} type="date" {...form.register('dueDate')} />
            {/* A native date input is hard to empty by hand. */}
            {dueDate ? (
              <Button
                type="button"
                variant="ghost"
                aria-label="Clear due date"
                onClick={() => form.setValue('dueDate', '', { shouldDirty: true })}
              >
                Clear
              </Button>
            ) : null}
          </div>
        )}
      </Field>
      {!editing ? (
        <Field
          label="Course"
          hint="Optional: one of the student’s active courses with this teacher."
          error={form.formState.errors.courseId?.message}
        >
          {(a11y) => (
            <Controller
              control={form.control}
              name="courseId"
              render={({ field }) => (
                <SelectField
                  id={a11y.id}
                  aria-describedby={a11y['aria-describedby']}
                  value={field.value}
                  onChange={field.onChange}
                  options={[
                    { value: NO_COURSE, label: 'No course' },
                    ...courses.map((e) => ({ value: e.courseId, label: e.courseTitle })),
                  ]}
                  disabled={!teacherId}
                  placeholder={!teacherId ? 'Choose a teacher first' : 'No course'}
                />
              )}
            />
          )}
        </Field>
      ) : null}
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium text-foreground">
          Checklist
          <span className="text-muted-foreground" aria-hidden>
            {' '}
            *
          </span>
        </legend>
        {editing ? (
          <p className="-mt-1 text-xs text-muted-foreground">
            Ticks stay as the student left them; new lines start open.
          </p>
        ) : null}
        {items.fields.map((item, index) => {
          const itemError = form.formState.errors.items?.[index]?.text?.message
          return (
            <div key={item.id} className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                {editing ? <TickMarker done={!!item.done} /> : null}
                <Input
                  aria-label={`Checklist item ${index + 1}`}
                  placeholder="Practise the C major scale"
                  aria-invalid={itemError ? true : undefined}
                  {...form.register(`items.${index}.text`)}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => items.remove(index)}
                  disabled={items.fields.length === 1}
                  aria-label={`Remove item ${index + 1}`}
                >
                  <X aria-hidden />
                </Button>
              </div>
              {itemError ? (
                <p role="alert" className="text-xs font-medium text-destructive">
                  {itemError}
                </p>
              ) : null}
            </div>
          )
        })}
        {itemsError ? (
          <p role="alert" className="text-xs font-medium text-destructive">
            {itemsError}
          </p>
        ) : null}
        {items.fields.length < 100 ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-fit"
            onClick={() => items.append({ text: '' })}
          >
            <Plus aria-hidden />
            Add item
          </Button>
        ) : null}
      </fieldset>
    </FormSheet>
  )
}

/** The student's tick on a line being edited; read-only, the student owns it. */
function TickMarker({ done }: { done: boolean }) {
  const label = done ? 'Ticked by the student' : 'Not ticked yet'
  return (
    <span
      title={label}
      className={cn(
        'flex size-9 shrink-0 items-center justify-center',
        done ? 'text-success' : 'text-muted-foreground',
      )}
    >
      {done ? (
        <CheckCircle2 className="size-4" aria-hidden />
      ) : (
        <Circle className="size-4" aria-hidden />
      )}
      <span className="sr-only">{label}</span>
    </span>
  )
}
