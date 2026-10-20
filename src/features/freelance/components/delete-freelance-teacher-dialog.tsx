import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { courseKeys } from '@/api/courses'
import { freelanceTeacherKeys, freelanceTeachersApi } from '@/api/freelance-teachers'
import { studentKeys } from '@/api/students'
import type { User } from '@/api/types'
import { userKeys } from '@/api/users'
import { ConfirmDialog } from '@/components/confirm-dialog'

/**
 * `DELETE /freelance-teachers/{id}` and its cascade (API.md §5, Freelance teachers): the students
 * on the teacher's roster are deleted and signed out, their courses archived, the account
 * soft-deleted; lessons, homework and materials stay. Typing the email confirms, as the cascade
 * cannot be undone.
 */
export function DeleteFreelanceTeacherDialog({
  teacher,
  open,
  onOpenChange,
  onDeleted,
}: {
  teacher: User
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Called before the caches are refreshed, so a page showing the teacher can leave first. */
  onDeleted?: () => void
}) {
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: () => freelanceTeachersApi.remove(teacher.id),
    onSuccess: async () => {
      toast.success('Freelance teacher deleted')
      onDeleted?.()
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: freelanceTeacherKeys.lists() }),
        queryClient.invalidateQueries({ queryKey: userKeys.all }),
        queryClient.invalidateQueries({ queryKey: studentKeys.all }),
        queryClient.invalidateQueries({ queryKey: courseKeys.all }),
      ])
      queryClient.removeQueries({ queryKey: freelanceTeacherKeys.detail(teacher.id) })
    },
  })

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Delete freelance teacher"
      destructive
      confirmLabel="Delete teacher and students"
      confirmText={teacher.email}
      confirmTextLabel="Type their email to confirm"
      description={
        <>
          <p>
            Deletes <strong>{teacher.name}</strong> and everything that exists only through them:
          </p>
          <ul className="my-2 list-disc space-y-1 pl-5">
            <li>
              every student on their roster: the student accounts are deleted, signed out and
              dropped from all their courses;
            </li>
            <li>their courses are archived and no one stays enrolled in them;</li>
            <li>their own account is deleted and every session of it ends.</li>
          </ul>
          <p>Lessons, homework and materials are kept as history. This cannot be undone.</p>
        </>
      }
      onConfirm={() => mutation.mutateAsync()}
    />
  )
}
