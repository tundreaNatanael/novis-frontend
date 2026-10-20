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

/**
 * `POST /invites`: the invitee chooses name and password through the emailed link. A pending
 * freelance invitation for the same email is replaced; resending an existing one is
 * `POST /invites/{id}/resend` from the pending list.
 */
export function FreelanceInviteSheet({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const [formError, setFormError] = useState<string | null>(null)
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '' },
  })

  useEffect(() => {
    if (open) {
      form.reset({ email: '' })
      setFormError(null)
    }
  }, [open, form])

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
      // ROLE_CONFLICT / INVITE_PENDING get their own sentence from `errorMessage`.
      if (isApiError(error) && error.is('CONFLICT'))
        setFormError('This person is already a freelance teacher.')
      else setFormError(applyServerErrors(error, form.setError, ['email']))
    },
  })

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Invite a freelance teacher"
      description="They receive a link to choose their name and password; invitations last 7 days. An existing account without a role accepts with its current password and keeps its name."
      submitLabel="Send invitation"
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
    </FormSheet>
  )
}
