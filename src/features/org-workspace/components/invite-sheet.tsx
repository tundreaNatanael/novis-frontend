import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { isApiError } from '@/api/errors'
import { inviteKeys, invitesApi } from '@/api/invites'
import type { StaffRole } from '@/api/types'
import { Field } from '@/components/form/field'
import { FormError } from '@/components/form/form-error'
import { FormSheet } from '@/components/form/form-sheet'
import { SelectField } from '@/components/form/select-field'
import { applyServerErrors } from '@/components/form/server-errors'
import { Input } from '@/components/ui/input'
import { emailSchema } from '@/lib/schemas'
import { useOrgWorkspace } from '../use-org-workspace'

const schema = z.object({ email: emailSchema, role: z.enum(['ADMIN', 'TEACHER']) })
type FormValues = z.infer<typeof schema>

interface InviteSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Preselected role (from `?role=`). */
  initialRole?: StaffRole
}

/**
 * `POST /orgs/{orgId}/invites`: the invitee chooses name and password through the emailed link.
 * Admin invitations are the super-admin's only. Resending an existing invitation is its own
 * endpoint (invites page).
 */
export function InviteSheet({ open, onOpenChange, initialRole }: InviteSheetProps) {
  const { orgId, org, capabilities } = useOrgWorkspace()
  const queryClient = useQueryClient()
  const [formError, setFormError] = useState<string | null>(null)
  const roles: StaffRole[] = capabilities.canManageAdmins ? ['ADMIN', 'TEACHER'] : ['TEACHER']
  const defaultRole: StaffRole =
    initialRole && roles.includes(initialRole) ? initialRole : 'TEACHER'
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', role: defaultRole },
  })

  useEffect(() => {
    if (open) {
      form.reset({ email: '', role: defaultRole })
      setFormError(null)
    }
  }, [open, defaultRole, form])

  const mutation = useMutation({
    mutationFn: (values: FormValues) => invitesApi.createForOrg(orgId, values),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: inviteKeys.org(orgId) })
      toast.success('Invitation sent', {
        description: 'In development the API logs the link instead of emailing it.',
      })
      onOpenChange(false)
    },
    onError: (error) => {
      // ROLE_CONFLICT / INVITE_PENDING get their own sentence from `errorMessage`.
      if (isApiError(error) && error.is('CONFLICT')) {
        setFormError(
          error.message.includes('archived')
            ? 'This organization is archived; restore it before inviting.'
            : 'This person already holds that role here.',
        )
        return
      }
      setFormError(applyServerErrors(error, form.setError, ['email', 'role']))
    },
  })

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Invite by email"
      description={`They receive a link to choose their name and password and join ${org.name}. Invitations last 7 days. An email that already has a role elsewhere in Novis cannot be invited.`}
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
      <Field label="Role" required error={form.formState.errors.role?.message}>
        {(a11y) => (
          <Controller
            control={form.control}
            name="role"
            render={({ field }) => (
              <SelectField
                id={a11y.id}
                value={field.value}
                onChange={field.onChange}
                disabled={roles.length === 1}
                options={roles.map((role) => ({
                  value: role,
                  label: role === 'ADMIN' ? 'Admin' : 'Teacher',
                  description:
                    role === 'ADMIN'
                      ? 'Manages teachers, students and courses'
                      : 'Owns courses and teaches lessons',
                }))}
              />
            )}
          />
        )}
      </Field>
    </FormSheet>
  )
}
