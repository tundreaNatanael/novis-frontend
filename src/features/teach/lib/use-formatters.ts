import { useMemo } from 'react'
import { useI18n } from '../i18n/use-i18n'
import {
  browserFirstDayOfWeek,
  dayLabelKind,
  formatDateTime,
  formatHour,
  formatLongDate,
  formatMonthSpan,
  formatMonthYear,
  formatShortDate,
  formatTime,
  formatTimeRange,
  formatWeekdayDate,
  formatWeekdayShort,
  formatWeekdayTimeRange,
} from './dates'

/** Locale-aware date formatting bound to the workspace's language (the mobile app's `useFormatters`). */
export function useFormatters() {
  const { localeTag, t } = useI18n()
  return useMemo(
    () => ({
      localeTag,
      /** The browser's first day of the week (0 = Sunday … 6 = Saturday). */
      weekStartsOn: browserFirstDayOfWeek(localeTag),
      time: (d: Date) => formatTime(d, localeTag),
      /** "17:00": an hour line of the calendar's time grid. */
      hour: (hour: number) => formatHour(hour, localeTag),
      /** "Mon" (or "M" with `narrow`): a week column's head. */
      weekdayShort: (d: Date, narrow = false) => formatWeekdayShort(d, localeTag, narrow),
      /** "24": a day number in a calendar. */
      dayOfMonth: (d: Date) => new Intl.DateTimeFormat(localeTag, { day: 'numeric' }).format(d),
      /** "October 2026" or "Sep – Oct 2026": the months a calendar window covers. */
      monthSpan: (start: Date, end: Date) => formatMonthSpan(start, end, localeTag),
      /** "17:00–18:00" */
      timeRange: (d: Date, minutes: number) => formatTimeRange(d, minutes, localeTag),
      /** "Thursday, 17:00–18:00" */
      weekdayTimeRange: (d: Date, minutes: number) => formatWeekdayTimeRange(d, minutes, localeTag),
      /** "45 min", "1 h", "1 h 30 min" */
      duration: (minutes: number) => {
        const hours = Math.floor(minutes / 60)
        const rest = minutes % 60
        if (hours === 0) return t('lesson.durationMinutes', { count: rest })
        return rest === 0
          ? t('lesson.durationHours', { count: hours })
          : t('lesson.durationHoursMinutes', { hours, minutes: rest })
      },
      shortDate: (d: Date) => formatShortDate(d, localeTag),
      longDate: (d: Date) => formatLongDate(d, localeTag),
      dateTime: (d: Date) => formatDateTime(d, localeTag),
      weekdayDate: (d: Date) => formatWeekdayDate(d, localeTag),
      monthYear: (d: Date) => formatMonthYear(d, localeTag),
      /** "Today · Thu 12 Mar" or "Thursday, 12 March". */
      dayHeading: (d: Date) => {
        const kind = dayLabelKind(d)
        if (kind === 'other') return formatWeekdayDate(d, localeTag)
        const label =
          kind === 'today'
            ? t('common.today')
            : kind === 'tomorrow'
              ? t('common.tomorrow')
              : t('common.yesterday')
        return `${label} · ${formatShortDate(d, localeTag)}`
      },
      /** "Today, 17:00" or "Thu 12 Mar, 17:00" — compact for list rows. */
      whenShort: (d: Date) => {
        const kind = dayLabelKind(d)
        const time = formatTime(d, localeTag)
        if (kind === 'today') return `${t('common.today')}, ${time}`
        if (kind === 'tomorrow') return `${t('common.tomorrow')}, ${time}`
        return `${formatShortDate(d, localeTag)}, ${time}`
      },
      /** "Today, 17:00–18:00" or "Thu 12 Mar, 17:00–18:00" — a lesson in a list row. */
      whenShortRange: (d: Date, minutes: number) => {
        const kind = dayLabelKind(d)
        const range = formatTimeRange(d, minutes, localeTag)
        if (kind === 'today') return `${t('common.today')}, ${range}`
        if (kind === 'tomorrow') return `${t('common.tomorrow')}, ${range}`
        return `${formatShortDate(d, localeTag)}, ${range}`
      },
    }),
    [localeTag, t],
  )
}

export type Formatters = ReturnType<typeof useFormatters>
