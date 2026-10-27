import type {
  CreateRecurringLessonRequest,
  Lesson,
  RecurringLesson,
  UpdateRecurringLessonRequest,
  Weekday,
} from '@/api/types'
import { fromDateTimeLocal } from '@/lib/format'

/**
 * Pure helpers of the console's weekly lessons (API.md §9.8): how a rule reads, when its next date
 * is, and the bodies the set-up and edit sheets send.
 */

/** Monday first, as a week is listed. */
export const WEEKDAYS: Weekday[] = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
]
/** JavaScript's `getDay()` order. */
const JS_WEEKDAYS: Weekday[] = [
  'SUNDAY',
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
]

/** The Repeat select of both sheets: the API's `intervalWeeks` as strings. */
export const REPEAT_OPTIONS = [
  { value: '1', label: 'Every week' },
  { value: '2', label: 'Every 2 weeks' },
]

/** "Tuesday". */
export function weekdayLabel(weekday: Weekday): string {
  return weekday.charAt(0) + weekday.slice(1).toLowerCase()
}

/** The weekday of a moment on the browser's clock. */
export function weekdayOf(date: Date): Weekday {
  return JS_WEEKDAYS[date.getDay()] ?? 'SUNDAY'
}

const pad = (n: number) => String(n).padStart(2, '0')

/** "17:05": the local time of a moment on the browser's clock, as the API's `localTime`. */
export function localTimeOf(date: Date): string {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** "17:00–18:00" from the rule's `HH:mm` and length, by the clock (no zone involved). */
export function ruleTimeRange(
  rule: Pick<RecurringLesson, 'localTime' | 'durationMinutes'>,
): string {
  const [hours = 0, minutes = 0] = rule.localTime.split(':').map(Number)
  const end = (hours * 60 + minutes + rule.durationMinutes) % (24 * 60)
  return `${rule.localTime}–${pad(Math.floor(end / 60))}:${pad(end % 60)}`
}

/** "Every Tuesday, 17:00–18:00" or "Every 2 weeks on Tuesday, 17:00–18:00". */
export function describeRule(
  rule: Pick<RecurringLesson, 'weekday' | 'localTime' | 'durationMinutes' | 'intervalWeeks'>,
): string {
  const weekday = weekdayLabel(rule.weekday)
  const time = ruleTimeRange(rule)
  return rule.intervalWeeks === 2
    ? `Every 2 weeks on ${weekday}, ${time}`
    : `Every ${weekday}, ${time}`
}

/** An IANA region id ("Europe/Bucharest") or "UTC"; an offset such as `GMT+1` is refused by the API. */
const IANA_ZONE = /^(?:UTC|[A-Za-z_]+(?:\/[A-Za-z0-9_+-]+)+)$/

/** The browser's IANA time zone, sent as the zone a new rule repeats in; `UTC` when the browser reports none. */
export function browserTimeZone(): string {
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone
  return zone && IANA_ZONE.test(zone) ? zone : 'UTC'
}

/** Whether the rule's times are in another zone than the browser's, so the console says which. */
export function zoneDiffers(rule: Pick<RecurringLesson, 'timeZone'>, browserZone: string): boolean {
  return rule.timeZone !== browserZone
}

/** `yyyy-MM-dd` of `now` in an IANA zone: the rule's "today", which its dates and `effectiveFrom` count from. */
export function todayIn(timeZone: string, now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? ''
  return `${get('year')}-${get('month')}-${get('day')}`
}

/** A calendar day as a UTC instant, so day arithmetic never crosses a clock change. */
function dayNumber(date: string): number {
  const [y = 0, m = 1, d = 1] = date.split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}

function dayString(dayNumberValue: number): string {
  return new Date(dayNumberValue).toISOString().slice(0, 10)
}

/**
 * The rule's next date on or after `today` (`yyyy-MM-dd` in the rule's zone): `startsOn` plus
 * whole intervals, every date of a rule being one of those; `null` once the rule has ended before
 * it. Skipped dates are not known here (the API does not list them), so a skipped next date still
 * shows.
 */
export function nextOccurrenceOf(
  rule: Pick<RecurringLesson, 'startsOn' | 'endsOn' | 'intervalWeeks'>,
  today: string,
): string | null {
  const step = rule.intervalWeeks * 7 * 86_400_000
  let day = dayNumber(rule.startsOn)
  const todayNumber = dayNumber(today)
  if (day < todayNumber) {
    const steps = Math.ceil((todayNumber - day) / step)
    day += steps * step
  }
  if (rule.endsOn && day > dayNumber(rule.endsOn)) return null
  return dayString(day)
}

/** Whether a lesson stands for an occurrence of a weekly lesson. */
export function isWeeklyLesson(lesson: Pick<Lesson, 'recurringLessonId'>): boolean {
  return lesson.recurringLessonId !== null
}

/** What the set-up sheet collects; `firstAt` is a `datetime-local` value on the browser's clock. */
export interface RecurringDraft {
  studentId: string
  teacherId?: string
  courseId: string
  firstAt: string
  timeZone: string
  intervalWeeks: 1 | 2
  durationMinutes: number
  meetingUrl: string
}

/**
 * The `POST /recurring-lessons` body: the first lesson as a UTC instant (the API reads its weekday
 * and local time in `timeZone`, the browser's), the interval, the length, and the course and link
 * only when given. `null` while the draft has no first lesson yet.
 */
export function recurringBody(draft: RecurringDraft): CreateRecurringLessonRequest | null {
  const firstAt = fromDateTimeLocal(draft.firstAt)
  if (!firstAt) return null
  return {
    studentId: draft.studentId,
    ...(draft.teacherId ? { teacherId: draft.teacherId } : {}),
    ...(draft.courseId ? { courseId: draft.courseId } : {}),
    firstAt,
    timeZone: draft.timeZone,
    intervalWeeks: draft.intervalWeeks,
    durationMinutes: draft.durationMinutes,
    ...(draft.meetingUrl ? { meetingUrl: draft.meetingUrl } : {}),
  }
}

/** What the edit sheet collects: the new settings in the rule's own zone, from a date. */
export interface RecurringChangeDraft {
  /** `yyyy-MM-dd` in the rule's zone. */
  effectiveFrom: string
  weekday: Weekday
  /** `HH:mm` in the rule's zone. */
  localTime: string
  intervalWeeks: 1 | 2
  durationMinutes: number
  meetingUrl: string
}

/**
 * The `PATCH /recurring-lessons/{id}` body: `effectiveFrom` and only what differs from the rule —
 * an emptied link goes out as `null` (the API removes it), the zone is never sent (the rule keeps
 * its own). `null` when nothing changed, so no request goes out (the API would answer `400`).
 */
export function recurringChangeBody(
  rule: Pick<
    RecurringLesson,
    'weekday' | 'localTime' | 'intervalWeeks' | 'durationMinutes' | 'meetingUrl'
  >,
  draft: RecurringChangeDraft,
): UpdateRecurringLessonRequest | null {
  const body: UpdateRecurringLessonRequest = { effectiveFrom: draft.effectiveFrom }
  if (draft.weekday !== rule.weekday) body.weekday = draft.weekday
  if (draft.localTime !== rule.localTime) body.localTime = draft.localTime
  if (draft.intervalWeeks !== rule.intervalWeeks) body.intervalWeeks = draft.intervalWeeks
  if (draft.durationMinutes !== rule.durationMinutes) body.durationMinutes = draft.durationMinutes
  const link = draft.meetingUrl.trim()
  if ((link || null) !== rule.meetingUrl) body.meetingUrl = link || null
  return Object.keys(body).length > 1 ? body : null
}
