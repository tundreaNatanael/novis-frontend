import type { ListParams } from '@/lib/use-list-params'
import { FREELANCE } from '../hooks/use-lesson-filter-options'
import type { FixedScope } from './lesson-filters'

/** Turns URL params into the `GET /lessons` query (dates are local calendar days). */
export function lessonFiltersFromParams(params: ListParams, fixed: FixedScope) {
  const org = fixed.organizationId ?? params.filter('org')
  const from = params.filter('from')
  const to = params.filter('to')
  const paid = params.filter('paid')
  const unscheduled = params.filter('unscheduled')
  return {
    organizationId: org && org !== FREELANCE ? org : undefined,
    teacherId: fixed.teacherId ?? params.filter('teacherId'),
    studentId: params.filter('studentId'),
    courseId: params.filter('courseId'),
    status: params.filter('status') as
      'PENDING' | 'PRESENT' | 'CANCELED' | 'CANCELED_LATE' | undefined,
    paid: paid === 'true' ? true : paid === 'false' ? false : undefined,
    unscheduled: unscheduled === 'true' ? true : unscheduled === 'false' ? false : undefined,
    from: from ? new Date(`${from}T00:00:00`).toISOString() : undefined,
    to: to ? new Date(new Date(`${to}T00:00:00`).getTime() + 86_400_000).toISOString() : undefined,
  }
}
