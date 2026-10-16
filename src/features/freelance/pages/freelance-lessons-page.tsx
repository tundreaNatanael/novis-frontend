import type { RouteHandle } from '@/app/route-handle'
import { SectionHeader } from '@/components/section-header'
import { LessonLedger } from '@/features/lessons/components/lesson-ledger'
import { useFreelanceWorkspace } from '../use-freelance-workspace'

export const handle: RouteHandle = { crumb: () => 'Lessons', title: 'Lessons' }

/** The teacher's lessons (`GET /lessons?teacherId=`). */
export function Component() {
  const { teacher, teacherId } = useFreelanceWorkspace()
  return (
    <div className="flex flex-col gap-4">
      <SectionHeader title="Lessons" description={`Every lesson of ${teacher.name}, with its payment state.`} />
      <LessonLedger fixed={{ teacherId }} />
    </div>
  )
}
