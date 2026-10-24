import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { isApiError } from '@/api/errors'
import { lessonKeys } from '@/api/lessons'
import { teacherPayoutKeys, teacherPayoutsApi } from '@/api/teacher-payouts'
import type { CreateTeacherPayoutRequest } from '@/api/types'
import { Field } from '@/components/form/field'
import { FormError } from '@/components/form/form-error'
import { FormSheet } from '@/components/form/form-sheet'
import { applyServerErrors } from '@/components/form/server-errors'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { formatDate, pluralize } from '@/lib/format'
import { longTextSchema } from '@/lib/schemas'
import { isPaidOnAllowed, todayInput, upToInstant } from '../payout-state'

/** The lessons ticked in the table, or every payable lesson up to a day. */
export type PayoutSelection = { kind: 'lessons'; lessonIds: string[] } | { kind: 'upTo' }

const schema = z.object({
  upToDay: z.string(),
  paidOn: z
    .string()
    .min(1, 'Choose the day the organization paid')
    .refine((day) => isPaidOnAllowed(day), 'The day the organization paid cannot be in the future'),
  note: longTextSchema,
})
type FormValues = z.infer<typeof schema>

interface Props {
  orgId: string
  teacher: { id: string; name: string }
  selection: PayoutSelection
  open: boolean
  onOpenChange: (open: boolean) => void
  /** After a payout was recorded, or the lists changed under the admin (`409`). */
  onSettled: () => void
}

/**
 * `POST /orgs/{orgId}/teacher-payouts` (API.md §9.6): the ticked lessons, or every payable lesson
 * up to and including a day, paid on a day, with an optional note. All or nothing: a `409` means
 * someone paid some of them meanwhile, so the lists are refreshed.
 */
export function RecordPayoutSheet({
  orgId,
  teacher,
  selection,
  open,
  onOpenChange,
  onSettled,
}: Props) {
  const queryClient = useQueryClient()
  const [formError, setFormError] = useState<string | null>(null)
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { upToDay: todayInput(), paidOn: todayInput(), note: '' },
  })

  useEffect(() => {
    if (open) {
      form.reset({ upToDay: todayInput(), paidOn: todayInput(), note: '' })
      setFormError(null)
    }
  }, [open, form])

  const upToDay = form.watch('upToDay')
  const upTo = selection.kind === 'upTo' ? upToInstant(upToDay) : null
  // How many lessons "up to" pays: the payable list's total, one row fetched.
  const upToFilters = { to: upTo ?? undefined }
  const upToCount = useQuery({
    queryKey: teacherPayoutKeys.payable(orgId, teacher.id, upToFilters, { page: 0, size: 1 }),
    queryFn: ({ signal }) =>
      teacherPayoutsApi.payableLessons(
        orgId,
        teacher.id,
        upToFilters,
        { page: 0, size: 1 },
        signal,
      ),
    enabled: open && selection.kind === 'upTo' && upTo !== null,
    select: (page) => page.totalElements,
  })
  const lessonCount = selection.kind === 'lessons' ? selection.lessonIds.length : upToCount.data
  const nothingToPay = selection.kind === 'upTo' && upToCount.data === 0

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      const body: CreateTeacherPayoutRequest = { teacherId: teacher.id, paidOn: values.paidOn }
      if (selection.kind === 'lessons') body.lessonIds = selection.lessonIds
      else body.upTo = upToInstant(values.upToDay) ?? undefined
      if (values.note) body.note = values.note
      return teacherPayoutsApi.create(orgId, body)
    },
    onSuccess: async (detail) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: teacherPayoutKeys.all }),
        queryClient.invalidateQueries({ queryKey: lessonKeys.all }),
      ])
      toast.success('Payout recorded', {
        description: `${pluralize(detail.payout.lessonCount, 'lesson')} paid to ${teacher.name} on ${formatDate(detail.payout.paidOn)}.`,
      })
      onSettled()
      onOpenChange(false)
    },
    onError: (error) => {
      setFormError(applyServerErrors(error, form.setError, ['paidOn', 'note']))
      if (isApiError(error) && error.isConflict) {
        void queryClient.invalidateQueries({ queryKey: teacherPayoutKeys.all })
        onSettled()
      }
    },
  })

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Record payout"
      description={`What the organization paid ${teacher.name} for their lessons. Counted in lessons; the note may say how much and how. Not the students’ payments.`}
      submitLabel={
        lessonCount === undefined
          ? 'Record payout'
          : `Record payout of ${pluralize(lessonCount, 'lesson')}`
      }
      isSubmitting={mutation.isPending}
      onSubmit={form.handleSubmit((values) => {
        setFormError(null)
        if (nothingToPay) {
          setFormError('Nothing up to that day is left to pay out.')
          return
        }
        mutation.mutate(values)
      })}
    >
      <FormError message={formError} />
      {selection.kind === 'upTo' ? (
        <Field
          label="Pay everything up to"
          required
          hint={
            upToCount.data === undefined
              ? 'Every held or late-canceled lesson until the end of this day that is not paid out yet.'
              : upToCount.data === 0
                ? 'Nothing up to that day is left to pay out.'
                : `${pluralize(upToCount.data, 'lesson')} up to and including ${formatDate(upToDay)}.`
          }
        >
          {(a11y) => <Input {...a11y} type="date" autoFocus {...form.register('upToDay')} />}
        </Field>
      ) : (
        <p className="text-sm text-muted-foreground">
          {pluralize(selection.lessonIds.length, 'lesson')} selected in the table.
        </p>
      )}
      <Field
        label="Paid on"
        required
        hint="The day the organization paid the teacher."
        error={form.formState.errors.paidOn?.message}
      >
        {(a11y) => <Input {...a11y} type="date" max={todayInput()} {...form.register('paidOn')} />}
      </Field>
      <Field
        label="Note"
        hint="Optional, up to 4000 characters, e.g. “1,200 RON, bank transfer”."
        error={form.formState.errors.note?.message}
      >
        {(a11y) => <Textarea {...a11y} rows={3} {...form.register('note')} />}
      </Field>
    </FormSheet>
  )
}
