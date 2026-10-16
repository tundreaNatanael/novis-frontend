import { Plus } from 'lucide-react'
import { useNavigate } from 'react-router'
import type { RouteHandle } from '@/app/route-handle'
import { SectionHeader } from '@/components/section-header'
import { Button } from '@/components/ui/button'
import { useListParams } from '@/lib/use-list-params'
import { AddStaffSheet } from '../components/add-staff-sheet'
import { MembersTable } from '../components/members-table'
import { useOrgWorkspace } from '../use-org-workspace'

export const handle: RouteHandle = { crumb: () => 'Teachers', title: 'Teachers' }

export function Component() {
  const { basePath, capabilities } = useOrgWorkspace()
  const params = useListParams()
  const navigate = useNavigate()
  const create = capabilities.canManageTeachers ? (
    <Button onClick={() => params.setFlag('new', 1)}>
      <Plus aria-hidden />
      Add teacher
    </Button>
  ) : null
  return (
    <div className="flex flex-col gap-4">
      <SectionHeader
        title="Teachers"
        description="Teachers own courses and run lessons. Each course belongs to exactly one teacher."
      />
      <MembersTable
        role="TEACHER"
        segment="teachers"
        singular="Teacher"
        plural="Teachers"
        createAction={create}
      />
      <AddStaffSheet
        role="TEACHER"
        open={params.filter('new') === '1'}
        onOpenChange={(open) => params.setFlag('new', open ? 1 : null)}
        onCreated={(member) => navigate(`${basePath}/teachers/${member.userId}`)}
      />
    </div>
  )
}
