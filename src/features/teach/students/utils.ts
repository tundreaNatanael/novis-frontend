import type { LessonSummary } from '@/api/types'

export type PaymentCounts = { prepaidRemaining: number; unpaidDue: number; upcomingUnpaid: number }

/**
 * A student's payment counts, or `null` when the API does not send them: only a payment manager
 * (a freelance teacher) gets them; an org teacher plans from `toSchedule` instead.
 */
export function paymentCounts(
  summary: Pick<LessonSummary, keyof PaymentCounts>,
): PaymentCounts | null {
  const { prepaidRemaining, unpaidDue, upcomingUnpaid } = summary
  if (prepaidRemaining === null || unpaidDue === null || upcomingUnpaid === null) return null
  return { prepaidRemaining, unpaidDue, upcomingUnpaid }
}
