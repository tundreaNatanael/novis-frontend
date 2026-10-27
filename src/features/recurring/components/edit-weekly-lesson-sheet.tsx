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
import type { RecurringLesson, UpdateRecurringLessonRequest, Weekday } from '@/api/types'
import { Field } from '@/components/form/field'
import { FormError } from '@/components/form/form-error'
import { FormSheet } from '@/components/form/form-sheet'
import { SelectField } from '@/components/form/select-field'
import { applyServerErrors } from '@/components/form/server-errors'
import { Input } from '@/components/ui/input'
import { OverlapConfirmDialog } from '@/features/lessons/components/overlap-confirm-dialog'
import { formatDate } from '@/lib/format'
import { lessonDurationSchema, optionalHttpsUrl } from '@/lib/schemas'
import { useDebouncedValue } from '@/lib/use-debounced-value'
import {
  REPEAT_OPTIONS,
  WEEKDAYS,
  browserTimeZone,
  describeRule,
  recurringChangeBody,
  todayIn,
  weekdayLabel,
  zoneDiffers,
} from '../recurring-state'
import { OccurrencePreview } from './occurrence-preview'

const WEEKDAY_VALUES = WEEKDAYS as [Weekday, ...Weekday[]]

const schema = z.object({
  effectiveFrom: z.string().min(1, 'Choose the date the change starts'),
  weekday: z.enum(WEEKDAY_VALUES),
  localTime: z.string().regex(/^\d{2}:\d{2}$/, 'Choose a time'),
  intervalWeeks: z.enum(['1', '2']).transform((value) => (value === '2' ? 2 : 1) as 1 | 2),
  durationMinutes: lessonDurationSchema,
  meetingUrl: optionalHttpsUrl,
})
type FormInput = z.input<typeof schema>
type FormValues = z.output<typeof schema>

const WEEKDAY_OPTIONS = WEEKDAYS.map((weekday) => ({
  value: weekday,
  label: weekdayLabel(weekday),
}))

function defaultsFor(rule: RecurringLesson): FormInput {
  return {
    effectiveFrom: todayIn(rule.timeZone),
    weekday: rule.weekday,
    localTime: rule.localTime,
    intervalWeeks: rule.intervalWeeks === 2 ? '2' : '1',
    durationMinutes: rule.durationMinutes,
    meetingUrl: rule.meetingUrl ?? '',
  }
}

function toBody(rule: RecurringLesson, values: FormValues): UpdateRecurringLessonRequest | null {
  return recurringChangeBody(rule, {
    effectiveFrom: values.effectiveFrom,
    weekday: values.weekday,
    localTime: values.localTime,
    intervalWeeks: values.intervalWeeks,
    durationMinutes: values.durationMinutes,
    meetingUrl: values.meetingUrl,
  })
}

interface Props {
  rule: RecurringLesson
  studentName: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * `PATCH /recurring-lessons/{id}` from a date: the weekday, time (in the rule's own zone), repeat,
 * length and link from `effectiveFrom` on; the past is left alone. Only what changed goes out (an
 * emptied link as `null`; nothing changed sends nothing). The dates from that day are previewed
 * with a dry run as the form changes; a `409 SCHEDULE_CONFLICT` asks before changing it anyway.
 * When the change starts after the rule did, the API splits the rule and answers a new one: the
 * toast says so, and the list is refreshed either way.
 */
export function EditWeeklyLessonSheet({ rule, studentName, open, onOpenChange }: Props) {
  const queryClient = useQueryClient()
  const [formError, setFormError] = useState<string | null>(null)
  const [overlapping, setOverlapping] = useState<UpdateRecurringLessonRequest | null>(null)
  const otherZone = zoneDiffers(
    rule,
    useMemo(() => browserTimeZone(), []),
  )
  const form = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaultsFor(rule),
  })
  const values = form.watch()

  useEffect(() => {
    if (open) {
      form.reset(defaultsFor(rule))
      setFormError(null)
      setOverlapping(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when the sheet opens
  }, [open, rule.id])

  const parsed = schema.safeParse(values)
  const planBody = useMemo(
    () => (parsed.success ? toBody(rule, parsed.data) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed by the typed values
    [JSON.stringify(values), rule, parsed.success],
  )
  const debouncedBody = useDebouncedValue(open ? planBody : null)
  const plan = useQuery({
    queryKey: recurringLessonKeys.changePlan(rule.id, debouncedBody),
    queryFn: () => recurringLessonsApi.planChange(rule.id, debouncedBody!),
    enabled: debouncedBody !== null,
    retry: false,
    staleTime: 30_000,
  })

  const mutation = useMutation({
    mutationFn: ({ body }: { body: UpdateRecurringLessonRequest; allowOverlap: boolean }) =>
      recurringLessonsApi.change(rule.id, body),
    onSuccess: async (detail, { body }) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: recurringLessonKeys.all }),
        queryClient.invalidateQueries({ queryKey: lessonKeys.all }),
        queryClient.invalidateQueries({ queryKey: studentKeys.all }),
      ])
      toast.success(`Weekly lesson changed from ${formatDate(body.effectiveFrom)}`, {
        description:
          detail.rule.id === rule.id
            ? describeRule(detail.rule)
            : `${describeRule(detail.rule)}. Until then it stays as it was; its lessons that still followed the rule were moved.`,
      })
      onOpenChange(false)
    },
    onError: (error, { body, allowOverlap }) => {
      if (allowOverlap) return
      if (isApiError(error) && error.is('SCHEDULE_CONFLICT')) {
        setOverlapping(body)
        return
      }
      if (isApiError(error) && error.isNotFound) {
        setFormError('This weekly lesson no longer exists or is out of your reach.')
        void queryClient.invalidateQueries({ queryKey: recurringLessonKeys.all })
        return
      }
      setFormError(
        applyServerErrors(error, form.setError, [
          'effectiveFrom',
          'weekday',
          'localTime',
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
        title="Change weekly lesson"
        description={`${describeRule(rule)} for ${studentName}. The change applies from the date you pick; lessons before it keep their time, and lessons someone changed by hand are left alone.`}
        submitLabel={
          parsed.success
            ? `Apply from ${formatDate(parsed.data.effectiveFrom)}`
            : 'Apply the change'
        }
        isSubmitting={mutation.isPending}
        onSubmit={form.handleSubmit((parsedValues) => {
          setFormError(null)
          const body = toBody(rule, parsedValues)
          if (!body) {
            setFormError('Nothing to change: the weekly lesson already has these settings.')
            return
          }
          mutation.mutate({ body, allowOverlap: false })
        })}
      >
        <FormError message={formError} />
        <Field
          label="From which date"
          required
          hint={`Today or later${otherZone ? `, in ${rule.timeZone}` : ''}. The lessons from this date on move with the change.`}
          error={form.formState.errors.effectiveFrom?.message}
        >
          {(a11y) => (
            <Input
              {...a11y}
              type="date"
              min={todayIn(rule.timeZone)}
              {...form.register('effectiveFrom')}
            />
          )}
        </Field>
        <Field label="Weekday" required error={form.formState.errors.weekday?.message}>
          {(a11y) => (
            <Controller
              control={form.control}
              name="weekday"
              render={({ field }) => (
                <SelectField
                  id={a11y.id}
                  value={field.value}
                  onChange={field.onChange}
                  options={WEEKDAY_OPTIONS}
                />
              )}
            />
          )}
        </Field>
        <Field
          label="Time"
          required
          hint={
            otherZone
              ? `In the weekly lesson’s own zone, ${rule.timeZone}, not yours.`
              : 'The lesson keeps this time across clock changes.'
          }
          error={form.formState.errors.localTime?.message}
        >
          {(a11y) => <Input {...a11y} type="time" step={300} {...form.register('localTime')} />}
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
        <Field
          label="Meeting link"
          hint={
            rule.meetingUrl
              ? 'Emptying the field removes the link from the lessons that follow the rule.'
              : 'Optional absolute https:// link every lesson gets as “Join lesson”.'
          }
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
          title="Dates after the change"
          plan={plan.data}
          durationMinutes={parsed.success ? parsed.data.durationMinutes : rule.durationMinutes}
          isPending={debouncedBody !== null && plan.isPending}
          error={plan.error}
          idleText="Change a setting to see the dates it would book."
        />
      </FormSheet>
      <OverlapConfirmDialog
        open={overlapping !== null}
        onOpenChange={(next) => {
          if (!next) setOverlapping(null)
        }}
        confirmLabel="Change it anyway"
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
