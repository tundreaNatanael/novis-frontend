import type { RouteHandle } from '@/app/route-handle'
import { SectionHeader } from '@/components/section-header'
import { LessonLedger } from '@/features/lessons/components/lesson-ledger'
import { useOrgWorkspace } from '../use-org-workspace'

export const handle: RouteHandle = { crumb: () => 'Lessons', title: 'Lessons' }

/** The organization's share of the ledger (`GET /lessons?organizationId=`). */
export function Component() {
  const { orgId, org } = useOrgWorkspace()
  return (
    <div className="flex flex-col gap-4">
      <SectionHeader
        title="Lessons"
        description={`Every lesson held in ${org.name}, with its payment state.`}
      />
      <LessonLedger fixed={{ organizationId: orgId }} />
    </div>
  )
}
