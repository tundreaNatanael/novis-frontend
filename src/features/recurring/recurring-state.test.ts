import { describe, expect, it } from 'vitest'
import { recurringLesson } from '@/test/fixtures'
import {
  describeRule,
  isWeeklyLesson,
  localTimeOf,
  nextOccurrenceOf,
  recurringBody,
  recurringChangeBody,
  ruleTimeRange,
  todayIn,
  weekdayOf,
  zoneDiffers,
} from './recurring-state'

describe('describing a weekly lesson', () => {
  it('reads "Every Tuesday, 17:00–18:00" and names the interval when it is two weeks', () => {
    expect(describeRule(recurringLesson())).toBe('Every Tuesday, 17:00–18:00')
    expect(describeRule(recurringLesson({ intervalWeeks: 2, weekday: 'SATURDAY' }))).toBe(
      'Every 2 weeks on Saturday, 17:00–18:00',
    )
  })

  it('wraps the end time past midnight', () => {
    expect(ruleTimeRange({ localTime: '23:30', durationMinutes: 45 })).toBe('23:30–00:15')
  })

  it('says when the rule keeps another zone than the browser', () => {
    expect(zoneDiffers(recurringLesson(), 'Europe/Bucharest')).toBe(false)
    expect(zoneDiffers(recurringLesson(), 'Europe/London')).toBe(true)
  })
})

describe('the next date of a weekly lesson', () => {
  const rule = recurringLesson({ startsOn: '2026-10-20', intervalWeeks: 1 })

  it('is the start while the rule has not started', () => {
    expect(nextOccurrenceOf(rule, '2026-10-01')).toBe('2026-10-20')
  })

  it('is today when today is one of its dates, else the next one', () => {
    expect(nextOccurrenceOf(rule, '2026-10-27')).toBe('2026-10-27')
    expect(nextOccurrenceOf(rule, '2026-10-28')).toBe('2026-11-03')
  })

  it('keeps the parity of a two-week rule and stops at endsOn', () => {
    const fortnightly = recurringLesson({ startsOn: '2026-10-20', intervalWeeks: 2 })
    expect(nextOccurrenceOf(fortnightly, '2026-10-28')).toBe('2026-11-03')
    expect(nextOccurrenceOf(fortnightly, '2026-11-04')).toBe('2026-11-17')
    expect(nextOccurrenceOf({ ...fortnightly, endsOn: '2026-11-10' }, '2026-11-04')).toBeNull()
    expect(nextOccurrenceOf({ ...fortnightly, endsOn: '2026-11-03' }, '2026-11-01')).toBe(
      '2026-11-03',
    )
  })

  it('does not drift across the clock change', () => {
    // Europe/Bucharest leaves daylight saving time on 2026-10-25.
    expect(nextOccurrenceOf(rule, '2026-10-21')).toBe('2026-10-27')
  })
})

describe('today in a zone', () => {
  it('is the calendar day the zone is on', () => {
    const noonUtc = new Date('2026-10-27T12:00:00Z')
    expect(todayIn('Europe/Bucharest', noonUtc)).toBe('2026-10-27')
    expect(todayIn('Pacific/Kiritimati', noonUtc)).toBe('2026-10-28')
    expect(todayIn('Pacific/Honolulu', new Date('2026-10-27T05:00:00Z'))).toBe('2026-10-26')
  })
})

describe('the weekday and time of a moment', () => {
  it('reads the browser clock', () => {
    const date = new Date(2026, 10, 3, 9, 5) // a Tuesday
    expect(weekdayOf(date)).toBe('TUESDAY')
    expect(localTimeOf(date)).toBe('09:05')
  })
})

describe('the set-up body', () => {
  it('sends the first lesson as an instant with the course and link only when given', () => {
    expect(
      recurringBody({
        studentId: 's-1',
        teacherId: 'u-1',
        courseId: '',
        firstAt: '2026-11-03T17:00',
        timeZone: 'Europe/Bucharest',
        intervalWeeks: 1,
        durationMinutes: 60,
        meetingUrl: '',
      }),
    ).toEqual({
      studentId: 's-1',
      teacherId: 'u-1',
      firstAt: '2026-11-03T15:00:00.000Z',
      timeZone: 'Europe/Bucharest',
      intervalWeeks: 1,
      durationMinutes: 60,
    })
    expect(
      recurringBody({
        studentId: 's-1',
        courseId: 'c-1',
        firstAt: '2026-11-03T17:00',
        timeZone: 'Europe/Bucharest',
        intervalWeeks: 2,
        durationMinutes: 45,
        meetingUrl: 'https://meet.example.com/a',
      }),
    ).toMatchObject({ courseId: 'c-1', intervalWeeks: 2, meetingUrl: 'https://meet.example.com/a' })
    expect(
      recurringBody({
        studentId: 's-1',
        courseId: '',
        firstAt: '',
        timeZone: 'UTC',
        intervalWeeks: 1,
        durationMinutes: 60,
        meetingUrl: '',
      }),
    ).toBeNull()
  })
})

describe('the change body', () => {
  const rule = recurringLesson({ meetingUrl: 'https://meet.example.com/old' })
  const same = {
    effectiveFrom: '2026-11-03',
    weekday: 'TUESDAY' as const,
    localTime: '17:00',
    intervalWeeks: 1 as const,
    durationMinutes: 60,
    meetingUrl: 'https://meet.example.com/old',
  }

  it('is nothing while nothing changed', () => {
    expect(recurringChangeBody(rule, same)).toBeNull()
  })

  it('carries effectiveFrom and only the settings that changed', () => {
    expect(recurringChangeBody(rule, { ...same, weekday: 'THURSDAY', localTime: '18:30' })).toEqual(
      { effectiveFrom: '2026-11-03', weekday: 'THURSDAY', localTime: '18:30' },
    )
    expect(recurringChangeBody(rule, { ...same, intervalWeeks: 2, durationMinutes: 45 })).toEqual({
      effectiveFrom: '2026-11-03',
      intervalWeeks: 2,
      durationMinutes: 45,
    })
  })

  it('removes an emptied link with null and sends a new one as typed', () => {
    expect(recurringChangeBody(rule, { ...same, meetingUrl: '  ' })).toEqual({
      effectiveFrom: '2026-11-03',
      meetingUrl: null,
    })
    expect(
      recurringChangeBody(rule, { ...same, meetingUrl: 'https://meet.example.com/new' }),
    ).toEqual({ effectiveFrom: '2026-11-03', meetingUrl: 'https://meet.example.com/new' })
    // A rule without a link and an empty field: nothing to send.
    expect(
      recurringChangeBody(recurringLesson({ meetingUrl: null }), { ...same, meetingUrl: '' }),
    ).toBeNull()
  })
})

describe('a weekly lesson mark', () => {
  it('follows recurringLessonId', () => {
    expect(isWeeklyLesson({ recurringLessonId: 'r-1' })).toBe(true)
    expect(isWeeklyLesson({ recurringLessonId: null })).toBe(false)
  })
})
