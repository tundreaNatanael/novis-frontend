import { Plus } from 'lucide-react'
import { useNavigate } from 'react-router'
import type { RouteHandle } from '@/app/route-handle'
import { SectionHeader } from '@/components/section-header'
import { Button } from '@/components/ui/button'
import { useListParams } from '@/lib/use-list-params'
import { AddStaffSheet } from '../components/add-staff-sheet'
import { MembersTable } from '../components/members-table'
import { useOrgWorkspace } from '../use-org-workspace'

export const handle: RouteHandle = { crumb: () => 'Admins', title: 'Admins' }

export function Component() {
  const { basePath, capabilities } = useOrgWorkspace()
  const params = useListParams()
  const navigate = useNavigate()
  const create = capabilities.canManageAdmins ? (
    <Button onClick={() => params.setFlag('new', 1)}>
      <Plus aria-hidden />
      Add admin
    </Button>
  ) : null
  return (
    <div className="flex flex-col gap-4">
      <SectionHeader
        title="Admins"
        description="Administrators of this organization. They manage teachers, students, courses and invites."
      />
      <MembersTable
        role="ADMIN"
        segment="admins"
        singular="Admin"
        plural="Admins"
        createAction={create}
      />
      <AddStaffSheet
        role="ADMIN"
        open={params.filter('new') === '1'}
        onOpenChange={(open) => params.setFlag('new', open ? 1 : null)}
        onCreated={(member) => navigate(`${basePath}/admins/${member.userId}`)}
      />
    </div>
  )
}
