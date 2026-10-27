import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { isApiError } from '@/api/errors'
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
import { lessonDurationSchema } from '@/lib/schemas'
import { OverlapConfirmDialog } from './overlap-confirm-dialog'

const schema = z.object({
  scheduledAt: z.string().min(1, 'Choose a date and time'),
  durationMinutes: lessonDurationSchema,
})
type FormInput = z.input<typeof schema>
type FormValues = z.output<typeof schema>

/** The length goes out only when it changed (an omitted length stays; it is never `null`). */
function lengthChange(value: number, current: number) {
  return value === current ? {} : { durationMinutes: value }
}

function defaultsFor(lesson: Lesson): FormInput {
  return {
    scheduledAt: toDateTimeLocal(lesson.scheduledAt),
    durationMinutes: lesson.durationMinutes,
  }
}

interface Props {
  lesson: Lesson
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * `PATCH /lessons/{id}/schedule`: set or move the date and change the length; `scheduledAt: null`
 * unschedules (the meeting link is the teacher and student's, D-057). Pending lessons only. A new slot that overlaps
 * another lesson of the teacher or the student (`409 SCHEDULE_CONFLICT`) is confirmed, then sent
 * again with `allowOverlap`.
 */
export function ScheduleLessonSheet({ lesson, open, onOpenChange }: Props) {
  const queryClient = useQueryClient()
  const [formError, setFormError] = useState<string | null>(null)
  const [overlapping, setOverlapping] = useState<FormValues | null>(null)
  const form = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaultsFor(lesson),
  })

  useEffect(() => {
    if (open) {
      form.reset(defaultsFor(lesson))
      setFormError(null)
      setOverlapping(null)
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
    mutationFn: ({ values, allowOverlap }: { values: FormValues; allowOverlap: boolean }) =>
      lessonsApi.schedule(lesson.id, {
        scheduledAt: fromDateTimeLocal(values.scheduledAt),
        ...lengthChange(values.durationMinutes, lesson.durationMinutes),
        ...(allowOverlap ? { allowOverlap: true } : {}),
      }),
    onSuccess: async () => {
      await invalidate()
      toast.success(lesson.scheduledAt ? 'Lesson rescheduled' : 'Lesson scheduled')
      onOpenChange(false)
    },
    onError: (error, { values, allowOverlap }) => {
      // A resend that allows the overlap reports its error in the confirmation.
      if (allowOverlap) return
      if (isApiError(error) && error.is('SCHEDULE_CONFLICT')) {
        setOverlapping(values)
        return
      }
      setFormError(applyServerErrors(error, form.setError, ['scheduledAt', 'durationMinutes']))
    },
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
    <>
      <FormSheet
        open={open}
        onOpenChange={onOpenChange}
        title={lesson.scheduledAt ? 'Reschedule lesson' : 'Schedule lesson'}
        description="Only pending lessons can be scheduled or moved. An unscheduled paid lesson is a prepaid credit waiting for a date."
        submitLabel={lesson.scheduledAt ? 'Move lesson' : 'Schedule lesson'}
        isSubmitting={mutation.isPending || unschedule.isPending}
        onSubmit={form.handleSubmit((values) => {
          setFormError(null)
          mutation.mutate({ values, allowOverlap: false })
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
          label="Length (minutes)"
          required
          hint="15–240 minutes."
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
      </FormSheet>
      <OverlapConfirmDialog
        open={overlapping !== null}
        onOpenChange={(next) => {
          if (!next) setOverlapping(null)
        }}
        confirmLabel={lesson.scheduledAt ? 'Move anyway' : 'Schedule anyway'}
        onConfirm={() =>
          overlapping
            ? mutation.mutateAsync({ values: overlapping, allowOverlap: true })
            : undefined
        }
      />
    </>
  )
}
