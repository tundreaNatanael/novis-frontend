import { zodResolver } from '@hookform/resolvers/zod'
import { Check, Loader2 } from 'lucide-react'
import { useEffect, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { Field } from '@/components/form/field'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { TeachSheet } from '../components/teach-sheet'
import { courseUpdateBody, lessonMinutes } from '../courses/utils'
import { useCourse } from '../data/courses'
import { useCreateCourse, useUpdateCourse } from '../data/mutations'
import { useT } from '../i18n/use-i18n'
import { describeError } from '../lib/error-message'
import { applyFieldErrors } from '../lib/form'
import { makeSchemas, optionalText } from '../lib/schemas'

/** New course, or edit one: title, description, default lesson length. */
export function CourseFormSheet({
  courseId,
  open,
  onOpenChange,
}: {
  courseId?: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = useT()
  const editing = !!courseId
  const course = useCourse(courseId ?? '')
  const create = useCreateCourse()
  const update = useUpdateCourse()

  const schema = useMemo(() => {
    const s = makeSchemas(t)
    return z.object({
      title: s.name,
      description: s.longText(),
      defaultDurationMinutes: s.optionalLessonMinutes,
    })
  }, [t])
  type FormValues = z.infer<typeof schema>
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: '',
      description: '',
      defaultDurationMinutes: '',
    },
  })

  useEffect(() => {
    if (editing && course.data && !form.formState.isDirty) {
      form.reset({
        title: course.data.title,
        description: course.data.description ?? '',
        defaultDurationMinutes: course.data.defaultDurationMinutes?.toString() ?? '',
      })
    }
  }, [editing, course.data, form])

  const submit = form.handleSubmit(async (values) => {
    try {
      if (editing && courseId) {
        // An emptied description or length goes out as null: the API removes it.
        await update.mutateAsync({ id: courseId, body: courseUpdateBody(course.data, values) })
        toast.success(t('teacher.courseForm.saved'))
      } else {
        // The server derives the course's school (or freelance) from the teacher.
        await create.mutateAsync({
          title: values.title,
          description: optionalText(values.description),
          defaultDurationMinutes: lessonMinutes(values.defaultDurationMinutes),
        })
        toast.success(t('teacher.courseForm.created'))
      }
      onOpenChange(false)
    } catch (error) {
      if (
        !applyFieldErrors(error, form.setError, ['title', 'description', 'defaultDurationMinutes'])
      ) {
        toast.error(describeError(error, t))
      }
    }
  })
  const busy = create.isPending || update.isPending
  const optional = ` (${t('common.optional')})`

  return (
    <TeachSheet
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? t('teacher.courseForm.editTitle') : t('teacher.courseForm.addTitle')}
      onSubmit={() => void submit()}
      footer={
        <Button type="submit" size="lg" className="w-full rounded-full sm:w-auto" disabled={busy}>
          {busy ? (
            <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden />
          ) : (
            <Check aria-hidden />
          )}
          {editing ? t('teacher.courseForm.submitEdit') : t('teacher.courseForm.submitAdd')}
        </Button>
      }
    >
      <Field
        label={t('teacher.courseForm.titleLabel')}
        required
        error={form.formState.errors.title?.message}
      >
        {(a11y) => (
          <Input
            {...a11y}
            autoFocus
            placeholder={t('teacher.courseForm.titlePlaceholder')}
            {...form.register('title')}
          />
        )}
      </Field>
      <Field
        label={`${t('teacher.courseForm.description')}${optional}`}
        error={form.formState.errors.description?.message}
      >
        {(a11y) => (
          <Textarea
            {...a11y}
            rows={3}
            placeholder={t('teacher.courseForm.descriptionPlaceholder')}
            {...form.register('description')}
          />
        )}
      </Field>
      <Field
        label={`${t('teacher.courseForm.defaultLength')}${optional}`}
        hint={t('teacher.courseForm.defaultLengthHint')}
        error={form.formState.errors.defaultDurationMinutes?.message}
      >
        {(a11y) => (
          <Input
            {...a11y}
            inputMode="numeric"
            placeholder={t('teacher.courseForm.defaultLengthPlaceholder')}
            className="w-32"
            {...form.register('defaultDurationMinutes')}
          />
        )}
      </Field>
    </TeachSheet>
  )
}
