import { describe, expect, it } from 'vitest'
import {
  customFrom,
  periodFromParams,
  periodLabel,
  periodParams,
  periodRange,
  type PeriodChoice,
} from './finance-period'

const MID_OCTOBER = new Date(2026, 9, 15, 12)
const THIS_MONTH: PeriodChoice = { kind: 'this-month', fromDay: '', toDay: '' }
const PREVIOUS_MONTH: PeriodChoice = { kind: 'previous-month', fromDay: '', toDay: '' }
const custom = (fromDay: string, toDay: string): PeriodChoice => ({
  kind: 'custom',
  fromDay,
  toDay,
})

describe('finance periods', () => {
  it('runs a month from its first local midnight to the next month’s', () => {
    expect(periodRange(THIS_MONTH, MID_OCTOBER)).toEqual({
      from: new Date(2026, 9, 1).toISOString(),
      to: new Date(2026, 10, 1).toISOString(),
    })
    expect(periodRange(PREVIOUS_MONTH, MID_OCTOBER)).toEqual({
      from: new Date(2026, 8, 1).toISOString(),
      to: new Date(2026, 9, 1).toISOString(),
    })
    expect(periodRange(PREVIOUS_MONTH, new Date(2027, 0, 10))).toEqual({
      from: new Date(2026, 11, 1).toISOString(),
      to: new Date(2027, 0, 1).toISOString(),
    })
  })

  it('keeps a month with a clock change whole, whatever the time zone', () => {
    // Europe moves its clocks on 25 October 2026: in Bucharest October has 31 days and one hour.
    const { from, to } = periodRange(THIS_MONTH, MID_OCTOBER)!
    expect(new Date(from).getDate()).toBe(1)
    expect(new Date(from).getHours()).toBe(0)
    expect(new Date(to).getMonth()).toBe(10)
    expect(new Date(to).getHours()).toBe(0)
  })

  it('ends custom days at the start of the day after the last one', () => {
    expect(periodRange(custom('2026-09-01', '2026-09-15'), MID_OCTOBER)).toEqual({
      from: new Date(2026, 8, 1).toISOString(),
      to: new Date(2026, 8, 16).toISOString(),
    })
    expect(periodRange(custom('2026-09-15', '2026-09-15'), MID_OCTOBER)).toEqual({
      from: new Date(2026, 8, 15).toISOString(),
      to: new Date(2026, 8, 16).toISOString(),
    })
  })

  it('has no period for custom days that are missing, invalid or out of order', () => {
    for (const [fromDay, toDay] of [
      ['', '2026-09-15'],
      ['2026-09-01', ''],
      ['2026-09-16', '2026-09-15'],
      ['2026-02-30', '2026-03-01'],
      ['1 Sep', '2026-09-15'],
    ]) {
      expect(periodRange(custom(fromDay!, toDay!), MID_OCTOBER)).toBeNull()
    }
  })

  it('reads and writes the URL, this month leaving no trace', () => {
    expect(periodFromParams(new URLSearchParams())).toEqual(THIS_MONTH)
    expect(periodFromParams(new URLSearchParams('period=yearly'))).toEqual(THIS_MONTH)
    expect(periodFromParams(new URLSearchParams('period=previous-month'))).toEqual(PREVIOUS_MONTH)
    expect(
      periodFromParams(new URLSearchParams('period=custom&from=2026-09-01&to=2026-09-15')),
    ).toEqual(custom('2026-09-01', '2026-09-15'))
    expect(periodParams(THIS_MONTH)).toEqual({ period: null, from: null, to: null })
    expect(periodParams({ ...PREVIOUS_MONTH, fromDay: '2026-09-01' })).toEqual({
      period: 'previous-month',
      from: null,
      to: null,
    })
    expect(periodParams(custom('2026-09-01', ''))).toEqual({
      period: 'custom',
      from: '2026-09-01',
      to: null,
    })
  })

  it('starts custom days from the month shown and labels every period', () => {
    expect(customFrom(PREVIOUS_MONTH, MID_OCTOBER)).toEqual(custom('2026-09-01', '2026-09-30'))
    expect(customFrom(THIS_MONTH, MID_OCTOBER)).toEqual(custom('2026-10-01', '2026-10-31'))
    expect(customFrom(custom('2026-09-03', '2026-09-04'), MID_OCTOBER)).toEqual(
      custom('2026-09-03', '2026-09-04'),
    )
    expect(periodLabel(THIS_MONTH, MID_OCTOBER)).toBe('October 2026')
    expect(periodLabel(PREVIOUS_MONTH, MID_OCTOBER)).toBe('September 2026')
    expect(periodLabel(custom('2026-09-01', '2026-09-15'), MID_OCTOBER)).toBe(
      '1 Sep 2026 – 15 Sep 2026',
    )
    expect(periodLabel(custom('2026-09-16', '2026-09-15'), MID_OCTOBER)).toBeNull()
  })
})
