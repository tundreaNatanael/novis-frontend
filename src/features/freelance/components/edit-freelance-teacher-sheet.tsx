import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { isApiError } from '@/api/errors'
import { freelanceTeacherKeys, freelanceTeachersApi } from '@/api/freelance-teachers'
import type { User } from '@/api/types'
import { userKeys } from '@/api/users'
import { Field } from '@/components/form/field'
import { FormError } from '@/components/form/form-error'
import { FormSheet } from '@/components/form/form-sheet'
import { applyServerErrors } from '@/components/form/server-errors'
import { Input } from '@/components/ui/input'
import { emailSchema, nameSchema } from '@/lib/schemas'

const schema = z.object({ name: nameSchema, email: emailSchema })
type FormValues = z.infer<typeof schema>

/**
 * `PATCH /freelance-teachers/{id}` with the changed name and email only. Status has its own
 * Disable / Re-enable action (`FreelanceStatusDialog`).
 */
export function EditFreelanceTeacherSheet({
  teacher,
  open,
  onOpenChange,
}: {
  teacher: User
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const [formError, setFormError] = useState<string | null>(null)
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: teacher.name, email: teacher.email },
  })

  useEffect(() => {
    if (open) {
      form.reset({ name: teacher.name, email: teacher.email })
      setFormError(null)
    }
  }, [open, teacher, form])

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      freelanceTeachersApi.update(teacher.id, {
        ...(values.name !== teacher.name ? { name: values.name } : {}),
        ...(values.email !== teacher.email ? { email: values.email } : {}),
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: freelanceTeacherKeys.detail(teacher.id) }),
        queryClient.invalidateQueries({ queryKey: freelanceTeacherKeys.lists() }),
        queryClient.invalidateQueries({ queryKey: userKeys.detail(teacher.id) }),
        queryClient.invalidateQueries({ queryKey: userKeys.lists() }),
      ])
      toast.success('Account updated')
      onOpenChange(false)
    },
    onError: (error) => {
      // The only 409 here is an email another account already uses.
      if (isApiError(error) && error.is('CONFLICT')) {
        form.setError('email', {
          type: 'server',
          message: 'Another account already uses this email.',
        })
        setFormError(null)
      } else setFormError(applyServerErrors(error, form.setError, ['name', 'email']))
    },
  })

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Edit freelance teacher"
      description="To stop them signing in, use Disable account instead."
      submitLabel="Save changes"
      isSubmitting={mutation.isPending}
      onSubmit={form.handleSubmit((values) => {
        setFormError(null)
        mutation.mutate(values)
      })}
    >
      <FormError message={formError} />
      <Field label="Name" required error={form.formState.errors.name?.message}>
        {(a11y) => <Input {...a11y} autoFocus {...form.register('name')} />}
      </Field>
      <Field
        label="Email"
        required
        hint="Changing it changes how they sign in."
        error={form.formState.errors.email?.message}
      >
        {(a11y) => <Input {...a11y} type="email" inputMode="email" {...form.register('email')} />}
      </Field>
    </FormSheet>
  )
}
