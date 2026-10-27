import { describe, expect, it } from 'vitest'
import type { Lesson, StudentPayment } from '@/api/types'
import { lesson as fixture } from '@/test/fixtures'
import {
  canClose,
  canDelete,
  defaultLessonLength,
  groupByDay,
  lessonSegments,
  lessonStatusMeta,
  lessonUiStatus,
  paymentBadge,
  scheduleBody,
  seriesBody,
  seriesFromToSchedule,
  teacherJoin,
} from './utils'

const now = new Date('2026-03-12T12:00:00Z')
const unpaid: StudentPayment = { paid: false, paidAt: null, recordedById: null }
const paid: StudentPayment = { paid: true, paidAt: '2026-03-01T10:00:00Z', recordedById: 't' }
const lesson = (partial: Partial<Lesson>): Lesson =>
  fixture({
    courseId: null,
    organizationId: null,
    scheduledAt: null,
    studentPayment: unpaid,
    ...partial,
  })

describe('lessonUiStatus', () => {
  it('maps API statuses and splits pending into upcoming / to finish / unscheduled', () => {
    expect(lessonUiStatus(lesson({ status: 'PRESENT' }), now)).toBe('present')
    expect(lessonUiStatus(lesson({ status: 'CANCELED' }), now)).toBe('canceled')
    expect(lessonUiStatus(lesson({ status: 'CANCELED_LATE' }), now)).toBe('canceledLate')
    expect(lessonUiStatus(lesson({ scheduledAt: null }), now)).toBe('unscheduled')
    expect(lessonUiStatus(lesson({ scheduledAt: '2026-03-12T13:00:00Z' }), now)).toBe('upcoming')
    expect(lessonUiStatus(lesson({ scheduledAt: '2026-03-12T11:00:00Z' }), now)).toBe('toFinish')
  })
})

describe('paymentBadge', () => {
  it('shows credit for paid pending, paid for paid closed, unpaid only when something is due', () => {
    expect(paymentBadge(lesson({ studentPayment: paid }))?.tone).toBe('credits')
    expect(paymentBadge(lesson({ studentPayment: paid, status: 'PRESENT' }))?.tone).toBe('paid')
    expect(paymentBadge(lesson({ status: 'PRESENT' }))?.tone).toBe('unpaid')
    expect(paymentBadge(lesson({ status: 'CANCELED_LATE' }))?.tone).toBe('unpaid')
    expect(paymentBadge(lesson({ status: 'CANCELED' }))).toBeNull()
    expect(paymentBadge(lesson({ status: 'PENDING' }))).toBeNull()
  })

  it('never shows a hidden payment (studentPayment: null) as unpaid', () => {
    for (const status of ['PENDING', 'PRESENT', 'CANCELED', 'CANCELED_LATE'] as const) {
      expect(paymentBadge(lesson({ status, studentPayment: null }))).toBeNull()
    }
    expect(lessonStatusMeta.unscheduled.tone).toBe('neutral')
  })
})

describe('action guards', () => {
  it('allows delete only for pending + unpaid and close only for dated pending', () => {
    expect(canDelete(lesson({}))).toBe(true)
    expect(canDelete(lesson({ studentPayment: paid }))).toBe(false)
    expect(canDelete(lesson({ status: 'PRESENT' }))).toBe(false)
    expect(canDelete(lesson({ studentPayment: null }))).toBe(true)
    expect(canClose(lesson({ scheduledAt: '2026-03-12T11:00:00Z' }))).toBe(true)
    expect(canClose(lesson({}))).toBe(false)
    expect(canClose(lesson({ status: 'PRESENT', scheduledAt: '2026-03-12T11:00:00Z' }))).toBe(false)
  })
})

describe('lessonSegments', () => {
  it('gives a freelance teacher credits and unpaid, an org teacher what is left to schedule', () => {
    expect(lessonSegments({ canManageStudentPayments: true })).toEqual([
      'upcoming',
      'toFinish',
      'unscheduled',
      'unpaid',
      'history',
    ])
    expect(lessonSegments({ canManageStudentPayments: false })).toEqual([
      'upcoming',
      'toFinish',
      'toSchedule',
      'history',
    ])
  })
})

describe('groupByDay', () => {
  it('groups by day in input order and puts undated lessons last', () => {
    const groups = groupByDay(
      [
        lesson({ id: 'a', scheduledAt: null }),
        lesson({ id: 'b', scheduledAt: '2026-03-12T09:00:00Z' }),
        lesson({ id: 'c', scheduledAt: '2026-03-12T15:00:00Z' }),
        lesson({ id: 'd', scheduledAt: '2026-03-13T09:00:00Z' }),
      ],
      (d) => d.toISOString().slice(0, 10),
    )
    expect(groups.map((g) => g.items.map((l) => l.id))).toEqual([['b', 'c'], ['d'], ['a']])
    expect(groups[2]?.date).toBeNull()
  })
})

describe('scheduleBody', () => {
  const at = '2026-03-20T10:00:00+02:00'

  it('sends the date, and the length only when it changed (never a link, D-057)', () => {
    expect(
      scheduleBody(lesson({ meetingUrl: 'https://meet.example.com/piano' }), at),
    ).toStrictEqual({
      scheduledAt: at,
    })
    expect(scheduleBody(lesson({}), at, 60)).toStrictEqual({ scheduledAt: at })
    expect(scheduleBody(lesson({}), at, 90)).toStrictEqual({
      scheduledAt: at,
      durationMinutes: 90,
    })
  })
})

describe('series', () => {
  it('takes the course default length, else an hour', () => {
    expect(defaultLessonLength({ defaultDurationMinutes: 45 })).toBe(45)
    expect(defaultLessonLength({ defaultDurationMinutes: null })).toBe(60)
    expect(defaultLessonLength(undefined)).toBe(60)
  })

  it('sends the first date with the browser offset, the IANA zone and the length', () => {
    const body = seriesBody({
      studentId: 's',
      courseId: 'c',
      firstAt: new Date(2030, 0, 7, 17, 0),
      timeZone: 'Europe/Bucharest',
      intervalWeeks: 1,
      count: 4,
      durationMinutes: 45,
    })
    expect(body).toMatchObject({
      studentId: 's',
      courseId: 'c',
      firstAt: '2030-01-07T17:00:00+02:00',
      timeZone: 'Europe/Bucharest',
      intervalWeeks: 1,
      count: 4,
      durationMinutes: 45,
    })
    expect(body).not.toHaveProperty('meetingUrl')
  })

  it('offers "schedule all" for two or more lessons of one course, once they are all loaded', () => {
    expect(
      seriesFromToSchedule([lesson({ courseId: 'c' }), lesson({ courseId: 'c' })], 2),
    ).toStrictEqual({
      courseId: 'c',
      count: 2,
    })
    expect(seriesFromToSchedule([lesson({}), lesson({}), lesson({})], 3)).toStrictEqual({
      courseId: null,
      count: 3,
    })
    expect(seriesFromToSchedule([lesson({ courseId: 'c' })], 1)).toBeNull()
    expect(
      seriesFromToSchedule([lesson({ courseId: 'c' }), lesson({ courseId: 'd' })], 2),
    ).toBeNull()
    expect(
      seriesFromToSchedule(
        Array.from({ length: 30 }, () => lesson({})),
        45,
      ),
    ).toBeNull()
    expect(
      seriesFromToSchedule(
        Array.from({ length: 60 }, () => lesson({})),
        60,
      )?.count,
    ).toBe(52)
  })
})

describe('teacherJoin (D-058)', () => {
  it('opens WhatsApp instead of a chat with the teacher themself', () => {
    expect(teacherJoin('https://wa.me/40712345678', '+40712345678')).toEqual({
      url: 'whatsapp://',
      kind: 'openWhatsApp',
    })
  })

  it('opens any other link as it is', () => {
    expect(teacherJoin('https://wa.me/40799999999', '+40712345678')).toEqual({
      url: 'https://wa.me/40799999999',
      kind: 'whatsApp',
    })
    expect(teacherJoin('https://call.whatsapp.com/video/x', null)?.kind).toBe('whatsApp')
    expect(teacherJoin('https://meet.example.com/x', '+40712345678')).toEqual({
      url: 'https://meet.example.com/x',
      kind: 'link',
    })
  })

  it('has nothing to open without a link, whatever the number', () => {
    expect(teacherJoin(null, '+40712345678')).toBeNull()
    expect(teacherJoin(null, null)).toBeNull()
  })
})
