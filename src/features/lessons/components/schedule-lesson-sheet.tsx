import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { lessonKeys, lessonsApi } from '@/api/lessons'
import { studentKeys } from '@/api/students'
import type { Lesson } from '@/api/types'
import { Field } from '@/components/form/field'
import { FormError } from '@/components/form/form-error'
import { FormSheet } from '@/components/form/form-sheet'
import { applyServerErrors } from '@/components/form/server-errors'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { fromDateTimeLocal, toDateTimeLocal } from '@/lib/format'
import { optionalHttpsUrl } from '@/lib/schemas'

const schema = z.object({
  scheduledAt: z.string().min(1, 'Choose a date and time'),
  meetingUrl: optionalHttpsUrl,
})
type FormValues = z.infer<typeof schema>

interface Props {
  lesson: Lesson
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** `PATCH /lessons/{id}/schedule`: set or move the date and the meeting link; `scheduledAt: null` unschedules. Pending lessons only. */
export function ScheduleLessonSheet({ lesson, open, onOpenChange }: Props) {
  const queryClient = useQueryClient()
  const [formError, setFormError] = useState<string | null>(null)
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      scheduledAt: toDateTimeLocal(lesson.scheduledAt),
      meetingUrl: lesson.meetingUrl ?? '',
    },
  })

  useEffect(() => {
    if (open) {
      form.reset({
        scheduledAt: toDateTimeLocal(lesson.scheduledAt),
        meetingUrl: lesson.meetingUrl ?? '',
      })
      setFormError(null)
    }
  }, [open, lesson, form])

  const invalidate = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: lessonKeys.detail(lesson.id) }),
      queryClient.invalidateQueries({ queryKey: lessonKeys.lists() }),
      queryClient.invalidateQueries({
        queryKey: studentKeys.summary(lesson.studentId, lesson.teacherId),
      }),
      queryClient.invalidateQueries({ queryKey: studentKeys.summary(lesson.studentId, null) }),
    ])

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      lessonsApi.schedule(lesson.id, {
        scheduledAt: fromDateTimeLocal(values.scheduledAt),
        ...(values.meetingUrl !== (lesson.meetingUrl ?? '') && values.meetingUrl
          ? { meetingUrl: values.meetingUrl }
          : {}),
      }),
    onSuccess: async () => {
      await invalidate()
      toast.success(lesson.scheduledAt ? 'Lesson rescheduled' : 'Lesson scheduled')
      onOpenChange(false)
    },
    onError: (error) =>
      setFormError(applyServerErrors(error, form.setError, ['scheduledAt', 'meetingUrl'])),
  })
  const unschedule = useMutation({
    mutationFn: () => lessonsApi.schedule(lesson.id, { scheduledAt: null }),
    onSuccess: async () => {
      await invalidate()
      toast.success('Lesson unscheduled')
      onOpenChange(false)
    },
    onError: (error) => setFormError(applyServerErrors(error, form.setError, [])),
  })

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title={lesson.scheduledAt ? 'Reschedule lesson' : 'Schedule lesson'}
      description="Only pending lessons can be scheduled or moved. An unscheduled paid lesson is a prepaid credit waiting for a date."
      submitLabel={lesson.scheduledAt ? 'Move lesson' : 'Schedule lesson'}
      isSubmitting={mutation.isPending || unschedule.isPending}
      onSubmit={form.handleSubmit((values) => {
        setFormError(null)
        mutation.mutate(values)
      })}
      footerStart={
        lesson.scheduledAt ? (
          <Button
            type="button"
            variant="ghost"
            onClick={() => unschedule.mutate()}
            disabled={unschedule.isPending}
          >
            Unschedule
          </Button>
        ) : null
      }
    >
      <FormError message={formError} />
      <Field
        label="Date and time"
        required
        hint="Your local time; past dates are allowed."
        error={form.formState.errors.scheduledAt?.message}
      >
        {(a11y) => (
          <Input {...a11y} type="datetime-local" autoFocus {...form.register('scheduledAt')} />
        )}
      </Field>
      <Field
        label="Meeting link"
        hint="Absolute https:// link. Leave as is to keep the current one."
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
    </FormSheet>
  )
}
