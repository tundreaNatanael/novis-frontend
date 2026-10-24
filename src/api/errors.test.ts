import { describe, expect, it } from 'vitest'
import { ApiError, CONFLICT_COPY, errorMessage } from './errors'

describe('errorMessage', () => {
  it('words an overlapping lesson by its code, never by the server’s message', () => {
    const conflict = new ApiError(
      409,
      'SCHEDULE_CONFLICT',
      '3 of the series’ dates overlap other lessons',
    )

    expect(conflict.is('SCHEDULE_CONFLICT')).toBe(true)
    expect(errorMessage(conflict)).toBe(CONFLICT_COPY.SCHEDULE_CONFLICT)
  })

  it('keeps the server’s sentence for a plain conflict', () => {
    const conflict = new ApiError(409, 'CONFLICT', 'Only pending lessons can be closed')

    expect(errorMessage(conflict)).toBe('Only pending lessons can be closed')
  })
})
