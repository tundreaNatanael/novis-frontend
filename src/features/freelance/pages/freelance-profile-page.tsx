import { Ban, CircleCheck, KeyRound, Pencil, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import type { RouteHandle } from '@/app/route-handle'
import {
  DetailField,
  DetailPanel,
  EnumValue,
  IdValue,
  TimeValue,
} from '@/components/detail/detail-panel'
import { RowActions } from '@/components/row-actions'
import { SectionHeader } from '@/components/section-header'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { ResetLinkDialog } from '@/features/org-workspace/components/reset-link-dialog'
import { WhatsAppNumberValue } from '@/components/whatsapp-number-value'
import { DeleteFreelanceTeacherDialog } from '../components/delete-freelance-teacher-dialog'
import { EditFreelanceTeacherSheet } from '../components/edit-freelance-teacher-sheet'
import { FreelanceStatusDialog } from '../components/freelance-status-dialog'
import { useFreelanceWorkspace } from '../use-freelance-workspace'

export const handle: RouteHandle = { title: 'Profile' }

/**
 * Every field of the freelance teacher's account (`GET /freelance-teachers/{id}`), with edit
 * (name, email), disable / re-enable, reset link and delete (with its cascade).
 */
export function Component() {
  const { teacher, capabilities } = useFreelanceWorkspace()
  const navigate = useNavigate()
  const [editing, setEditing] = useState(false)
  const [changingStatus, setChangingStatus] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const active = teacher.status === 'ACTIVE'

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
            <Button variant="outline" onClick={() => setChangingStatus(true)}>
              {active ? <Ban aria-hidden /> : <CircleCheck aria-hidden />}
              {active ? 'Disable account' : 'Re-enable account'}
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
                  label: 'Delete freelance teacher',
                  icon: Trash2,
                  destructive: true,
                  separatorBefore: true,
                  onSelect: () => setDeleting(true),
                },
              ]}
            />
          </>
        }
      />
      {!active ? (
        <Alert>
          <Ban aria-hidden />
          <AlertDescription>
            This account is disabled: {teacher.name} cannot sign in. Their students, courses and
            lessons are unchanged.
          </AlertDescription>
        </Alert>
      ) : null}
      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <DetailPanel title="Details" description="Every field the API returns for this account.">
          <DetailField label="Id">
            <IdValue value={teacher.id} />
          </DetailField>
          <DetailField label="Email">{teacher.email}</DetailField>
          <DetailField label="Name">{teacher.name}</DetailField>
          <DetailField label="Status">
            <EnumValue value={teacher.status} />
          </DetailField>
          <DetailField label="Role">
            {teacher.role ? (
              <EnumValue value={teacher.role} />
            ) : (
              <span className="text-muted-foreground">None</span>
            )}
          </DetailField>
          <DetailField label="Organization">
            <span className="text-muted-foreground">
              None (freelance teachers never belong to one)
            </span>
          </DetailField>
          <DetailField label="Password">{teacher.hasPassword ? 'Set' : 'Not set'}</DetailField>
          <DetailField
            label="WhatsApp number"
            hint="Their students get a WhatsApp button on their lessons that opens a chat with it."
          >
            <WhatsAppNumberValue number={teacher.whatsappNumber} />
          </DetailField>
          <DetailField label="Created">
            <TimeValue value={teacher.createdAt} />
          </DetailField>
        </DetailPanel>
      </div>
      <EditFreelanceTeacherSheet teacher={teacher} open={editing} onOpenChange={setEditing} />
      {changingStatus ? (
        <FreelanceStatusDialog teacher={teacher} open onOpenChange={setChangingStatus} />
      ) : null}
      <ResetLinkDialog email={teacher.email} open={resetting} onOpenChange={setResetting} />
      <DeleteFreelanceTeacherDialog
        teacher={teacher}
        open={deleting}
        onOpenChange={setDeleting}
        onDeleted={() => navigate('/platform/freelance')}
      />
    </div>
  )
}
