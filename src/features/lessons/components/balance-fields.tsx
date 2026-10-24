import type { LessonSummary } from '@/api/types'
import { DetailField } from '@/components/detail/detail-panel'
import { LESSON_COUNTS, type LessonCountName } from '../lesson-counts'

/**
 * A student's lesson counts as detail fields (`GET /students/{id}/lessons/summary`). The payment
 * counts render only when the API sent them (payment managers); what is left to schedule always does.
 * Prepaid left and unpaid due are the Finance tab's numbers for the student, under the same names.
 */
export function BalanceFields({ summary }: { summary: LessonSummary }) {
  return (
    <>
      <Count name="prepaidRemaining" value={summary.prepaidRemaining} />
      <Count name="unpaidDue" value={summary.unpaidDue} />
      <Count name="upcomingUnpaid" value={summary.upcomingUnpaid} />
      <Count name="toSchedule" value={summary.toSchedule} />
    </>
  )
}

function Count({ name, value }: { name: LessonCountName; value: number | null }) {
  if (value === null) return null
  return (
    <DetailField label={LESSON_COUNTS[name].label} hint={LESSON_COUNTS[name].hint}>
      <span className="text-lg font-semibold tabular-nums">{value}</span>
    </DetailField>
  )
}
