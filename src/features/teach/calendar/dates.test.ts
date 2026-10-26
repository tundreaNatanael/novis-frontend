import { describe, expect, it } from 'vitest'
import { dayKey } from '../lib/dates'
import {
  anchorFromParam,
  daysOf,
  monthGridWindow,
  selectedDayOf,
  stepAnchor,
  windowFor,
  windowHolds,
} from './dates'

// Tests run in Europe/Bucharest: the clocks go forward on 29 March 2026 and back on 25 October 2026.
const HOUR = 3_600_000
const saturday = new Date(2026, 9, 24, 15, 30) // Saturday 24 October 2026
const hours = (window: { start: Date; end: Date }) =>
  (window.end.getTime() - window.start.getTime()) / HOUR

describe('calendar windows', () => {
  it('runs a day window from local midnight to local midnight, 23 or 25 hours on clock-change days', () => {
    expect(windowFor('day', saturday, 1)).toEqual({
      start: new Date(2026, 9, 24),
      end: new Date(2026, 9, 25),
    })
    expect(hours(windowFor('day', new Date(2026, 9, 25, 12), 1))).toBe(25)
    expect(hours(windowFor('day', new Date(2026, 2, 29, 12), 1))).toBe(23)
  })

  it('starts weeks on the locale weekday and moves by whole weeks', () => {
    expect(windowFor('week', saturday, 1)).toEqual({
      start: new Date(2026, 9, 19),
      end: new Date(2026, 9, 26),
    })
    expect(hours(windowFor('week', saturday, 1))).toBe(7 * 24 + 1)
    expect(windowFor('week', saturday, 0)).toEqual({
      start: new Date(2026, 9, 18),
      end: new Date(2026, 9, 25),
    })
    expect(stepAnchor('week', saturday, -1, saturday)).toEqual(new Date(2026, 9, 17))
  })

  it('gives a month its six-week grid, which fits one request even across a clock change', () => {
    const october = windowFor('month', saturday, 1)
    expect(october).toEqual({ start: new Date(2026, 8, 28), end: new Date(2026, 10, 9) })
    expect(hours(october)).toBe(42 * 24 + 1)
    expect(monthGridWindow(new Date(2026, 1, 10), 0)).toEqual({
      start: new Date(2026, 1, 1),
      end: new Date(2026, 2, 15),
    })
    expect(daysOf(october)).toHaveLength(42)
  })

  it('steps months to today when it is in them, else to the 1st', () => {
    expect(stepAnchor('month', saturday, 1, saturday)).toEqual(new Date(2026, 10, 1))
    expect(stepAnchor('month', new Date(2026, 8, 10), 1, saturday)).toEqual(new Date(2026, 9, 24))
    expect(selectedDayOf(new Date(2026, 10, 1), saturday)).toEqual(new Date(2026, 10, 1))
  })

  it('lists the local days of a window and tells which days it holds', () => {
    const week = windowFor('week', saturday, 1)
    expect(daysOf(week).map(dayKey)).toEqual([
      '2026-10-19',
      '2026-10-20',
      '2026-10-21',
      '2026-10-22',
      '2026-10-23',
      '2026-10-24',
      '2026-10-25',
    ])
    expect(windowHolds(week, new Date(2026, 9, 25, 23, 30))).toBe(true)
    expect(windowHolds(week, new Date(2026, 9, 26, 0, 30))).toBe(false)
  })

  it('reads the anchor from the URL and falls back to today', () => {
    expect(anchorFromParam('2026-10-20', saturday)).toEqual(new Date(2026, 9, 20))
    expect(anchorFromParam('nonsense', saturday)).toEqual(new Date(2026, 9, 24))
    expect(anchorFromParam(null, saturday)).toEqual(new Date(2026, 9, 24))
  })
})
