import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { memberKeys } from '@/api/members'
import { studentKeys, studentsApi } from '@/api/students'
import type { Student } from '@/api/types'
import { userKeys } from '@/api/users'
import { Field } from '@/components/form/field'
import { FormError } from '@/components/form/form-error'
import { FormSheet } from '@/components/form/form-sheet'
import { SelectField } from '@/components/form/select-field'
import { applyServerErrors } from '@/components/form/server-errors'
import { Input } from '@/components/ui/input'
import { emailSchema, nameSchema } from '@/lib/schemas'

const schema = z.object({
  name: nameSchema,
  email: emailSchema,
  status: z.enum(['ACTIVE', 'DISABLED']),
})
type FormValues = z.infer<typeof schema>

interface EditStudentSheetProps {
  student: Student
  /** Email and status are global identity: super-admin, or an admin covering every link of the student. */
  canEditIdentity: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** `PATCH /students/{id}`. */
export function EditStudentSheet({
  student,
  canEditIdentity,
  open,
  onOpenChange,
}: EditStudentSheetProps) {
  const queryClient = useQueryClient()
  const [formError, setFormError] = useState<string | null>(null)
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: student.name, email: student.email, status: student.status },
  })

  useEffect(() => {
    if (open) {
      form.reset({ name: student.name, email: student.email, status: student.status })
      setFormError(null)
    }
  }, [open, student, form])

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      studentsApi.update(student.id, {
        ...(values.name !== student.name ? { name: values.name } : {}),
        ...(canEditIdentity && values.email !== student.email ? { email: values.email } : {}),
        ...(canEditIdentity && values.status !== student.status ? { status: values.status } : {}),
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: studentKeys.detail(student.id) }),
        queryClient.invalidateQueries({ queryKey: studentKeys.lists() }),
        queryClient.invalidateQueries({ queryKey: userKeys.detail(student.id) }),
        queryClient.invalidateQueries({ queryKey: memberKeys.all }),
      ])
      toast.success('Student updated')
      onOpenChange(false)
    },
    onError: (error) =>
      setFormError(applyServerErrors(error, form.setError, ['name', 'email', 'status'])),
  })

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Edit student"
      description={
        canEditIdentity
          ? undefined
          : 'Email and status can be changed only by the platform owner or an admin of every organization the student belongs to.'
      }
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
      {canEditIdentity ? (
        <>
          <Field
            label="Email"
            required
            hint="Students sign in with this address."
            error={form.formState.errors.email?.message}
          >
            {(a11y) => (
              <Input {...a11y} type="email" inputMode="email" {...form.register('email')} />
            )}
          </Field>
          <Field
            label="Status"
            hint="Disabled students cannot sign in."
            error={form.formState.errors.status?.message}
          >
            {(a11y) => (
              <Controller
                control={form.control}
                name="status"
                render={({ field }) => (
                  <SelectField
                    id={a11y.id}
                    value={field.value}
                    onChange={field.onChange}
                    options={[
                      { value: 'ACTIVE', label: 'Active' },
                      { value: 'DISABLED', label: 'Disabled' },
                    ]}
                  />
                )}
              />
            )}
          </Field>
        </>
      ) : null}
    </FormSheet>
  )
}
