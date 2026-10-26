import { zodResolver } from '@hookform/resolvers/zod'
import { CheckCircle2, Circle, ClipboardList, Loader2, Plus, X } from 'lucide-react'
import { useEffect, useId, useMemo, useState } from 'react'
import { Controller, useFieldArray, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import type { Homework } from '@/api/types'
import { useMe } from '@/auth/session'
import { Field } from '@/components/form/field'
import { SelectField } from '@/components/form/select-field'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  checklistLines,
  homeworkChanges,
  type ChecklistLine,
} from '@/features/homework/homework-state'
import { endOfLocalDay, toDateInput } from '@/lib/format'
import { cn } from '@/lib/utils'
import { ErrorState, SkeletonCard } from '../components/states'
import { TeachSheet } from '../components/teach-sheet'
import { useHomework } from '../data/homework'
import { useLesson } from '../data/lessons'
import { useAssignHomework, useUpdateHomework } from '../data/mutations'
import { useStudent, useStudentEnrollments } from '../data/roster'
import { useT } from '../i18n/use-i18n'
import { describeError, isApiStatus } from '../lib/error-message'
import { applyFieldErrors } from '../lib/form'
import { makeSchemas } from '../lib/schemas'
import { useFormatters } from '../lib/use-formatters'

/** The course select cannot go back to empty, so "no course" is an option of its own. */
const NO_COURSE = '__none__'

interface Draft {
  title: string
  notes: string
  /** `date` input value; empty = none. */
  dueDate: string
  courseId: string
  items: ChecklistLine[]
}

function useHomeworkSchema() {
  const t = useT()
  return useMemo(() => {
    const s = makeSchemas(t)
    return z.object({
      title: s.optionalTitle,
      notes: s.longText(),
      dueDate: z.string(),
      courseId: z.string(),
      items: z
        .array(
          z.object({
            text: z
              .string()
              .trim()
              .max(2000, t('validation.tooLong', { max: 2000 })),
            itemId: z.string().optional(),
            done: z.boolean().optional(),
          }),
        )
        .max(100)
        .refine((items) => items.some((item) => item.text.trim().length > 0), {
          message: t('validation.itemsRequired'),
        }),
    })
  }, [t])
}

/**
 * `POST /homework` for one of the teacher's students: a title, notes, an optional due day, an
 * optional course (the student's active courses with this teacher) and a checklist of at least
 * one line. Opened from a lesson, it refers to the lesson and preselects the lesson's course.
 */
export function AssignHomeworkSheet({
  studentId,
  lessonId,
  open,
  onOpenChange,
}: {
  studentId: string
  lessonId?: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = useT()
  const fmt = useFormatters()
  const me = useMe()
  const { student } = useStudent(studentId)
  const lesson = useLesson(lessonId ?? '')
  const enrollments = useStudentEnrollments(studentId)
  const assign = useAssignHomework()
  const schema = useHomeworkSchema()
  const form = useForm<Draft>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: '',
      notes: '',
      dueDate: '',
      courseId: NO_COURSE,
      items: [{ text: '' }],
    },
  })
  const [preselected, setPreselected] = useState(false)

  // Only the student's active courses with this teacher: anything else is a 400.
  const courses = (enrollments.data ?? []).filter(
    (e) => e.status === 'ACTIVE' && e.courseStatus === 'ACTIVE' && e.teacherId === me.id,
  )
  const lessonCourse = lesson.data?.lesson.courseId ?? null
  // The lesson's course is preselected once both the lesson and the enrollments are known.
  useEffect(() => {
    if (preselected || !enrollments.isSuccess || (lessonId && !lesson.data)) return
    setPreselected(true)
    if (lessonCourse && courses.some((c) => c.courseId === lessonCourse)) {
      form.setValue('courseId', lessonCourse)
    }
  }, [preselected, enrollments.isSuccess, lessonId, lesson.data, lessonCourse, courses, form])

  const lessonDate = lesson.data?.lesson.scheduledAt
    ? fmt.shortDate(new Date(lesson.data.lesson.scheduledAt))
    : null
  const subtitle = student
    ? lessonId && lessonDate
      ? t('teacher.assign.subtitleLesson', { name: student.name, date: lessonDate })
      : t('teacher.assign.subtitle', { name: student.name })
    : undefined

  const submit = form.handleSubmit(async (draft) => {
    try {
      await assign.mutateAsync({
        studentId,
        ...(lessonId ? { lessonId } : {}),
        ...(draft.courseId !== NO_COURSE ? { courseId: draft.courseId } : {}),
        ...(draft.title.trim().length > 0 ? { title: draft.title.trim() } : {}),
        ...(draft.notes.trim().length > 0 ? { notes: draft.notes.trim() } : {}),
        ...(draft.dueDate ? { dueAt: endOfLocalDay(draft.dueDate) ?? undefined } : {}),
        items: checklistLines(draft.items).map((line) => ({ text: line.text })),
      })
      toast.success(t('teacher.assign.assigned'))
      onOpenChange(false)
    } catch (error) {
      if (isApiStatus(error, 404)) toast.error(t('teacher.assign.notReachable'))
      else if (!applyFieldErrors(error, form.setError, ['title', 'notes', 'items']))
        toast.error(describeError(error, t))
    }
  })

  return (
    <HomeworkForm
      title={t('teacher.assign.title')}
      subtitle={subtitle}
      form={form}
      submitLabel={t('teacher.assign.submit')}
      submittingLabel={t('teacher.assign.submitting')}
      submitting={assign.isPending}
      onSubmit={() => void submit()}
      open={open}
      onOpenChange={onOpenChange}
      courses={courses.map((c) => ({ value: c.courseId, label: c.courseTitle }))}
    />
  )
}

/** The same sheet on an existing homework (`PATCH /homework/{id}`, only what changed, D-042). */
export function EditHomeworkSheet({
  homeworkId,
  open,
  onOpenChange,
}: {
  homeworkId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = useT()
  const query = useHomework(homeworkId)
  if (!query.data) {
    return (
      <TeachSheet open={open} onOpenChange={onOpenChange} title={t('teacher.assign.editTitle')}>
        {query.isError ? (
          <ErrorState compact error={query.error} onRetry={() => void query.refetch()} />
        ) : (
          <SkeletonCard lines={4} />
        )}
      </TeachSheet>
    )
  }
  return (
    <EditHomeworkForm
      key={query.data.id}
      homework={query.data}
      open={open}
      onOpenChange={onOpenChange}
    />
  )
}

/**
 * Mounted once the homework is loaded. It keeps the homework as the sheet opened it: the form
 * starts from it, and only what the teacher changed since goes out, even if it refetches meanwhile.
 */
function EditHomeworkForm({
  homework,
  open,
  onOpenChange,
}: {
  homework: Homework
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = useT()
  const fmt = useFormatters()
  const update = useUpdateHomework()
  const schema = useHomeworkSchema()
  const [opened] = useState(homework)
  const form = useForm<Draft>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: opened.title ?? '',
      notes: opened.notes ?? '',
      dueDate: toDateInput(opened.dueAt),
      courseId: opened.courseId ?? NO_COURSE,
      items:
        opened.items.length > 0
          ? opened.items.map((item) => ({ text: item.text, itemId: item.id, done: item.done }))
          : [{ text: '' }],
    },
  })
  const subtitle = opened.lessonScheduledAt
    ? t('teacher.assign.subtitleLesson', {
        name: opened.studentName,
        date: fmt.shortDate(new Date(opened.lessonScheduledAt)),
      })
    : t('teacher.assign.subtitle', { name: opened.studentName })

  const submit = form.handleSubmit(async (draft) => {
    const body = homeworkChanges(opened, draft)
    if (Object.keys(body).length === 0) {
      onOpenChange(false)
      return
    }
    try {
      await update.mutateAsync({ id: opened.id, body, lines: checklistLines(draft.items) })
      toast.success(t('teacher.assign.saved'))
      onOpenChange(false)
    } catch (error) {
      toast.error(describeError(error, t))
      // Gone or out of reach: there is nothing left to edit (the lists were refreshed).
      if (isApiStatus(error, 404)) onOpenChange(false)
    }
  })

  return (
    <HomeworkForm
      title={t('teacher.assign.editTitle')}
      subtitle={subtitle}
      form={form}
      editing
      submitLabel={t('teacher.assign.save')}
      submittingLabel={t('teacher.assign.saving')}
      submitting={update.isPending}
      onSubmit={() => void submit()}
      open={open}
      onOpenChange={onOpenChange}
    />
  )
}

/** The homework sheet's fields: title, notes, the checklist (at least one line), an optional due day and course. */
function HomeworkForm({
  title,
  subtitle,
  form,
  editing = false,
  submitLabel,
  submittingLabel,
  submitting,
  onSubmit,
  open,
  onOpenChange,
  courses,
}: {
  title: string
  subtitle?: string
  form: ReturnType<typeof useForm<Draft>>
  editing?: boolean
  submitLabel: string
  submittingLabel: string
  submitting: boolean
  onSubmit: () => void
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The course picker's options (assigning only; the course stays as assigned when editing). */
  courses?: { value: string; label: string }[]
}) {
  const t = useT()
  const items = useFieldArray({ control: form.control, name: 'items' })
  const dueDate = form.watch('dueDate')
  const courseFieldId = useId()
  const itemsError =
    form.formState.errors.items?.root?.message ?? form.formState.errors.items?.message

  return (
    <TeachSheet
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      subtitle={subtitle}
      onSubmit={onSubmit}
      footer={
        <Button
          type="submit"
          size="lg"
          className="w-full rounded-full sm:w-auto"
          disabled={submitting}
        >
          {submitting ? (
            <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden />
          ) : (
            <ClipboardList aria-hidden />
          )}
          {submitting ? submittingLabel : submitLabel}
        </Button>
      }
    >
      <Field label={t('teacher.assign.titleLabel')} error={form.formState.errors.title?.message}>
        {(a11y) => (
          <Input
            {...a11y}
            placeholder={t('teacher.assign.titlePlaceholder')}
            {...form.register('title')}
          />
        )}
      </Field>
      <Field label={t('teacher.assign.notes')} error={form.formState.errors.notes?.message}>
        {(a11y) => (
          <Textarea
            {...a11y}
            rows={3}
            placeholder={t('teacher.assign.notesPlaceholder')}
            {...form.register('notes')}
          />
        )}
      </Field>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium text-foreground">
          {t('teacher.assign.items')}
        </legend>
        {editing ? (
          <p className="-mt-1 text-xs text-muted-foreground">{t('teacher.assign.ticksHint')}</p>
        ) : null}
        {items.fields.map((item, index) => {
          const itemError = form.formState.errors.items?.[index]?.text?.message
          return (
            <div key={item.id} className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                {editing ? <TickMarker done={!!item.done} /> : null}
                <Input
                  aria-label={t('teacher.assign.itemLabel', { index: index + 1 })}
                  placeholder={t('teacher.assign.itemPlaceholder')}
                  aria-invalid={itemError ? true : undefined}
                  {...form.register(`items.${index}.text`)}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => items.remove(index)}
                  disabled={items.fields.length === 1}
                  aria-label={t('teacher.assign.removeItem', { index: index + 1 })}
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
            variant="secondary"
            size="sm"
            className="w-fit rounded-full"
            onClick={() => items.append({ text: '' })}
          >
            <Plus aria-hidden />
            {t('teacher.assign.addItem')}
          </Button>
        ) : null}
      </fieldset>

      <Field label={t('teacher.assign.due')} hint={t('teacher.assign.dueHint')}>
        {(a11y) => (
          <div className="flex items-center gap-2">
            <Input {...a11y} type="date" className="w-fit min-w-44" {...form.register('dueDate')} />
            {dueDate ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => form.setValue('dueDate', '', { shouldDirty: true })}
              >
                {t('common.remove')}
              </Button>
            ) : null}
          </div>
        )}
      </Field>

      {courses && courses.length > 0 ? (
        <Controller
          control={form.control}
          name="courseId"
          render={({ field }) => (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={courseFieldId}>{t('teacher.assign.course')}</Label>
              <SelectField
                id={courseFieldId}
                value={field.value}
                onChange={field.onChange}
                placeholder={t('teacher.assign.noCourse')}
                options={[{ value: NO_COURSE, label: t('teacher.assign.noCourse') }, ...courses]}
              />
              <p className="text-xs text-muted-foreground">{t('teacher.assign.courseHint')}</p>
            </div>
          )}
        />
      ) : null}
    </TeachSheet>
  )
}

/** The student's tick on a line being edited; read-only, the student owns it. */
function TickMarker({ done }: { done: boolean }) {
  const t = useT()
  const label = done ? t('teacher.assign.itemDone') : t('teacher.assign.itemOpen')
  return (
    <span
      title={label}
      className={cn(
        'flex size-8 shrink-0 items-center justify-center',
        done ? 'text-held' : 'text-muted-foreground',
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
