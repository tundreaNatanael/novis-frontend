import {
  addDays,
  addMonths,
  dayKey,
  differenceInCalendarDays,
  parseLocalDate,
  startOfDay,
  startOfMonth,
  startOfWeek,
  type Weekday,
} from '../lib/dates'

/** What the Calendar shows: a time grid of a day or a week, a month, or the lesson lists. */
export type CalendarView = 'day' | 'week' | 'month' | 'list'
export type GridView = Exclude<CalendarView, 'list'>

export const CALENDAR_VIEWS: readonly CalendarView[] = ['day', 'week', 'month', 'list']

export function isCalendarView(value: string | null | undefined): value is CalendarView {
  return (
    value !== null && value !== undefined && (CALENDAR_VIEWS as readonly string[]).includes(value)
  )
}

/**
 * Local days `[start, end)`: both ends are local midnights, so a day in it may last 23 or 25
 * hours. It is what one `GET /teacher/calendar` request asks for.
 */
export type CalendarWindow = { start: Date; end: Date }

/** Six weeks from the first `weekStartsOn` on or before the 1st: every month fits and the grid never changes height. */
export function monthGridWindow(month: Date, weekStartsOn: Weekday): CalendarWindow {
  const start = startOfWeek(startOfMonth(month), weekStartsOn)
  return { start, end: addDays(start, 42) }
}

/** The window a view shows around `anchor` (a local day): the day, its week, or its month's six-week grid. */
export function windowFor(view: GridView, anchor: Date, weekStartsOn: Weekday): CalendarWindow {
  switch (view) {
    case 'day': {
      const start = startOfDay(anchor)
      return { start, end: addDays(start, 1) }
    }
    case 'week': {
      const start = startOfWeek(anchor, weekStartsOn)
      return { start, end: addDays(start, 7) }
    }
    case 'month':
      return monthGridWindow(anchor, weekStartsOn)
  }
}

/** The anchor one step back or forth: a day, a week, or a month (today in it, else its 1st). */
export function stepAnchor(view: GridView, anchor: Date, direction: -1 | 1, today: Date): Date {
  switch (view) {
    case 'day':
      return addDays(startOfDay(anchor), direction)
    case 'week':
      return addDays(startOfDay(anchor), 7 * direction)
    case 'month':
      return selectedDayOf(addMonths(startOfMonth(anchor), direction), today)
  }
}

/** The windows on either side of the visible one, to prefetch. */
export function neighbourWindows(
  view: GridView,
  anchor: Date,
  weekStartsOn: Weekday,
  today: Date,
): CalendarWindow[] {
  return [
    windowFor(view, stepAnchor(view, anchor, -1, today), weekStartsOn),
    windowFor(view, stepAnchor(view, anchor, 1, today), weekStartsOn),
  ]
}

/** The local days of a window, one per column or cell. */
export function daysOf(window: CalendarWindow): Date[] {
  return Array.from({ length: differenceInCalendarDays(window.end, window.start) }, (_, i) =>
    addDays(window.start, i),
  )
}

/** Whether a local day falls in the window. */
export function windowHolds(window: CalendarWindow, day: Date): boolean {
  const index = differenceInCalendarDays(day, window.start)
  return index >= 0 && index < differenceInCalendarDays(window.end, window.start)
}

/** The day a month page selects: today in the current month, else the 1st. */
export function selectedDayOf(month: Date, today: Date): Date {
  return today.getFullYear() === month.getFullYear() && today.getMonth() === month.getMonth()
    ? startOfDay(today)
    : startOfMonth(month)
}

/** The anchor a URL names (`?date=2026-10-24`), else today. */
export function anchorFromParam(value: string | null, today: Date): Date {
  return (value && parseLocalDate(value)) || startOfDay(today)
}

/** The URL value of an anchor. */
export function anchorParam(anchor: Date): string {
  return dayKey(anchor)
}
