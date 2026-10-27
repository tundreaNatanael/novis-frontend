import { http } from './client'
import { pageQuery } from './paging'
import type {
  CalendarLesson,
  CalendarQuery,
  EarningsQuery,
  LessonTotals,
  Page,
  PageParams,
  RosterStudent,
  TeacherEarnings,
  TeacherPayout,
  TeacherPayoutDetail,
} from './types'

/**
 * The signed-in teacher's own read models (API.md §12 and §9.6): the roster with balances, the
 * calendar windows, the all-time lesson totals, and the payouts their school recorded for them.
 * Every route answers `403` / `404` to anyone who is not a teacher. Invalidation: anything that
 * changes a lesson invalidates `all` (the roster's counts, the calendar's windows, the lesson
 * totals and the month's earnings all follow lessons).
 */
export const teacherKeys = {
  all: ['teacher'] as const,
  roster: () => [...teacherKeys.all, 'roster'] as const,
  calendar: () => [...teacherKeys.all, 'calendar'] as const,
  calendarWindow: (from: string, to: string) => [...teacherKeys.calendar(), from, to] as const,
  earnings: (query: EarningsQuery) => [...teacherKeys.all, 'earnings', query] as const,
  lessonTotals: () => [...teacherKeys.all, 'lesson-totals'] as const,
  payouts: () => [...teacherKeys.all, 'payouts'] as const,
  payout: (id: string) => [...teacherKeys.payouts(), id] as const,
}

export const teacherApi = {
  /** The caller's roster + students enrolled in their courses, with the counts with this teacher. */
  students: (params: PageParams, signal?: AbortSignal) =>
    http.get<Page<RosterStudent>>('/teacher/students', pageQuery(params), signal),
  /** The caller's dated lessons in `[from, to)`, every status, unpaginated. */
  calendar: (query: CalendarQuery, signal?: AbortSignal) =>
    http.get<CalendarLesson[]>('/teacher/calendar', { ...query }, signal),
  /** The teacher's own payouts from their school, newest first, voided ones included. */
  payouts: (params: PageParams, signal?: AbortSignal) =>
    http.get<Page<TeacherPayout>>('/teacher/payouts', pageQuery(params), signal),
  payout: (id: string, signal?: AbortSignal) =>
    http.get<TeacherPayoutDetail>(`/teacher/payouts/${id}`, undefined, signal),
  earnings: (query: EarningsQuery, signal?: AbortSignal) =>
    http.get<TeacherEarnings>('/teacher/earnings', { ...query }, signal),
  /** The caller's own lessons, all time: held, paid (by the school, or by the students when freelance), the difference. */
  lessonTotals: (signal?: AbortSignal) =>
    http.get<LessonTotals>('/teacher/lesson-totals', undefined, signal),
}
