import { addDays, addMonths, format, isValid, parse, startOfMonth } from 'date-fns'
import type { FinancePeriod } from '@/api/types'

/** The periods the Finance tab offers; `this-month` is the default (no `period` in the URL). */
export type PeriodKind = 'this-month' | 'previous-month' | 'custom'

/**
 * The admin's pick as the URL keeps it: `?period=previous-month`, or
 * `?period=custom&from=2026-09-01&to=2026-09-15` with local calendar days, both included.
 */
export interface PeriodChoice {
  kind: PeriodKind
  fromDay: string
  toDay: string
}

/** The keys the period owns in the URL; changing them sends both tables back to their first page. */
export const PERIOD_KEYS = ['period', 'from', 'to'] as const

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/

function parseDay(day: string): Date | null {
  if (!DAY_PATTERN.test(day)) return null
  const date = parse(day, 'yyyy-MM-dd', new Date())
  return isValid(date) ? date : null
}

/** A local calendar day as a `date` input value. */
export function dayInput(date: Date): string {
  return format(date, 'yyyy-MM-dd')
}

export function periodFromParams(params: URLSearchParams): PeriodChoice {
  const kind = params.get('period')
  return {
    kind: kind === 'previous-month' || kind === 'custom' ? kind : 'this-month',
    fromDay: params.get('from') ?? '',
    toDay: params.get('to') ?? '',
  }
}

/** The URL keys for a pick; this month is the default and leaves none. */
export function periodParams(
  choice: PeriodChoice,
): Record<(typeof PERIOD_KEYS)[number], string | null> {
  const custom = choice.kind === 'custom'
  return {
    period: choice.kind === 'this-month' ? null : choice.kind,
    from: custom && choice.fromDay ? choice.fromDay : null,
    to: custom && choice.toDay ? choice.toDay : null,
  }
}

/**
 * The local days a pick covers, both included; `null` for custom days that are missing, invalid or
 * out of order.
 */
export function periodDays(
  choice: PeriodChoice,
  now: Date = new Date(),
): { first: Date; last: Date } | null {
  switch (choice.kind) {
    case 'this-month': {
      const first = startOfMonth(now)
      return { first, last: addDays(addMonths(first, 1), -1) }
    }
    case 'previous-month': {
      const first = startOfMonth(addMonths(now, -1))
      return { first, last: addDays(startOfMonth(now), -1) }
    }
    case 'custom': {
      const first = parseDay(choice.fromDay)
      const last = parseDay(choice.toDay)
      return first && last && first <= last ? { first, last } : null
    }
  }
}

/**
 * The API's period (`[from, to)`, API.md §9.7) for a pick: the start of its first local day to the
 * start of the day after its last, as instants. Calendar arithmetic keeps a month with a clock
 * change whole (October in Bucharest is 31 days and one hour).
 */
export function periodRange(choice: PeriodChoice, now: Date = new Date()): FinancePeriod | null {
  const days = periodDays(choice, now)
  return days ? { from: days.first.toISOString(), to: addDays(days.last, 1).toISOString() } : null
}

/** "October 2026" for a month, "1 Sep 2026 – 15 Sep 2026" for custom days. */
export function periodLabel(choice: PeriodChoice, now: Date = new Date()): string | null {
  const days = periodDays(choice, now)
  if (!days) return null
  return choice.kind === 'custom'
    ? `${format(days.first, 'd MMM yyyy')} – ${format(days.last, 'd MMM yyyy')}`
    : format(days.first, 'MMMM yyyy')
}

/** Custom days to start from when the admin switches to Custom: the month shown so far. */
export function customFrom(choice: PeriodChoice, now: Date = new Date()): PeriodChoice {
  if (choice.kind === 'custom') return choice
  const days = periodDays(choice, now)
  return {
    kind: 'custom',
    fromDay: days ? dayInput(days.first) : '',
    toDay: days ? dayInput(days.last) : '',
  }
}

/** The browser's IANA time zone, which the period's days are counted in. */
export function localTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone
}
