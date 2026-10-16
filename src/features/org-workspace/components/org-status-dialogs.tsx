import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { orgKeys, orgsApi } from '@/api/orgs'
import type { Organization } from '@/api/types'
import { userKeys } from '@/api/users'
import { ConfirmDialog } from '@/components/confirm-dialog'

interface Props {
  org: Organization
  open: boolean
  onOpenChange: (open: boolean) => void
  onDone?: () => void
}

/** `DELETE /orgs/{id}`: archives (no hard delete). Typing the slug confirms. */
export function ArchiveOrgDialog({ org, open, onOpenChange, onDone }: Props) {
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: () => orgsApi.archive(org.id),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: orgKeys.all }),
        queryClient.invalidateQueries({ queryKey: userKeys.me() }),
      ])
      toast.success('Organization archived')
      onDone?.()
    },
  })
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Archive organization"
      destructive
      confirmLabel="Archive organization"
      confirmText={org.slug}
      confirmTextLabel="Type the slug to confirm"
      description={
        <>
          <p>
            Archives <strong>{org.name}</strong>. Every admin, teacher and student membership in it
            stops granting access immediately, and nothing new can be added to it.
          </p>
          <p>
            Courses, lessons and payments are kept. There is no hard delete; you can restore the
            organization later.
          </p>
        </>
      }
      onConfirm={() => mutation.mutateAsync()}
    />
  )
}

/** `PATCH /orgs/{id} { status: ACTIVE }` (super-admin only). */
export function RestoreOrgDialog({ org, open, onOpenChange, onDone }: Props) {
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: () => orgsApi.update(org.id, { status: 'ACTIVE' }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: orgKeys.all }),
        queryClient.invalidateQueries({ queryKey: userKeys.me() }),
      ])
      toast.success('Organization restored')
      onDone?.()
    },
  })
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Restore organization"
      confirmLabel="Restore organization"
      description={
        <p>
          Sets <strong>{org.name}</strong> back to active. Existing memberships grant access again
          at once.
        </p>
      }
      onConfirm={() => mutation.mutateAsync()}
    />
  )
}
