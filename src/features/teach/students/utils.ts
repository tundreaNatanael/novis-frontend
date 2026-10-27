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

/** The pair's meeting link as the form sees it: a WhatsApp call on the teacher's number, or a link. */
export type MeetingLinkState = { whatsapp: boolean; meetingUrl: string | null }

/** What saving the meeting link does: nothing, a WhatsApp call, a new link or no link (D-058). */
export type MeetingLinkChange =
  | { kind: 'none' }
  | { kind: 'whatsapp' }
  | { kind: 'link'; meetingUrl: string }
  | { kind: 'remove' }

/**
 * Compares the form with the pair's current link. A WhatsApp call keeps no link of its own, so
 * switching it off with the field left empty removes the link.
 */
export function meetingLinkChange(
  current: MeetingLinkState,
  form: { whatsapp: boolean; meetingUrl: string },
): MeetingLinkChange {
  if (form.whatsapp) return current.whatsapp ? { kind: 'none' } : { kind: 'whatsapp' }
  const typed = form.meetingUrl.trim()
  const currentLink = current.whatsapp ? null : current.meetingUrl
  if (typed === '')
    return current.whatsapp || currentLink !== null ? { kind: 'remove' } : { kind: 'none' }
  return typed === currentLink ? { kind: 'none' } : { kind: 'link', meetingUrl: typed }
}
