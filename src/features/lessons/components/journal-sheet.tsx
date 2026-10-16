import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { lessonKeys, lessonsApi } from '@/api/lessons'
import type { Lesson } from '@/api/types'
import { Field } from '@/components/form/field'
import { FormError } from '@/components/form/form-error'
import { FormSheet } from '@/components/form/form-sheet'
import { applyServerErrors } from '@/components/form/server-errors'
import { Textarea } from '@/components/ui/textarea'
import { longTextSchema } from '@/lib/schemas'

const schema = z.object({ journal: longTextSchema })
type FormValues = z.infer<typeof schema>

/** `PATCH /lessons/{id}/journal`: the teacher's note, editable any time after closing. */
export function JournalSheet({
  lesson,
  open,
  onOpenChange,
}: {
  lesson: Lesson
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const [formError, setFormError] = useState<string | null>(null)
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { journal: lesson.journal ?? '' },
  })

  useEffect(() => {
    if (open) {
      form.reset({ journal: lesson.journal ?? '' })
      setFormError(null)
    }
  }, [open, lesson, form])

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      lessonsApi.updateJournal(lesson.id, { journal: values.journal.trim() }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: lessonKeys.detail(lesson.id) })
      toast.success('Journal saved')
      onOpenChange(false)
    },
    onError: (error) => setFormError(applyServerErrors(error, form.setError, ['journal'])),
  })

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Edit journal"
      description="What happened in the lesson, for the student and parents."
      submitLabel="Save journal"
      isSubmitting={mutation.isPending}
      onSubmit={form.handleSubmit((values) => {
        setFormError(null)
        mutation.mutate(values)
      })}
    >
      <FormError message={formError} />
      <Field
        label="Journal"
        hint="Up to 4000 characters."
        error={form.formState.errors.journal?.message}
      >
        {(a11y) => <Textarea {...a11y} rows={8} autoFocus {...form.register('journal')} />}
      </Field>
    </FormSheet>
  )
}
