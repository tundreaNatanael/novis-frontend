import { describe, expect, it } from 'vitest'
import { isVoided, monthWindow, paidOnDate } from './payouts'

// Tests run in Europe/Bucharest: October 2026 starts in summer time (+03:00) and ends after the
// clocks went back on the 25th (+02:00).
describe('monthWindow', () => {
  it('spans the local month with each bound in its own offset', () => {
    expect(monthWindow(new Date(2026, 9, 24, 18, 30))).toEqual({
      from: '2026-10-01T00:00:00+03:00',
      to: '2026-11-01T00:00:00+02:00',
    })
  })

  it('rolls over the year in December', () => {
    expect(monthWindow(new Date(2026, 11, 31, 23, 59))).toEqual({
      from: '2026-12-01T00:00:00+02:00',
      to: '2027-01-01T00:00:00+02:00',
    })
  })
})

describe('payouts', () => {
  it('reads the day the school paid as a local date and tells a voided payout apart', () => {
    const day = paidOnDate({ paidOn: '2026-10-20' })
    expect([day?.getFullYear(), day?.getMonth(), day?.getDate()]).toEqual([2026, 9, 20])
    expect(isVoided({ voidedAt: null })).toBe(false)
    expect(isVoided({ voidedAt: '2026-10-22T10:00:00Z' })).toBe(true)
  })
})
