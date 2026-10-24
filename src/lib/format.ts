import { addMinutes, format, formatDistanceToNow, isValid, parseISO } from 'date-fns'

/** Local date and time, e.g. "12 Oct 2026, 14:03". */
export function formatDateTime(iso: string | null | undefined): string {
  const date = parse(iso)
  return date ? format(date, 'd MMM yyyy, HH:mm') : '—'
}

/** Local date only, e.g. "12 Oct 2026". */
export function formatDate(iso: string | null | undefined): string {
  const date = parse(iso)
  return date ? format(date, 'd MMM yyyy') : '—'
}

/** Local time only, e.g. "14:03". */
export function formatTime(iso: string | null | undefined): string {
  const date = parse(iso)
  return date ? format(date, 'HH:mm') : '—'
}

/** A lesson's local start and end time, e.g. "14:00–15:00"; "—" without a start. */
export function formatTimeRange(iso: string | null | undefined, minutes: number): string {
  const date = parse(iso)
  return date ? `${format(date, 'HH:mm')}–${format(addMinutes(date, minutes), 'HH:mm')}` : '—'
}

/** A lesson's local date with its start and end time, e.g. "12 Oct 2026, 14:00–15:00". */
export function formatDateTimeRange(iso: string | null | undefined, minutes: number): string {
  const date = parse(iso)
  return date ? `${format(date, 'd MMM yyyy')}, ${formatTimeRange(iso, minutes)}` : '—'
}

/** A length in minutes: "45 min", "1 h", "1 h 30 min". */
export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (hours === 0) return `${rest} min`
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`
}

/** "in 3 days" / "2 hours ago". */
export function formatRelative(iso: string | null | undefined): string {
  const date = parse(iso)
  return date ? formatDistanceToNow(date, { addSuffix: true }) : '—'
}

/** The UTC instant as the API sent it, for tooltips. */
export function utcLabel(iso: string | null | undefined): string {
  const date = parse(iso)
  return date
    ? `${date
        .toISOString()
        .replace('T', ' ')
        .replace(/\.\d{3}Z$/, ' UTC')}`
    : ''
}

/** The `datetime-local` input value for an ISO instant (local time, minute precision). */
export function toDateTimeLocal(iso: string | null | undefined): string {
  const date = parse(iso)
  return date ? format(date, "yyyy-MM-dd'T'HH:mm") : ''
}

/** ISO UTC instant for a `datetime-local` value, or `null` when empty. */
export function fromDateTimeLocal(value: string): string | null {
  if (!value) return null
  const date = new Date(value)
  return isValid(date) ? date.toISOString() : null
}

/** The `date` input value (local day) for an ISO instant, or `''` without one. */
export function toDateInput(iso: string | null | undefined): string {
  const date = parse(iso)
  return date ? format(date, 'yyyy-MM-dd') : ''
}

/**
 * ISO UTC instant for the last second of a `date` input's local day, or `null` when empty:
 * homework due on a day is overdue from the next day on.
 */
export function endOfLocalDay(value: string): string | null {
  if (!value) return null
  const date = new Date(`${value}T23:59:59`)
  return isValid(date) ? date.toISOString() : null
}

/** The first group of a UUID, for dense tables ("3e340795…"). */
export function shortId(id: string): string {
  return `${id.slice(0, 8)}…`
}

const ENUM_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'Super-admin',
  ADMIN: 'Admin',
  TEACHER: 'Teacher',
  STUDENT: 'Student',
  ACTIVE: 'Active',
  DISABLED: 'Disabled',
  ARCHIVED: 'Archived',
  DROPPED: 'Dropped',
  COMPLETED: 'Completed',
  PENDING: 'Pending',
  PRESENT: 'Held',
  CANCELED: 'Canceled',
  CANCELED_LATE: 'Canceled late',
}

/** A readable label for an enum value; the raw value stays available for tooltips. */
export function enumLabel(value: string | null | undefined): string {
  if (!value) return '—'
  return ENUM_LABELS[value] ?? value.charAt(0) + value.slice(1).toLowerCase().replace(/_/g, ' ')
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`
}

function parse(iso: string | null | undefined): Date | null {
  if (!iso) return null
  const date = parseISO(iso)
  return isValid(date) ? date : null
}
