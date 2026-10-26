import { describe, expect, it } from 'vitest'
import {
  addDays,
  addMinutes,
  addMonths,
  dayLabelKind,
  differenceInCalendarDays,
  endOfDay,
  endOfMonth,
  firstDayOfWeek,
  formatHour,
  formatMonthSpan,
  formatTimeRange,
  formatWeekdayTimeRange,
  fromDateTimeLocal,
  lastSecondOfDay,
  minutesIntoDay,
  nextQuarterHour,
  parseLocalDate,
  pickTimeZone,
  startOfMonth,
  startOfWeek,
  toDateTimeLocal,
  toIsoWithOffset,
} from './dates'

// `vitest.config.ts` runs every test in Europe/Bucharest: the clocks go forward on 29 March 2026
// (a 23-hour day) and back on 25 October 2026 (25 hours), so the daylight-saving cases are real.
describe('dates', () => {
  it('serialises with the local offset and round-trips through Date', () => {
    const date = new Date(2026, 2, 12, 17, 0, 0)
    const iso = toIsoWithOffset(date)
    expect(iso).toBe('2026-03-12T17:00:00+02:00')
    expect(new Date(iso).getTime()).toBe(date.getTime())
    expect(toIsoWithOffset(new Date(2026, 9, 24, 18, 30))).toBe('2026-10-24T18:30:00+03:00')
  })

  it('ends a day at its last second, local time', () => {
    const end = lastSecondOfDay(new Date(2026, 9, 30, 8, 15))
    expect([end.getFullYear(), end.getMonth(), end.getDate()]).toEqual([2026, 9, 30])
    expect([end.getHours(), end.getMinutes(), end.getSeconds()]).toEqual([23, 59, 59])
  })

  it('rounds up to the next quarter hour', () => {
    expect(nextQuarterHour(new Date(2026, 2, 12, 17, 0, 30)).getMinutes()).toBe(15)
    expect(nextQuarterHour(new Date(2026, 2, 12, 17, 14, 0)).getMinutes()).toBe(15)
    const d = nextQuarterHour(new Date(2026, 2, 12, 17, 50, 0))
    expect(d.getHours()).toBe(18)
    expect(d.getMinutes()).toBe(0)
  })

  it('computes month bounds and day labels', () => {
    const now = new Date(2026, 2, 12, 12, 0, 0)
    expect(startOfMonth(now).getDate()).toBe(1)
    expect(endOfMonth(now).getMonth()).toBe(3)
    expect(dayLabelKind(new Date(2026, 2, 12, 23, 0), now)).toBe('today')
    expect(dayLabelKind(new Date(2026, 2, 13, 1, 0), now)).toBe('tomorrow')
    expect(dayLabelKind(new Date(2026, 2, 11, 1, 0), now)).toBe('yesterday')
    expect(dayLabelKind(new Date(2026, 2, 20), now)).toBe('other')
  })

  it('converts a local moment to and from a datetime-local value', () => {
    expect(toDateTimeLocal(new Date(2026, 9, 24, 9, 5))).toBe('2026-10-24T09:05')
    expect(fromDateTimeLocal('2026-10-24T09:05')).toEqual(new Date(2026, 9, 24, 9, 5))
    expect(fromDateTimeLocal('')).toBeNull()
    expect(fromDateTimeLocal('nonsense')).toBeNull()
  })
})

describe('lesson times', () => {
  it('shows a lesson as its local start and end, across midnight too', () => {
    expect(formatTimeRange(new Date(2026, 2, 12, 17, 0), 60, 'en-GB')).toBe('17:00–18:00')
    expect(formatTimeRange(new Date(2026, 2, 12, 23, 30), 45, 'en-GB')).toBe('23:30–00:15')
    expect(formatWeekdayTimeRange(new Date(2026, 2, 12, 17, 0), 90, 'en-GB')).toBe(
      'Thursday, 17:00–18:30',
    )
    expect(addMinutes(new Date(2026, 2, 12, 17, 0), 240).getHours()).toBe(21)
  })
})

describe('pickTimeZone', () => {
  it('takes the first IANA zone and skips offsets the API refuses', () => {
    expect(pickTimeZone(['Europe/Bucharest', 'UTC'])).toBe('Europe/Bucharest')
    expect(pickTimeZone(['GMT+1', 'America/Argentina/Buenos_Aires'])).toBe(
      'America/Argentina/Buenos_Aires',
    )
    expect(pickTimeZone([null, undefined, '+02:00', 'UTC'])).toBe('UTC')
    expect(pickTimeZone([null, 'GMT+1'])).toBe('UTC')
  })
})

describe('parseLocalDate', () => {
  it('reads a day without a time zone as that local day', () => {
    const day = parseLocalDate('2026-10-20')
    expect([day?.getFullYear(), day?.getMonth(), day?.getDate(), day?.getHours()]).toEqual([
      2026, 9, 20, 0,
    ])
    expect(parseLocalDate('2026-10-25')?.getDate()).toBe(25)
  })

  it('refuses anything that is not a real calendar day', () => {
    expect(parseLocalDate('2026-02-30')).toBeNull()
    expect(parseLocalDate('2026-10-20T10:00:00Z')).toBeNull()
    expect(parseLocalDate('')).toBeNull()
  })
})

describe('weeks and calendar days', () => {
  it("starts the week where the locale's region does", () => {
    expect(firstDayOfWeek('ro-RO')).toBe(1)
    expect(firstDayOfWeek('en-GB')).toBe(1)
    expect(firstDayOfWeek('en-US')).toBe(0)
    expect(firstDayOfWeek('ar-EG')).toBe(6)
    expect(firstDayOfWeek('dv-MV')).toBe(5)
    expect(firstDayOfWeek('ro')).toBe(1)
  })

  it('finds the start of Monday and Sunday weeks', () => {
    const saturday = new Date(2026, 9, 24, 15, 30)
    expect(startOfWeek(saturday, 1)).toEqual(new Date(2026, 9, 19))
    expect(startOfWeek(saturday, 0)).toEqual(new Date(2026, 9, 18))
    expect(startOfWeek(new Date(2026, 10, 1), 1)).toEqual(new Date(2026, 9, 26))
  })

  it('adds months and keeps the day inside shorter months', () => {
    expect(addMonths(new Date(2026, 0, 31, 9, 0), 1)).toEqual(new Date(2026, 1, 28, 9, 0))
    expect(addMonths(new Date(2026, 10, 15), 2)).toEqual(new Date(2027, 0, 15))
    expect(addMonths(new Date(2026, 0, 15), -1)).toEqual(new Date(2025, 11, 15))
  })

  it('counts calendar days across daylight-saving changes', () => {
    expect(endOfDay(new Date(2026, 2, 29)).getTime() - new Date(2026, 2, 29).getTime()).toBe(
      23 * 3_600_000,
    )
    expect(endOfDay(new Date(2026, 9, 25)).getTime() - new Date(2026, 9, 25).getTime()).toBe(
      25 * 3_600_000,
    )
    expect(differenceInCalendarDays(new Date(2026, 2, 30), new Date(2026, 2, 29, 23, 30))).toBe(1)
    expect(differenceInCalendarDays(new Date(2026, 9, 26, 0, 30), new Date(2026, 9, 25))).toBe(1)
    expect(differenceInCalendarDays(new Date(2026, 2, 1), new Date(2026, 3, 1))).toBe(-31)
    expect(addDays(new Date(2026, 9, 24, 17, 0), 2)).toEqual(new Date(2026, 9, 26, 17, 0))
  })

  it('places a moment by the wall clock, on daylight-saving days too', () => {
    expect(minutesIntoDay(new Date(2026, 2, 29, 5, 0))).toBe(300)
    expect(minutesIntoDay(new Date(2026, 9, 25, 17, 15))).toBe(1035)
  })
})

describe('calendar titles', () => {
  it('names the months a window covers', () => {
    expect(formatMonthSpan(new Date(2026, 9, 19), new Date(2026, 9, 26), 'en-GB')).toBe(
      'October 2026',
    )
    expect(formatMonthSpan(new Date(2026, 11, 28), new Date(2027, 0, 4), 'en-GB')).toBe(
      'Dec 2026 – Jan 2027',
    )
    expect(formatMonthSpan(new Date(2026, 9, 26), new Date(2026, 10, 1), 'en-GB')).toBe(
      'October 2026',
    )
  })

  it('labels the hour lines the same on daylight-saving days', () => {
    expect(formatHour(3, 'en-GB')).toBe('03:00')
    expect(formatHour(17, 'ro-RO')).toBe('17:00')
  })
})
