import { describe, expect, it } from 'vitest'
import {
  enumLabel,
  formatDateTime,
  fromDateTimeLocal,
  shortId,
  toDateTimeLocal,
  utcLabel,
} from './format'

describe('format', () => {
  it('labels enums in sentence case with domain wording', () => {
    expect(enumLabel('CANCELED_LATE')).toBe('Canceled late')
    expect(enumLabel('PRESENT')).toBe('Held')
    expect(enumLabel('SOME_OTHER')).toBe('Some other')
    expect(enumLabel(null)).toBe('—')
  })

  it('shortens ids and tolerates missing dates', () => {
    expect(shortId('3e340795-7fc4-42e5-925b-4113b2eb85fa')).toBe('3e340795…')
    expect(formatDateTime(null)).toBe('—')
    expect(formatDateTime('garbage')).toBe('—')
    expect(utcLabel('2026-10-12T14:03:00Z')).toBe('2026-10-12 14:03:00 UTC')
  })

  it('round-trips datetime-local values through UTC', () => {
    const iso = fromDateTimeLocal('2030-01-11T10:00')
    expect(iso).not.toBeNull()
    expect(toDateTimeLocal(iso)).toBe('2030-01-11T10:00')
    expect(fromDateTimeLocal('')).toBeNull()
  })
})
