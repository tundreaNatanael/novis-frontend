import { describe, expect, it } from 'vitest'
import type { CalendarLesson } from '@/api/types'
import {
  blockTone,
  dayMarks,
  isToFinish,
  lessonsByDay,
  minutesAt,
  placeLessons,
  slotStart,
} from './layout'

let nextId = 0
function lesson(
  start: Date,
  durationMinutes = 60,
  extra: Partial<CalendarLesson> = {},
): CalendarLesson {
  nextId += 1
  return {
    id: `l${String(nextId).padStart(3, '0')}`,
    studentId: 's1',
    studentName: 'Ana',
    courseId: null,
    courseTitle: null,
    scheduledAt: start.toISOString(),
    durationMinutes,
    status: 'PENDING',
    meetingUrl: null,
    closedAt: null,
    hasJournal: false,
    paidOut: false,
    seriesId: null,
    recurringLessonId: null,
    occurrenceOn: null,
    followsRule: false,
    projected: false,
    ...extra,
  }
}
const at = (hours: number, minutes = 0) => new Date(2026, 9, 24, hours, minutes)
const lanesOf = (lessons: CalendarLesson[]) =>
  Object.fromEntries(placeLessons(lessons).map((p) => [p.lesson.id, `${p.lane}/${p.lanes}`]))

describe('placing lessons on a day', () => {
  it('gives lessons that do not overlap the whole width', () => {
    const a = lesson(at(9))
    const b = lesson(at(11), 45)
    expect(placeLessons([b, a])).toEqual([
      { lesson: a, top: 540, height: 60, lane: 0, lanes: 1 },
      { lesson: b, top: 660, height: 45, lane: 0, lanes: 1 },
    ])
  })

  it('puts overlapping lessons side by side and reuses a freed lane', () => {
    const a = lesson(at(9))
    const b = lesson(at(9, 30))
    const c = lesson(at(10))
    expect(lanesOf([a, b, c])).toEqual({ [a.id]: '0/2', [b.id]: '1/2', [c.id]: '0/2' })
  })

  it('does not count back-to-back lessons as overlapping', () => {
    const a = lesson(at(9))
    const b = lesson(at(10))
    expect(lanesOf([a, b])).toEqual({ [a.id]: '0/1', [b.id]: '0/1' })
  })

  it('cuts a lesson at midnight and places lessons by the wall clock on clock-change days', () => {
    expect(placeLessons([lesson(at(23, 30))])[0]).toMatchObject({ top: 1410, height: 30 })
    expect(placeLessons([lesson(new Date(2026, 2, 29, 5, 0))])[0]).toMatchObject({
      top: 300,
      height: 60,
    })
    expect(placeLessons([lesson(new Date(2026, 9, 25, 17, 0))])[0]).toMatchObject({ top: 1020 })
  })
})

describe('grouping a window by day', () => {
  it('puts each lesson under its local day and drops what lies outside', () => {
    const window = { start: new Date(2026, 9, 19), end: new Date(2026, 9, 26) }
    const monday = lesson(new Date(2026, 9, 19, 0, 0))
    const lateSunday = lesson(new Date(2026, 9, 25, 23, 30))
    const sundayMorning = lesson(new Date(2026, 9, 25, 9, 0))
    const nextWeek = lesson(new Date(2026, 9, 26, 0, 0))
    const days = lessonsByDay([lateSunday, nextWeek, monday, sundayMorning], window)
    expect(days).toHaveLength(7)
    expect(days[0]).toEqual([monday])
    expect(days[6]).toEqual([sundayMorning, lateSunday])
    expect(days.flat()).toHaveLength(3)
  })
})

describe('booking from an empty slot', () => {
  it('reads the time under the pointer and snaps it down to the half hour', () => {
    expect(slotStart(new Date(2026, 9, 24), minutesAt(56 * 17.5 + 10, 56))).toEqual(
      new Date(2026, 9, 24, 17, 30),
    )
    expect(slotStart(new Date(2026, 9, 24), minutesAt(-4, 56))).toEqual(new Date(2026, 9, 24, 0, 0))
    expect(slotStart(new Date(2026, 9, 24), minutesAt(56 * 30, 56))).toEqual(
      new Date(2026, 9, 24, 23, 30),
    )
  })

  it('moves a slot in the hour the clocks skip to a time that exists', () => {
    const slot = slotStart(new Date(2026, 2, 29), 3 * 60 + 10)
    expect([slot.getHours(), slot.getMinutes()]).toEqual([4, 0])
  })
})

describe('what a block and a month cell show', () => {
  const now = new Date(2026, 9, 24, 12, 0)

  it('flags started pending lessons as to finish and colours blocks by status', () => {
    expect(isToFinish(lesson(at(11)), now)).toBe(true)
    expect(isToFinish(lesson(at(13)), now)).toBe(false)
    expect(isToFinish(lesson(at(11), 60, { status: 'PRESENT' }), now)).toBe(false)
    expect(blockTone({ status: 'PENDING' })).toBe('upcoming')
    expect(blockTone({ status: 'PRESENT' })).toBe('held')
    expect(blockTone({ status: 'CANCELED' })).toBe('canceled')
    expect(blockTone({ status: 'CANCELED_LATE' })).toBe('late')
  })

  it('marks a day with its lesson count and whether one is left to finish', () => {
    const marks = dayMarks(
      [
        lesson(at(9), 60, { status: 'PRESENT' }),
        lesson(at(11)),
        lesson(new Date(2026, 9, 25, 9, 0)),
        lesson(new Date(2026, 9, 25, 10, 0), 60, { status: 'CANCELED' }),
      ],
      now,
    )
    expect(marks.get('2026-10-24')).toEqual({ count: 2, toFinish: true })
    expect(marks.get('2026-10-25')).toEqual({ count: 2, toFinish: false })
    expect(marks.has('2026-10-26')).toBe(false)
  })
})
