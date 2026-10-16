import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Controller, useFieldArray, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { lessonKeys, lessonsApi } from '@/api/lessons'
import { studentKeys } from '@/api/students'
import type { Lesson, LessonOutcome } from '@/api/types'
import { Field } from '@/components/form/field'
import { FormError } from '@/components/form/form-error'
import { FormSheet } from '@/components/form/form-sheet'
import { applyServerErrors } from '@/components/form/server-errors'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { longTextSchema } from '@/lib/schemas'

const schema = z.object({
  status: z.enum(['PRESENT', 'CANCELED', 'CANCELED_LATE']),
  journal: longTextSchema,
  homeworkNotes: longTextSchema,
  items: z
    .array(z.object({ text: z.string().trim().max(2000, 'At most 2000 characters') }))
    .max(100),
})
type FormValues = z.infer<typeof schema>

const OUTCOMES: { value: LessonOutcome; label: string; description: string }[] = [
  {
    value: 'PRESENT',
    label: 'Held',
    description: 'The lesson took place. Charged: it counts as unpaid due unless already paid.',
  },
  {
    value: 'CANCELED',
    label: 'Canceled on time',
    description:
      'Not charged. If the lesson was paid, its credit rolls over into a new unscheduled lesson. Journal and homework are discarded.',
  },
  {
    value: 'CANCELED_LATE',
    label: 'Canceled late',
    description: 'Charged like a held lesson; no credit rolls over.',
  },
]

interface Props {
  lesson: Lesson
  open: boolean
  onOpenChange: (open: boolean) => void
  onClosed?: (rolledOverToLessonId: string | null) => void
}

/** `POST /lessons/{id}/close`: outcome, journal and optional homework in one call. Needs a date. */
export function CloseLessonSheet({ lesson, open, onOpenChange, onClosed }: Props) {
  const queryClient = useQueryClient()
  const [formError, setFormError] = useState<string | null>(null)
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { status: 'PRESENT', journal: '', homeworkNotes: '', items: [] },
  })
  const items = useFieldArray({ control: form.control, name: 'items' })

  useEffect(() => {
    if (open) {
      form.reset({ status: 'PRESENT', journal: '', homeworkNotes: '', items: [] })
      setFormError(null)
    }
  }, [open, form])

  const status = form.watch('status')
  const charged = status !== 'CANCELED'

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      const itemTexts = values.items.map((i) => i.text.trim()).filter(Boolean)
      const homework =
        values.homeworkNotes.trim() || itemTexts.length > 0
          ? {
              ...(values.homeworkNotes.trim() ? { notes: values.homeworkNotes.trim() } : {}),
              ...(itemTexts.length ? { items: itemTexts } : {}),
            }
          : undefined
      return lessonsApi.close(lesson.id, {
        status: values.status,
        ...(charged && values.journal.trim() ? { journal: values.journal.trim() } : {}),
        ...(charged && homework ? { homework } : {}),
      })
    },
    onSuccess: async (detail) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: lessonKeys.all }),
        queryClient.invalidateQueries({ queryKey: studentKeys.all }),
      ])
      toast.success(
        detail.lesson.status === 'PRESENT'
          ? 'Lesson closed as held'
          : detail.lesson.status === 'CANCELED'
            ? 'Lesson canceled'
            : 'Lesson closed as canceled late',
      )
      if (detail.rolledOverToLessonId)
        toast.info('Prepaid credit rolled over into a new unscheduled lesson')
      onOpenChange(false)
      onClosed?.(detail.rolledOverToLessonId)
    },
    onError: (error) =>
      setFormError(applyServerErrors(error, form.setError, ['status', 'journal'])),
  })

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Close lesson"
      description="Closing is final: a closed lesson cannot be reopened. The journal stays editable afterwards."
      submitLabel="Close lesson"
      isSubmitting={mutation.isPending}
      onSubmit={form.handleSubmit((values) => {
        setFormError(null)
        mutation.mutate(values)
      })}
    >
      <FormError message={formError} />
      <Controller
        control={form.control}
        name="status"
        render={({ field }) => (
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-medium text-foreground">Outcome</legend>
            {OUTCOMES.map((outcome) => (
              <Label
                key={outcome.value}
                className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3 font-normal has-[:checked]:border-primary"
              >
                <input
                  type="radio"
                  name="status"
                  value={outcome.value}
                  checked={field.value === outcome.value}
                  onChange={() => field.onChange(outcome.value)}
                  className="mt-1 size-4 accent-primary"
                />
                <span className="flex flex-col gap-0.5">
                  <span className="font-medium text-foreground">{outcome.label}</span>
                  <span className="text-xs text-muted-foreground">{outcome.description}</span>
                </span>
              </Label>
            ))}
          </fieldset>
        )}
      />
      {charged ? (
        <>
          <Field
            label="Journal"
            hint="The teacher's note for the student and parents. Up to 4000 characters; editable later."
            error={form.formState.errors.journal?.message}
          >
            {(a11y) => <Textarea {...a11y} rows={4} {...form.register('journal')} />}
          </Field>
          <fieldset className="flex flex-col gap-3 rounded-lg border border-border p-3">
            <legend className="px-1 text-sm font-medium text-foreground">
              Homework (optional)
            </legend>
            <Field label="Notes" error={form.formState.errors.homeworkNotes?.message}>
              {(a11y) => <Textarea {...a11y} rows={2} {...form.register('homeworkNotes')} />}
            </Field>
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium text-foreground">Checklist</span>
              {items.fields.map((item, index) => (
                <div key={item.id} className="flex items-center gap-2">
                  <Input
                    aria-label={`Checklist item ${index + 1}`}
                    placeholder="Practise the C major scale"
                    {...form.register(`items.${index}.text`)}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => items.remove(index)}
                    aria-label={`Remove item ${index + 1}`}
                  >
                    <X aria-hidden />
                  </Button>
                </div>
              ))}
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
            </div>
          </fieldset>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          An on-time cancellation keeps no journal and hands out no homework.
        </p>
      )}
    </FormSheet>
  )
}
