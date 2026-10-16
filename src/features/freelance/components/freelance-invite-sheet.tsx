import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { isApiError } from '@/api/errors'
import { inviteKeys, invitesApi } from '@/api/invites'
import { Field } from '@/components/form/field'
import { FormError } from '@/components/form/form-error'
import { FormSheet } from '@/components/form/form-sheet'
import { applyServerErrors } from '@/components/form/server-errors'
import { Input } from '@/components/ui/input'
import { emailSchema } from '@/lib/schemas'

const schema = z.object({ email: emailSchema })
type FormValues = z.infer<typeof schema>

/** `POST /invites`: the invitee chooses name and password through the emailed link. */
export function FreelanceInviteSheet({
  open,
  onOpenChange,
  email,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  email?: string
}) {
  const queryClient = useQueryClient()
  const [formError, setFormError] = useState<string | null>(null)
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: email ?? '' },
  })

  useEffect(() => {
    if (open) {
      form.reset({ email: email ?? '' })
      setFormError(null)
    }
  }, [open, email, form])

  const mutation = useMutation({
    mutationFn: (values: FormValues) => invitesApi.createFreelance(values),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: inviteKeys.freelance() })
      toast.success('Invitation sent', {
        description: 'In development the API logs the link instead of emailing it.',
      })
      onOpenChange(false)
    },
    onError: (error) => {
      if (isApiError(error) && error.isConflict)
        setFormError('This person is already a freelance teacher.')
      else setFormError(applyServerErrors(error, form.setError, ['email']))
    },
  })

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title={email ? 'Resend invitation' : 'Invite a freelance teacher'}
      description="They receive a link to choose their name and password. Invitations last 7 days."
      submitLabel={email ? 'Send again' : 'Send invitation'}
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
            autoFocus={!email}
            readOnly={!!email}
            {...form.register('email')}
          />
        )}
      </Field>
    </FormSheet>
  )
}
