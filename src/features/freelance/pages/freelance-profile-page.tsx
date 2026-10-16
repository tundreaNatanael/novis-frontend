import { useMutation, useQueryClient } from '@tanstack/react-query'
import { KeyRound, Pencil, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { userKeys, usersApi } from '@/api/users'
import type { RouteHandle } from '@/app/route-handle'
import { ConfirmDialog } from '@/components/confirm-dialog'
import {
  BooleanValue,
  DetailField,
  DetailPanel,
  EnumValue,
  IdValue,
  TimeValue,
} from '@/components/detail/detail-panel'
import { RowActions } from '@/components/row-actions'
import { SectionHeader } from '@/components/section-header'
import { Button } from '@/components/ui/button'
import { EditUserSheet } from '@/features/org-workspace/components/edit-user-sheet'
import { ResetLinkDialog } from '@/features/org-workspace/components/reset-link-dialog'
import { enumLabel } from '@/lib/format'
import { useFreelanceWorkspace } from '../use-freelance-workspace'

export const handle: RouteHandle = { title: 'Profile' }

/** Every field of the freelance teacher's account (`GET /users/{id}`), with edit, reset link and delete. */
export function Component() {
  const { teacher, teacherId, capabilities } = useFreelanceWorkspace()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const remove = useMutation({
    mutationFn: () => usersApi.remove(teacherId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: userKeys.all })
      toast.success('Account deleted')
      navigate('/platform/freelance')
    },
  })

  return (
    <div className="flex flex-col gap-4">
      <SectionHeader
        title="Profile"
        actions={
          <>
            <Button variant="outline" onClick={() => setEditing(true)}>
              <Pencil aria-hidden />
              Edit
            </Button>
            <RowActions
              label="More actions"
              actions={[
                {
                  label: 'Send password reset link',
                  icon: KeyRound,
                  onSelect: () => setResetting(true),
                  disabledReason: capabilities.canSendResetLink(teacher)
                    ? null
                    : 'Only active password accounts can receive a reset link.',
                },
                {
                  label: 'Delete account',
                  icon: Trash2,
                  destructive: true,
                  separatorBefore: true,
                  onSelect: () => setDeleting(true),
                  disabledReason: capabilities.deleteAccountDisabledReason(teacher),
                },
              ]}
            />
          </>
        }
      />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <DetailPanel title="Details" description="Every field the API returns for this account.">
          <DetailField label="Id">
            <IdValue value={teacher.id} />
          </DetailField>
          <DetailField label="Email">{teacher.email}</DetailField>
          <DetailField label="Name">{teacher.name}</DetailField>
          <DetailField label="Status">
            <EnumValue value={teacher.status} />
          </DetailField>
          <DetailField label="Account type">
            {teacher.hasPassword ? 'Password account (teacher)' : 'Student account'}
          </DetailField>
          <DetailField label="Freelance teacher">
            <BooleanValue value={teacher.freelanceTeacher} />
          </DetailField>
          <DetailField label="Platform role">
            {teacher.platformRole ? (
              <EnumValue value={teacher.platformRole} />
            ) : (
              <span className="text-muted-foreground">None</span>
            )}
          </DetailField>
          <DetailField label="Created">
            <TimeValue value={teacher.createdAt} />
          </DetailField>
        </DetailPanel>
        <DetailPanel
          title="Organization memberships"
          description="A freelance teacher may also teach in organizations."
        >
          {teacher.memberships.length === 0 ? (
            <DetailField label="None">Works outside every organization.</DetailField>
          ) : (
            teacher.memberships.map((m) => (
              <DetailField key={`${m.organizationId}-${m.role}`} label={enumLabel(m.role)}>
                <Link
                  to={`/platform/orgs/${m.organizationId}`}
                  className="font-medium text-primary underline-offset-4 hover:underline"
                >
                  {m.organizationName}
                </Link>
              </DetailField>
            ))
          )}
        </DetailPanel>
      </div>
      <EditUserSheet
        user={teacher}
        capabilities={capabilities}
        open={editing}
        onOpenChange={setEditing}
      />
      <ResetLinkDialog email={teacher.email} open={resetting} onOpenChange={setResetting} />
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title="Delete account"
        destructive
        confirmLabel="Delete account"
        description={
          <>
            <p>
              Soft-deletes <strong>{teacher.name}</strong>'s account: roster entries and memberships
              are removed and all their sessions end. Their students keep their own accounts.
            </p>
            <p>Lessons and payments are kept as history.</p>
          </>
        }
        onConfirm={() => remove.mutateAsync()}
      />
    </div>
  )
}
