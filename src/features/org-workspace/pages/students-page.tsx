import { Plus } from 'lucide-react'
import { useNavigate } from 'react-router'
import type { RouteHandle } from '@/app/route-handle'
import { SectionHeader } from '@/components/section-header'
import { Button } from '@/components/ui/button'
import { useListParams } from '@/lib/use-list-params'
import { AddStudentSheet } from '../components/add-student-sheet'
import { MembersTable } from '../components/members-table'
import { useOrgWorkspace } from '../use-org-workspace'

export const handle: RouteHandle = { crumb: () => 'Students', title: 'Students' }

export function Component() {
  const { basePath, capabilities } = useOrgWorkspace()
  const params = useListParams()
  const navigate = useNavigate()
  const create = capabilities.canManageStudents ? (
    <Button onClick={() => params.setFlag('new', 1)}>
      <Plus aria-hidden />
      Add student
    </Button>
  ) : null
  return (
    <div className="flex flex-col gap-4">
      <SectionHeader
        title="Students"
        description="Students sign in with their email only. Enrol them in courses to give them access."
      />
      <MembersTable
        role="STUDENT"
        segment="students"
        singular="Student"
        plural="Students"
        createAction={create}
      />
      <AddStudentSheet
        open={params.filter('new') === '1'}
        onOpenChange={(open) => params.setFlag('new', open ? 1 : null)}
        onCreated={(student) => navigate(`${basePath}/students/${student.id}`)}
      />
    </div>
  )
}
