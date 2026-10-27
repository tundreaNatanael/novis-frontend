import { describe, expect, it } from 'vitest'
import { balanceValue } from './lesson-totals'

describe('balanceValue', () => {
  it('signs a balance paid in advance and shows arrears as the amount owed, without a minus', () => {
    expect(balanceValue(2)).toBe('+2')
    expect(balanceValue(0)).toBe('0')
    expect(balanceValue(-3)).toBe('3')
  })
})
