import type { RouteHandle } from '@/app/route-handle'
import { PageHeader } from '@/components/page-header'
import { usePageTitle } from '@/lib/use-page-title'
import { LessonLedger } from './components/lesson-ledger'

export const handle: RouteHandle = { title: 'Lessons' }

/** The platform-wide ledger: every lesson, every filter of `GET /lessons`. */
export function Component() {
  usePageTitle('Lessons')
  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Lessons"
        description="The ledger: one lesson per session between a teacher and a student, with its payment state. Filter by organization, teacher, student, course, status, payment and date."
      />
      <LessonLedger fixed={{}} />
    </div>
  )
}
