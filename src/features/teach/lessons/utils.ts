import type { Course, CreateLessonSeriesRequest, Lesson, ScheduleLessonRequest } from '@/api/types'
import { isWhatsAppChatWith, isWhatsAppLink, WHATSAPP_APP_URL } from '@/lib/whatsapp'
import type { TeachCapabilities } from '../lib/capabilities'
import { toIsoWithOffset } from '../lib/dates'
import type { TranslationKey } from '../i18n/types'
import type { Tone } from '../components/tone'

/** What the UI shows for a lesson (API.md §9.1 mapping + "to finish" for past pending). */
export type LessonUiStatus =
  'upcoming' | 'toFinish' | 'unscheduled' | 'present' | 'canceled' | 'canceledLate'

export function lessonUiStatus(
  lesson: Pick<Lesson, 'status' | 'scheduledAt'>,
  now: Date = new Date(),
): LessonUiStatus {
  switch (lesson.status) {
    case 'PRESENT':
      return 'present'
    case 'CANCELED':
      return 'canceled'
    case 'CANCELED_LATE':
      return 'canceledLate'
    default:
      if (!lesson.scheduledAt) return 'unscheduled'
      return new Date(lesson.scheduledAt).getTime() < now.getTime() ? 'toFinish' : 'upcoming'
  }
}

export const lessonStatusMeta: Record<LessonUiStatus, { tone: Tone; labelKey: TranslationKey }> = {
  upcoming: { tone: 'upcoming', labelKey: 'status.upcoming' },
  toFinish: { tone: 'warning', labelKey: 'status.toFinish' },
  unscheduled: { tone: 'neutral', labelKey: 'status.unscheduled' },
  present: { tone: 'held', labelKey: 'status.present' },
  canceled: { tone: 'canceled', labelKey: 'status.canceled' },
  canceledLate: { tone: 'late', labelKey: 'status.canceledLate' },
}

export type PaymentBadgeMeta = { tone: Tone; labelKey: TranslationKey } | null

/**
 * Paid pending lesson = a credit; paid closed lesson = paid; unpaid held / late = unpaid (due).
 * Unpaid pending and on-time cancellations show nothing — there is nothing owed. Without payment
 * data (`studentPayment: null`, the caller does not manage payments) there is no badge at all.
 */
export function paymentBadge(lesson: Pick<Lesson, 'status' | 'studentPayment'>): PaymentBadgeMeta {
  if (!lesson.studentPayment) return null
  if (lesson.studentPayment.paid) {
    return lesson.status === 'PENDING'
      ? { tone: 'credits', labelKey: 'status.credit' }
      : { tone: 'paid', labelKey: 'status.paid' }
  }
  if (lesson.status === 'PRESENT' || lesson.status === 'CANCELED_LATE') {
    return { tone: 'unpaid', labelKey: 'status.unpaid' }
  }
  return null
}

/** Charged outcomes — the only ones that can be "due". */
export function isCharged(lesson: Pick<Lesson, 'status'>): boolean {
  return lesson.status === 'PRESENT' || lesson.status === 'CANCELED_LATE'
}

/** Pending and not known to be paid; without payment data the server's `409` has the last word. */
export function canDelete(lesson: Pick<Lesson, 'status' | 'studentPayment'>): boolean {
  return lesson.status === 'PENDING' && !lesson.studentPayment?.paid
}

export function canClose(lesson: Pick<Lesson, 'status' | 'scheduledAt'>): boolean {
  return lesson.status === 'PENDING' && lesson.scheduledAt !== null
}

export function canEditJournal(lesson: Pick<Lesson, 'status'>): boolean {
  return isCharged(lesson)
}

/** A lesson's length in minutes (API.md §1.7): the stepper moves by a quarter of an hour. */
export const LESSON_LENGTH = { min: 15, max: 240, step: 15, fallback: 60 } as const

/** A weekly series books 2–52 dates from the book sheet (one date is a plain booking). */
export const SERIES_COUNT = { min: 2, max: 52, initial: 4 } as const

/** The length a lesson of `course` is booked with unless the teacher changes it. */
export function defaultLessonLength(
  course: Pick<Course, 'defaultDurationMinutes'> | undefined,
): number {
  return course?.defaultDurationMinutes ?? LESSON_LENGTH.fallback
}

/**
 * The `PATCH /lessons/{id}/schedule` body of the schedule sheet: the date, and the length when it
 * changed (an omitted one stays). The meeting link is the teacher and student's (D-057).
 */
export function scheduleBody(
  lesson: Pick<Lesson, 'durationMinutes'>,
  scheduledAt: string,
  durationMinutes: number = lesson.durationMinutes,
): ScheduleLessonRequest {
  const body: ScheduleLessonRequest = { scheduledAt }
  if (durationMinutes !== lesson.durationMinutes) body.durationMinutes = durationMinutes
  return body
}

/**
 * The `POST /lessons/series` body of the book sheet: the first date with the browser's offset,
 * the browser's IANA time zone (so the dates keep their local time across DST) and the length.
 */
export function seriesBody(draft: {
  studentId: string
  courseId: string | null
  firstAt: Date
  timeZone: string
  intervalWeeks: 1 | 2
  count: number
  durationMinutes: number
}): CreateLessonSeriesRequest {
  const body: CreateLessonSeriesRequest = {
    studentId: draft.studentId,
    firstAt: toIsoWithOffset(draft.firstAt),
    timeZone: draft.timeZone,
    intervalWeeks: draft.intervalWeeks,
    count: draft.count,
    durationMinutes: draft.durationMinutes,
  }
  if (draft.courseId) body.courseId = draft.courseId
  return body
}

/**
 * What "Schedule all as a series" books from a student's lessons to schedule: their one course
 * (or none) and how many. Lessons of different courses get no shortcut: a series books undated
 * lessons of its own course or of none, so it would leave some and insert new ones instead.
 * `total` is how many there are (the list's `totalElements`): until every one is loaded their
 * courses are not known, so there is no shortcut yet.
 */
export function seriesFromToSchedule(
  lessons: Pick<Lesson, 'courseId'>[],
  total: number,
): { courseId: string | null; count: number } | null {
  if (lessons.length < SERIES_COUNT.min || lessons.length < total) return null
  const courseId = lessons[0]!.courseId
  if (lessons.some((lesson) => lesson.courseId !== courseId)) return null
  return { courseId, count: Math.min(lessons.length, SERIES_COUNT.max) }
}

/** The lists of Calendar → List. `unscheduled` ("Credits") and `toSchedule` are the same undated pending lessons. */
export type LessonSegment =
  'upcoming' | 'toFinish' | 'unscheduled' | 'toSchedule' | 'unpaid' | 'history'

export const LESSON_SEGMENTS: readonly LessonSegment[] = [
  'upcoming',
  'toFinish',
  'unscheduled',
  'toSchedule',
  'unpaid',
  'history',
]

export function isLessonSegment(value: string | null | undefined): value is LessonSegment {
  return (
    value !== null && value !== undefined && (LESSON_SEGMENTS as readonly string[]).includes(value)
  )
}

/**
 * A payment manager (a freelance teacher) keeps "Credits" and "Unpaid"; an org teacher, whose
 * school's admin keeps the payments, gets "To schedule" and no "Unpaid" (the `paid` filter is not theirs).
 */
export function lessonSegments({
  canManageStudentPayments,
}: Pick<TeachCapabilities, 'canManageStudentPayments'>): LessonSegment[] {
  return canManageStudentPayments
    ? ['upcoming', 'toFinish', 'unscheduled', 'unpaid', 'history']
    : ['upcoming', 'toFinish', 'toSchedule', 'history']
}

/** Groups lessons by local day (undated last), keeping the input order inside each group. */
export function groupByDay<T extends { scheduledAt: string | null }>(
  items: T[],
  keyOf: (date: Date) => string,
): { key: string; date: Date | null; items: T[] }[] {
  const groups = new Map<string, { key: string; date: Date | null; items: T[] }>()
  for (const item of items) {
    const date = item.scheduledAt ? new Date(item.scheduledAt) : null
    const key = date ? keyOf(date) : 'undated'
    let group = groups.get(key)
    if (!group) {
      group = { key, date, items: [] }
      groups.set(key, group)
    }
    group.items.push(item)
  }
  const list = [...groups.values()]
  const undated = list.filter((g) => g.date === null)
  return [...list.filter((g) => g.date !== null), ...undated]
}

/**
 * What the teacher's Join opens (D-058): a WhatsApp call on their own number is the chat with
 * themself, so it opens the WhatsApp app ("Open WhatsApp"); another WhatsApp link says "Join on
 * WhatsApp". `null` without a link ("No meeting link yet"), as the student's app shows it.
 */
export function teacherJoin(
  meetingUrl: string | null | undefined,
  myWhatsappNumber: string | null | undefined,
): { url: string; kind: 'openWhatsApp' | 'whatsApp' | 'link' } | null {
  if (!meetingUrl) return null
  if (isWhatsAppChatWith(meetingUrl, myWhatsappNumber))
    return { url: WHATSAPP_APP_URL, kind: 'openWhatsApp' }
  return { url: meetingUrl, kind: isWhatsAppLink(meetingUrl) ? 'whatsApp' : 'link' }
}
