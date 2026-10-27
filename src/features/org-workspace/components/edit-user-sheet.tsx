import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { memberKeys } from '@/api/members'
import type { User } from '@/api/types'
import { userKeys, usersApi } from '@/api/users'
import { Field } from '@/components/form/field'
import { FormError } from '@/components/form/form-error'
import { FormSheet } from '@/components/form/form-sheet'
import { SelectField } from '@/components/form/select-field'
import { applyServerErrors } from '@/components/form/server-errors'
import { Input } from '@/components/ui/input'
import type { Capabilities } from '@/lib/permissions'
import { emailSchema, nameSchema, optionalWhatsAppNumber } from '@/lib/schemas'
import { whatsAppNumberChange } from '@/lib/whatsapp'

const schema = z.object({
  name: nameSchema,
  email: emailSchema,
  status: z.enum(['ACTIVE', 'DISABLED']),
  whatsappNumber: optionalWhatsAppNumber,
})
type FormValues = z.infer<typeof schema>

interface EditUserSheetProps {
  user: User
  capabilities: Capabilities
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * `PATCH /users/{id}`: name for anyone allowed to edit, email / status only where the server lets
 * this caller, a teacher's WhatsApp number (emptied → removed).
 */
export function EditUserSheet({ user, capabilities, open, onOpenChange }: EditUserSheetProps) {
  const queryClient = useQueryClient()
  const [formError, setFormError] = useState<string | null>(null)
  const canEmail = capabilities.canEditEmail(user)
  const canStatus = capabilities.canEditStatus
  const canWhatsApp = capabilities.canEditWhatsAppNumber(user)
  const initialValues = (): FormValues => ({
    name: user.name,
    email: user.email,
    status: user.status,
    whatsappNumber: user.whatsappNumber ?? '',
  })
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: initialValues(),
  })

  useEffect(() => {
    if (open) {
      form.reset(initialValues())
      setFormError(null)
    }
    // initialValues reads only `user`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, user, form])

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      usersApi.update(user.id, {
        ...(values.name !== user.name ? { name: values.name } : {}),
        ...(canEmail && values.email !== user.email ? { email: values.email } : {}),
        ...(canStatus && values.status !== user.status ? { status: values.status } : {}),
        ...(canWhatsApp ? whatsAppNumberChange(values.whatsappNumber, user.whatsappNumber) : {}),
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: userKeys.detail(user.id) }),
        queryClient.invalidateQueries({ queryKey: memberKeys.all }),
      ])
      toast.success('Account updated')
      onOpenChange(false)
    },
    onError: (error) =>
      setFormError(
        applyServerErrors(error, form.setError, ['name', 'email', 'status', 'whatsappNumber']),
      ),
  })

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Edit account"
      description={
        canEmail
          ? undefined
          : 'Only the person themself or the platform owner can change an email; only the platform owner can disable an account.'
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
      {canEmail ? (
        <Field
          label="Email"
          required
          hint="Changing it changes how they sign in."
          error={form.formState.errors.email?.message}
        >
          {(a11y) => <Input {...a11y} type="email" inputMode="email" {...form.register('email')} />}
        </Field>
      ) : null}
      {canStatus ? (
        <Field
          label="Status"
          hint="Disabled accounts cannot sign in and their sessions end."
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
      ) : null}
      {canWhatsApp ? (
        <Field
          label="WhatsApp number"
          hint="With + and the country code. Their students get a WhatsApp button that opens a chat with it. Leave empty to remove it."
          error={form.formState.errors.whatsappNumber?.message}
        >
          {(a11y) => (
            <Input
              {...a11y}
              type="tel"
              inputMode="tel"
              autoComplete="off"
              placeholder="+40 712 345 678"
              {...form.register('whatsappNumber')}
            />
          )}
        </Field>
      ) : null}
    </FormSheet>
  )
}
