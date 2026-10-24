import type { LessonSummary } from '@/api/types'
import { DetailField } from '@/components/detail/detail-panel'

/**
 * A student's lesson counts as detail fields (`GET /students/{id}/lessons/summary`). The payment
 * counts render only when the API sent them (payment managers); what is left to schedule always does.
 */
export function BalanceFields({ summary }: { summary: LessonSummary }) {
  return (
    <>
      <Count
        label="Prepaid left"
        hint="Paid lessons still pending (scheduled or not)."
        value={summary.prepaidRemaining}
      />
      <Count
        label="Unpaid due"
        hint="Held or late-canceled lessons not paid yet."
        value={summary.unpaidDue}
      />
      <Count
        label="Upcoming unpaid"
        hint="Dated pending lessons without payment."
        value={summary.upcomingUnpaid}
      />
      <Count
        label="To schedule"
        hint="Pending lessons without a date, paid or not."
        value={summary.toSchedule}
      />
    </>
  )
}

function Count({ label, hint, value }: { label: string; hint: string; value: number | null }) {
  if (value === null) return null
  return (
    <DetailField label={label} hint={hint}>
      <span className="text-lg font-semibold tabular-nums">{value}</span>
    </DetailField>
  )
}
