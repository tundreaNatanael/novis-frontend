import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { useCallback, useMemo } from 'react'
import { lessonKeys, lessonsApi } from '@/api/lessons'
import { studentKeys, studentsApi } from '@/api/students'
import type { CreateLessonSeriesRequest, LessonFilters } from '@/api/types'
import { useMe } from '@/auth/session'
import { toIsoWithOffset } from '../lib/dates'
import { useTeacherCourses } from './courses'
import { flattenPages, nextPageParam } from './pages'
import { useStudentDirectory } from './roster'

export const LESSONS_PAGE_SIZE = 30

/**
 * `GET /lessons` for the signed-in teacher, paged. `teacherId` is always the caller, so the list
 * stays the teacher's own even if the server's visibility ever widens (defense in depth).
 */
export function useTeacherLessons(
  filters: LessonFilters,
  sort: string,
  options?: { enabled?: boolean },
) {
  const me = useMe()
  const scoped: LessonFilters = { ...filters, teacherId: me.id }
  const query = useInfiniteQuery({
    queryKey: lessonKeys.infinite(scoped, sort),
    queryFn: ({ pageParam, signal }) =>
      lessonsApi.list(scoped, { page: pageParam, size: LESSONS_PAGE_SIZE, sort }, signal),
    initialPageParam: 0,
    getNextPageParam: nextPageParam,
    enabled: options?.enabled ?? true,
  })
  const lessons = useMemo(() => flattenPages(query.data?.pages), [query.data?.pages])
  const total = query.data?.pages[0]?.totalElements ?? 0
  return { ...query, lessons, total }
}

/** `totalElements` of a filter — one request with `size=1`. */
export function useLessonCount(filters: LessonFilters) {
  const me = useMe()
  const scoped: LessonFilters = { ...filters, teacherId: me.id }
  return useQuery({
    queryKey: lessonKeys.count(scoped),
    queryFn: async ({ signal }) =>
      (await lessonsApi.list(scoped, { page: 0, size: 1 }, signal)).totalElements,
  })
}

/**
 * The lessons left to finish (pending, dated, started before `now`): how many, and the oldest —
 * one request with `size=1`, oldest first. Feeds the "To finish (N)" banners of Today and Calendar.
 */
export function useToFinish(now: Date) {
  const me = useMe()
  const to = toIsoWithOffset(now)
  const filters: LessonFilters = { status: 'PENDING', unscheduled: false, to, teacherId: me.id }
  return useQuery({
    queryKey: lessonKeys.count(filters, 'scheduledAt,asc'),
    queryFn: async ({ signal }) => {
      const page = await lessonsApi.list(
        filters,
        { page: 0, size: 1, sort: 'scheduledAt,asc' },
        signal,
      )
      return { count: page.totalElements, oldest: page.content[0] ?? null }
    },
  })
}

export function useLesson(id: string) {
  return useQuery({
    queryKey: lessonKeys.detail(id),
    queryFn: ({ signal }) => lessonsApi.get(id, signal),
    enabled: id.length > 0,
  })
}

/**
 * The dates a weekly series would book and which of them overlap other lessons (a dry run:
 * nothing is written). `null` while there is nothing to plan; the previous plan stays while the
 * next loads.
 */
export function useSeriesPlan(body: CreateLessonSeriesRequest | null) {
  return useQuery({
    queryKey: lessonKeys.seriesPlan(body),
    queryFn: () => lessonsApi.planSeries(body as CreateLessonSeriesRequest),
    enabled: body !== null,
    placeholderData: keepPreviousData,
  })
}

/** `GET /students/{id}/lessons/summary`: the teacher's own share. */
export function useStudentSummary(studentId: string) {
  return useQuery({
    queryKey: studentKeys.summary(studentId, null),
    queryFn: ({ signal }) => studentsApi.summary(studentId, null, signal),
    enabled: studentId.length > 0,
  })
}

/** Student names and course titles for lesson rows (lessons only carry ids). */
export function useLessonLookups() {
  const { byId: students } = useStudentDirectory()
  const { byId: courses } = useTeacherCourses({ includeArchived: true })
  const studentName = useCallback((id: string) => students.get(id)?.name, [students])
  const courseTitle = useCallback(
    (id: string | null) => (id ? courses.get(id)?.title : undefined),
    [courses],
  )
  return { studentName, courseTitle, students, courses }
}
