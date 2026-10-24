import { addDays, format, isValid, parse } from 'date-fns'
import type { PayoutLesson } from '@/api/types'

/** Lessons per page of the payable table. A payout takes at most 500 lessons (API.md §1.7). */
export const PAYABLE_PAGE_SIZE = 50
export const PAYOUT_MAX_LESSONS = 500
export const HISTORY_PAGE_SIZE = 10
/** What the admin types before a payout is voided. */
export const VOID_CONFIRM_TEXT = 'void'
/** The id of the Payouts panel on a teacher's page; a link ending in `#payouts` scrolls to it. */
export const PAYOUTS_ANCHOR = 'payouts'

/** A teacher's page opened at their Payouts panel, inside a workspace (`basePath`). */
export function payoutsPath(basePath: string, teacherId: string): string {
  return `${basePath}/teachers/${teacherId}#${PAYOUTS_ANCHOR}`
}

/** Today as a `date` input value (`yyyy-MM-dd`) in the browser's time zone. */
export function todayInput(now: Date = new Date()): string {
  return format(now, 'yyyy-MM-dd')
}

function parseDay(day: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null
  const date = parse(day, 'yyyy-MM-dd', new Date())
  return isValid(date) ? date : null
}

/**
 * `upTo` for "Pay everything up to <day>": the start of the following local day as an ISO
 * instant, so that every lesson of that day is included (the API pays what is dated before it).
 */
export function upToInstant(day: string): string | null {
  const date = parseDay(day)
  return date ? addDays(date, 1).toISOString() : null
}

/** A day the school may have paid on: a real date, today at the latest. */
export function isPaidOnAllowed(day: string, now: Date = new Date()): boolean {
  return parseDay(day) !== null && day <= todayInput(now)
}

/** The selection with one lesson added or removed. */
export function toggled(selection: ReadonlySet<string>, id: string, on: boolean): Set<string> {
  const next = new Set(selection)
  if (on) next.add(id)
  else next.delete(id)
  return next
}

/** The selection with a whole page of lessons added or removed. */
export function toggledAll(
  selection: ReadonlySet<string>,
  ids: readonly string[],
  on: boolean,
): Set<string> {
  const next = new Set(selection)
  for (const id of ids) {
    if (on) next.add(id)
    else next.delete(id)
  }
  return next
}

/** The header checkbox of a page: every lesson of it selected, some, or none. */
export function pageSelectionState(
  selection: ReadonlySet<string>,
  ids: readonly string[],
): boolean | 'indeterminate' {
  const selected = ids.filter((id) => selection.has(id)).length
  if (selected === 0) return false
  return selected === ids.length ? true : 'indeterminate'
}

/** A payable or paid-out lesson in one line: who, and the course when there is one. */
export function lessonLabel(lesson: Pick<PayoutLesson, 'studentName' | 'courseTitle'>): string {
  return lesson.courseTitle ? `${lesson.studentName} · ${lesson.courseTitle}` : lesson.studentName
}
