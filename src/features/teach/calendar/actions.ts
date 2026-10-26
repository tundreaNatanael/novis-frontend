import type { CalendarLesson, LessonOutcome } from '@/api/types'

/** What clicking a lesson in the calendar offers, in the order the dialog lists it. */
export type LessonAction =
  'markHeld' | 'canceledOnTime' | 'canceledLate' | 'join' | 'reschedule' | 'open'

type Actionable = Pick<CalendarLesson, 'status' | 'scheduledAt' | 'durationMinutes' | 'meetingUrl'>

/**
 * A pending lesson can be canceled (on time or late) at any moment, marked held once it has
 * started, joined while it has a link and has not ended, and rescheduled. A closed lesson can only
 * be opened: the API refuses to close or move it again.
 */
export function lessonActions(lesson: Actionable, now: Date): LessonAction[] {
  if (lesson.status !== 'PENDING') return ['open']
  const start = new Date(lesson.scheduledAt).getTime()
  const end = start + lesson.durationMinutes * 60_000
  const actions: LessonAction[] = []
  if (now.getTime() >= start) actions.push('markHeld')
  actions.push('canceledOnTime', 'canceledLate')
  if (lesson.meetingUrl && now.getTime() < end) actions.push('join')
  actions.push('reschedule', 'open')
  return actions
}

/** The outcome a closing action sends to `POST /lessons/{id}/close`. */
export const closeOutcome = {
  markHeld: 'PRESENT',
  canceledOnTime: 'CANCELED',
  canceledLate: 'CANCELED_LATE',
} as const satisfies Partial<Record<LessonAction, LessonOutcome>>

/**
 * The optimistic change in a cached window: the lesson is closed with that outcome now, and —
 * closed with one click, without a journal — has no journal.
 */
export function withClosedLesson(
  rows: CalendarLesson[],
  id: string,
  status: LessonOutcome,
  closedAt: string,
): CalendarLesson[] {
  return rows.map((row) => (row.id === id ? { ...row, status, closedAt, hasJournal: false } : row))
}
