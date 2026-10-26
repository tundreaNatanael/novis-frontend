import type { EarningsQuery, TeacherPayout } from '@/api/types'
import { endOfMonth, parseLocalDate, startOfMonth, toIsoWithOffset } from './dates'

/**
 * The month of `now` in the browser's time zone as `GET /teacher/earnings` takes it: from its
 * first local midnight up to the next month's, each bound with its own offset (a month can start
 * in summer time and end in winter time).
 */
export function monthWindow(now: Date): EarningsQuery {
  return { from: toIsoWithOffset(startOfMonth(now)), to: toIsoWithOffset(endOfMonth(now)) }
}

/** The day the school paid, as a local date; `null` if the API ever sent something else. */
export function paidOnDate(payout: Pick<TeacherPayout, 'paidOn'>): Date | null {
  return parseLocalDate(payout.paidOn)
}

export function isVoided(payout: Pick<TeacherPayout, 'voidedAt'>): boolean {
  return payout.voidedAt !== null
}
