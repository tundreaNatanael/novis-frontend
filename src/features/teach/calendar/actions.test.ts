import { describe, expect, it } from 'vitest'
import { lessonActions, withClosedLesson } from './actions'

const base = { scheduledAt: '2026-10-24T14:00:00Z', durationMinutes: 60, meetingUrl: null }

describe('lessonActions', () => {
  it('offers the cancellations, reschedule and open before a lesson starts', () => {
    expect(lessonActions({ ...base, status: 'PENDING' }, new Date('2026-10-24T13:00:00Z'))).toEqual(
      ['canceledOnTime', 'canceledLate', 'reschedule', 'open'],
    )
  })

  it('adds mark held once it started, and join while it has a link and runs', () => {
    const during = new Date('2026-10-24T14:30:00Z')
    expect(
      lessonActions({ ...base, status: 'PENDING', meetingUrl: 'https://meet.example.com' }, during),
    ).toEqual(['markHeld', 'canceledOnTime', 'canceledLate', 'join', 'reschedule', 'open'])
    const after = new Date('2026-10-24T15:30:00Z')
    expect(
      lessonActions({ ...base, status: 'PENDING', meetingUrl: 'https://meet.example.com' }, after),
    ).not.toContain('join')
  })

  it('only opens a closed lesson', () => {
    expect(lessonActions({ ...base, status: 'PRESENT' }, new Date())).toEqual(['open'])
  })

  it('closes a lesson in a cached window without a journal', () => {
    const rows = withClosedLesson(
      [
        {
          ...base,
          id: 'a',
          studentId: 's',
          studentName: 'Ana',
          courseId: null,
          courseTitle: null,
          status: 'PENDING',
          closedAt: null,
          hasJournal: true,
          paidOut: false,
          seriesId: null,
        },
      ],
      'a',
      'PRESENT',
      '2026-10-24T15:00:00Z',
    )
    expect(rows[0]).toMatchObject({
      status: 'PRESENT',
      closedAt: '2026-10-24T15:00:00Z',
      hasJournal: false,
    })
  })
})
