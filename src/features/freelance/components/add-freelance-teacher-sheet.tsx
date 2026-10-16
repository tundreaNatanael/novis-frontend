import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import type { User } from '@/api/types'
import { userKeys, usersApi } from '@/api/users'
import { Field } from '@/components/form/field'
import { FormError } from '@/components/form/form-error'
import { FormSheet } from '@/components/form/form-sheet'
import { PasswordField } from '@/components/form/password-field'
import { applyServerErrors } from '@/components/form/server-errors'
import { Input } from '@/components/ui/input'
import { emailSchema, nameSchema, passwordSchema } from '@/lib/schemas'

const schema = z.object({ email: emailSchema, name: nameSchema, password: passwordSchema })
type FormValues = z.infer<typeof schema>

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (teacher: User) => void
}

/** `POST /freelance-teachers`: a password account with no organization, usable at once (gap G1-B). */
export function AddFreelanceTeacherSheet({ open, onOpenChange, onCreated }: Props) {
  const queryClient = useQueryClient()
  const [formError, setFormError] = useState<string | null>(null)
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', name: '', password: '' },
  })

  useEffect(() => {
    if (open) {
      form.reset({ email: '', name: '', password: '' })
      setFormError(null)
    }
  }, [open, form])

  const mutation = useMutation({
    mutationFn: (values: FormValues) => usersApi.createFreelanceTeacher(values),
    onSuccess: async (teacher) => {
      await queryClient.invalidateQueries({ queryKey: userKeys.lists() })
      toast.success('Freelance teacher created')
      onOpenChange(false)
      onCreated(teacher)
    },
    onError: (error) =>
      setFormError(applyServerErrors(error, form.setError, ['email', 'name', 'password'])),
  })

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Add freelance teacher"
      description="A teacher who belongs to no organization. They manage their own students and courses in the Novis app."
      submitLabel="Create teacher"
      isSubmitting={mutation.isPending}
      onSubmit={form.handleSubmit((values) => {
        setFormError(null)
        mutation.mutate(values)
      })}
    >
      <FormError message={formError} />
      <Field label="Email" required error={form.formState.errors.email?.message}>
        {(a11y) => (
          <Input
            {...a11y}
            type="email"
            inputMode="email"
            autoComplete="off"
            autoFocus
            {...form.register('email')}
          />
        )}
      </Field>
      <Field label="Name" required error={form.formState.errors.name?.message}>
        {(a11y) => <Input {...a11y} autoComplete="off" {...form.register('name')} />}
      </Field>
      <Field
        label="Password"
        required
        hint="8 to 128 characters. Share it privately; they can change it or ask for a reset link."
        error={form.formState.errors.password?.message}
      >
        {(a11y) => (
          <Controller
            control={form.control}
            name="password"
            render={({ field }) => (
              <PasswordField {...a11y} value={field.value} onChange={field.onChange} generate />
            )}
          />
        )}
      </Field>
    </FormSheet>
  )
}
