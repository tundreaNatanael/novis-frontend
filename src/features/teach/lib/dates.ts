/**
 * Date helpers of the teacher workspace, the mobile app's (`novis-mobile/src/lib/dates.ts`)
 * without the device APIs. Display always uses the browser's time zone and the active locale;
 * values sent to the API are ISO-8601 with the browser's offset.
 */

const pad = (n: number) => String(Math.abs(n)).padStart(2, '0')

/** `2030-01-11T10:00:00+02:00` — the backend normalises to UTC. */
export function toIsoWithOffset(date: Date): string {
  const offsetMinutes = -date.getTimezoneOffset()
  const sign = offsetMinutes >= 0 ? '+' : '-'
  const hh = pad(Math.floor(Math.abs(offsetMinutes) / 60))
  const mm = pad(Math.abs(offsetMinutes) % 60)
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}${sign}${hh}:${mm}`
  )
}

/** An IANA region id ("Europe/Bucharest", "America/Argentina/Buenos_Aires") or "UTC". */
const IANA_ZONE = /^(?:UTC|[A-Za-z_]+(?:\/[A-Za-z0-9_+-]+)+)$/

/**
 * The first candidate that is an IANA time-zone id, else `UTC`. A browser may report an offset
 * such as `GMT+1`, which has no daylight saving time and which the API refuses.
 */
export function pickTimeZone(candidates: (string | null | undefined)[]): string {
  return candidates.find((zone): zone is string => !!zone && IANA_ZONE.test(zone)) ?? 'UTC'
}

/**
 * The browser's IANA time zone, sent with a weekly series so its dates keep their local time
 * (17:00 stays 17:00) when daylight saving time starts or ends.
 */
export function browserTimeZone(): string {
  return pickTimeZone([Intl.DateTimeFormat().resolvedOptions().timeZone])
}

/** A moment `minutes` later. */
export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000)
}

export function startOfDay(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

export function endOfDay(date: Date): Date {
  const d = startOfDay(date)
  d.setDate(d.getDate() + 1)
  return d
}

/** The last second of the local day: what "due on this day" means (overdue from the next day). */
export function lastSecondOfDay(date: Date): Date {
  const d = new Date(date)
  d.setHours(23, 59, 59, 0)
  return d
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0)
}

export function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 1, 0, 0, 0, 0)
}

/**
 * A calendar day the API sends without a time zone (`2026-10-20`, e.g. a payout's `paidOn`) as
 * local midnight, so it formats as that day everywhere; `new Date('2026-10-20')` would be UTC
 * midnight and show the day before west of Greenwich. `null` for anything else.
 */
export function parseLocalDate(day: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const date = Number(match[3])
  const parsed = new Date(year, month - 1, date)
  return parsed.getMonth() === month - 1 && parsed.getDate() === date ? parsed : null
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

/** The same day `months` later (the month's last day when it is shorter), at the same local time. */
export function addMonths(date: Date, months: number): Date {
  const d = new Date(
    date.getFullYear(),
    date.getMonth() + months,
    1,
    date.getHours(),
    date.getMinutes(),
    date.getSeconds(),
    date.getMilliseconds(),
  )
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
  d.setDate(Math.min(date.getDate(), lastDay))
  return d
}

/** Whole local calendar days from `earlier` to `later`: a 23- or 25-hour day still counts as one. */
export function differenceInCalendarDays(later: Date, earlier: Date): number {
  const utcDay = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())
  return Math.round((utcDay(later) - utcDay(earlier)) / 86_400_000)
}

/** Minutes since local midnight by the wall clock: where a moment sits on a day's time grid. */
export function minutesIntoDay(date: Date): number {
  return date.getHours() * 60 + date.getMinutes()
}

/** A day of the week the way `Date#getDay()` numbers it: 0 = Sunday … 6 = Saturday. */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6

/** Regions whose weeks start on Sunday, Saturday or Friday (CLDR `weekData`); all others start on Monday. */
const SUNDAY_FIRST = new Set(
  'AG AS BD BR BS BT BW BZ CA CO DM DO ET GT GU HK HN ID IL IN JM JP KE KH KR LA MH MM MO MT MX MZ NI NP PA PE PH PK PR PT PY SA SG SV TH TT TW UM US VE VI WS YE ZA ZW'.split(
    ' ',
  ),
)
const SATURDAY_FIRST = new Set('AE AF BH DJ DZ EG IQ IR JO KW LY OM QA SD SY'.split(' '))
const FRIDAY_FIRST = new Set(['MV'])

/**
 * The first day of the week where a BCP-47 tag's region is: Monday for `ro-RO` and `en-GB`,
 * Sunday for `en-US`; a tag without a region starts on Monday.
 */
export function firstDayOfWeek(localeTag: string): Weekday {
  const region = localeTag
    .split(/[-_]/)
    .slice(1)
    .find((part) => /^[A-Za-z]{2}$/.test(part))
    ?.toUpperCase()
  if (!region) return 1
  if (SUNDAY_FIRST.has(region)) return 0
  if (SATURDAY_FIRST.has(region)) return 6
  if (FRIDAY_FIRST.has(region)) return 5
  return 1
}

/** `Intl.Locale#getWeekInfo` where the browser has it (1 = Monday … 7 = Sunday), else `null`. */
function weekInfoFirstDay(localeTag: string): number | null {
  try {
    const locale = new Intl.Locale(localeTag) as Intl.Locale & {
      getWeekInfo?: () => { firstDay: number }
      weekInfo?: { firstDay: number }
    }
    const info = locale.getWeekInfo?.() ?? locale.weekInfo
    return info && info.firstDay >= 1 && info.firstDay <= 7 ? info.firstDay : null
  } catch {
    return null
  }
}

/**
 * The first day of the week for the browser's language (its own locale data when it exposes it,
 * else the table above), the way the mobile app follows the device's. The workspace's language
 * does not change it: a teacher in the US keeps Sunday weeks in Romanian too.
 */
export function browserFirstDayOfWeek(fallbackTag: string): Weekday {
  const tag =
    typeof navigator !== 'undefined' && navigator.language ? navigator.language : fallbackTag
  const fromIntl = weekInfoFirstDay(tag)
  if (fromIntl !== null) return (fromIntl % 7) as Weekday
  return firstDayOfWeek(tag)
}

/** Local midnight of the last `weekStartsOn` on or before `date`. */
export function startOfWeek(date: Date, weekStartsOn: Weekday): Date {
  const day = startOfDay(date)
  return addDays(day, -((day.getDay() - weekStartsOn + 7) % 7))
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

/** Round up to the next quarter hour — a friendly default when booking. */
export function nextQuarterHour(from: Date = new Date()): Date {
  const d = new Date(from)
  d.setSeconds(0, 0)
  const minutes = d.getMinutes()
  const rounded = Math.ceil((minutes + 1) / 15) * 15
  d.setMinutes(rounded)
  return d
}

export type DayLabelKind = 'today' | 'tomorrow' | 'yesterday' | 'other'

export function dayLabelKind(date: Date, now: Date = new Date()): DayLabelKind {
  if (isSameDay(date, now)) return 'today'
  if (isSameDay(date, addDays(now, 1))) return 'tomorrow'
  if (isSameDay(date, addDays(now, -1))) return 'yesterday'
  return 'other'
}

export function formatTime(date: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(date)
}

/** "17:00–18:00": a lesson's local start and end. */
export function formatTimeRange(start: Date, minutes: number, locale: string): string {
  return `${formatTime(start, locale)}–${formatTime(addMinutes(start, minutes), locale)}`
}

export function formatWeekday(date: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(date)
}

/** "Thursday, 17:00–18:00" */
export function formatWeekdayTimeRange(date: Date, minutes: number, locale: string): string {
  return `${capitalize(formatWeekday(date, locale))}, ${formatTimeRange(date, minutes, locale)}`
}

/** "Thu 12 Mar" */
export function formatShortDate(date: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(date)
}

/** "12 March 2026" */
export function formatLongDate(date: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric' }).format(
    date,
  )
}

/** "Thursday, 12 March" */
export function formatWeekdayDate(date: Date, locale: string): string {
  return capitalize(
    new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long' }).format(
      date,
    ),
  )
}

/** "12 Mar 2026, 17:00" */
export function formatDateTime(date: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

/** "March 2026" */
export function formatMonthYear(date: Date, locale: string): string {
  return capitalize(
    new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(date),
  )
}

/**
 * The months local days `[start, end)` fall in: "October 2026", or "Sep – Oct 2026" and
 * "Dec 2026 – Jan 2027" when they span two.
 */
export function formatMonthSpan(start: Date, end: Date, locale: string): string {
  const last = addDays(end, -1)
  if (start.getFullYear() === last.getFullYear() && start.getMonth() === last.getMonth()) {
    return formatMonthYear(start, locale)
  }
  const month = (date: Date) =>
    capitalize(new Intl.DateTimeFormat(locale, { month: 'short' }).format(date))
  if (start.getFullYear() === last.getFullYear()) {
    return `${month(start)} – ${month(last)} ${last.getFullYear()}`
  }
  return `${month(start)} ${start.getFullYear()} – ${month(last)} ${last.getFullYear()}`
}

/** "Mon", or "M" with `narrow`: the column heads of a week. */
export function formatWeekdayShort(date: Date, locale: string, narrow = false): string {
  return capitalize(
    new Intl.DateTimeFormat(locale, { weekday: narrow ? 'narrow' : 'short' }).format(date),
  )
}

/** "17:00": an hour line of the time grid (a fixed day, so a daylight-saving change never shifts it). */
export function formatHour(hour: number, locale: string): string {
  return formatTime(new Date(2001, 0, 1, hour), locale)
}

/** Stable per-day key for grouping and URLs ("2026-03-12"). */
export function dayKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** The `datetime-local` input value of a local moment, to the minute. */
export function toDateTimeLocal(date: Date): string {
  return `${dayKey(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** The local moment a `datetime-local` input holds, or `null` when empty or unreadable. */
export function fromDateTimeLocal(value: string): Date | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export function capitalize(value: string): string {
  return value.length === 0 ? value : value[0]!.toUpperCase() + value.slice(1)
}
