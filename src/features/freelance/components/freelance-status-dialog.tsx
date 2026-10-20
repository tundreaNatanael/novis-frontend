import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'
import { freelanceTeacherKeys, freelanceTeachersApi } from '@/api/freelance-teachers'
import type { User } from '@/api/types'
import { userKeys } from '@/api/users'
import { ConfirmDialog } from '@/components/confirm-dialog'

/**
 * Disable or re-enable a freelance teacher (`PATCH /freelance-teachers/{id} { status }`). Disabling
 * also ends every session of the account; nothing else changes. Mount it when it opens: the
 * direction is fixed then, so the refetched status does not flip the copy while it closes.
 */
export function FreelanceStatusDialog({
  teacher,
  open,
  onOpenChange,
}: {
  teacher: User
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const [disabling] = useState(teacher.status === 'ACTIVE')
  const mutation = useMutation({
    mutationFn: () =>
      freelanceTeachersApi.update(teacher.id, { status: disabling ? 'DISABLED' : 'ACTIVE' }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: freelanceTeacherKeys.detail(teacher.id) }),
        queryClient.invalidateQueries({ queryKey: freelanceTeacherKeys.lists() }),
        queryClient.invalidateQueries({ queryKey: userKeys.detail(teacher.id) }),
      ])
      toast.success(disabling ? 'Account disabled' : 'Account re-enabled')
    },
  })

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={disabling ? 'Disable account' : 'Re-enable account'}
      destructive={disabling}
      confirmLabel={disabling ? 'Disable account' : 'Re-enable account'}
      description={
        disabling ? (
          <>
            <p>
              <strong>{teacher.name}</strong> can no longer sign in, and every session they have
              open ends now.
            </p>
            <p>
              Their students, courses and lessons stay as they are. You can re-enable the account at
              any time.
            </p>
          </>
        ) : (
          <p>
            <strong>{teacher.name}</strong> can sign in again with their current password.
          </p>
        )
      }
      onConfirm={() => mutation.mutateAsync()}
    />
  )
}
