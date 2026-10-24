import { describe, expect, it } from 'vitest'
import {
  endOfLocalDay,
  enumLabel,
  formatDateTime,
  formatDateTimeRange,
  formatDuration,
  formatTimeRange,
  fromDateTimeLocal,
  shortId,
  toDateInput,
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

  it('turns a date into the last second of that local day', () => {
    const iso = endOfLocalDay('2030-01-11')
    expect(iso).not.toBeNull()
    const due = new Date(iso ?? '')
    expect([due.getFullYear(), due.getMonth(), due.getDate()]).toEqual([2030, 0, 11])
    expect([due.getHours(), due.getMinutes(), due.getSeconds()]).toEqual([23, 59, 59])
    expect(endOfLocalDay('')).toBeNull()
  })

  it('shows a due instant as its local day in a date input', () => {
    expect(toDateInput(endOfLocalDay('2030-01-11'))).toBe('2030-01-11')
    expect(toDateInput(null)).toBe('')
  })

  it('shows a lesson as its local start and end time', () => {
    const start = fromDateTimeLocal('2030-01-11T17:00')
    expect(formatTimeRange(start, 60)).toBe('17:00–18:00')
    expect(formatTimeRange(fromDateTimeLocal('2030-01-11T23:30'), 45)).toBe('23:30–00:15')
    expect(formatDateTimeRange(start, 90)).toBe('11 Jan 2030, 17:00–18:30')
    expect(formatTimeRange(null, 60)).toBe('—')
    expect(formatDateTimeRange(null, 60)).toBe('—')
  })

  it('writes a length in minutes and hours', () => {
    expect(formatDuration(45)).toBe('45 min')
    expect(formatDuration(60)).toBe('1 h')
    expect(formatDuration(90)).toBe('1 h 30 min')
    expect(formatDuration(240)).toBe('4 h')
  })

  it('round-trips datetime-local values through UTC', () => {
    const iso = fromDateTimeLocal('2030-01-11T10:00')
    expect(iso).not.toBeNull()
    expect(toDateTimeLocal(iso)).toBe('2030-01-11T10:00')
    expect(fromDateTimeLocal('')).toBeNull()
  })
})
