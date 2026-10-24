import { describe, expect, it } from 'vitest'
import {
  isPaidOnAllowed,
  lessonLabel,
  pageSelectionState,
  todayInput,
  toggled,
  toggledAll,
  upToInstant,
} from './payout-state'

describe('payout dates', () => {
  it('pays up to the start of the next local day, so the whole picked day is included', () => {
    expect(upToInstant('2026-10-15')).toBe(new Date(2026, 9, 16).toISOString())
    // Across the clock change: the next local midnight, whatever its offset.
    expect(upToInstant('2026-10-25')).toBe(new Date(2026, 9, 26).toISOString())
    expect(upToInstant('')).toBeNull()
    expect(upToInstant('2026-13-01')).toBeNull()
    expect(upToInstant('15 October')).toBeNull()
  })

  it('accepts a paid-on day up to today, in the browser’s time zone', () => {
    const now = new Date(2026, 9, 24, 23, 30)
    expect(todayInput(now)).toBe('2026-10-24')
    expect(isPaidOnAllowed('2026-10-24', now)).toBe(true)
    expect(isPaidOnAllowed('2026-01-02', now)).toBe(true)
    expect(isPaidOnAllowed('2026-10-25', now)).toBe(false)
    expect(isPaidOnAllowed('', now)).toBe(false)
    expect(isPaidOnAllowed('2026-02-30', now)).toBe(false)
  })
})

describe('payable lesson selection', () => {
  it('adds and removes single lessons and whole pages', () => {
    const one = toggled(new Set(), 'a', true)
    expect([...one]).toEqual(['a'])
    expect([...toggled(one, 'a', false)]).toEqual([])
    const page = toggledAll(one, ['a', 'b', 'c'], true)
    expect([...page].sort()).toEqual(['a', 'b', 'c'])
    expect([...toggledAll(page, ['b', 'c'], false)]).toEqual(['a'])
  })

  it('tells the page header whether all, some or none of its lessons are ticked', () => {
    expect(pageSelectionState(new Set(), ['a', 'b'])).toBe(false)
    expect(pageSelectionState(new Set(['a']), ['a', 'b'])).toBe('indeterminate')
    expect(pageSelectionState(new Set(['a', 'b', 'z']), ['a', 'b'])).toBe(true)
  })

  it('labels a lesson with its student and course', () => {
    expect(lessonLabel({ studentName: 'Kid', courseTitle: 'Piano' })).toBe('Kid · Piano')
    expect(lessonLabel({ studentName: 'Kid', courseTitle: null })).toBe('Kid')
  })
})
