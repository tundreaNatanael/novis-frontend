import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { studentKeys, studentsApi } from '@/api/students'
import { teacherApi, teacherKeys } from '@/api/teacher'
import type { RosterStudent } from '@/api/types'
import { flattenPages, nextPageParam, useDrain } from './pages'

export const ROSTER_PAGE_SIZE = 50
const ENROLLMENTS = { page: 0, size: 100, sort: 'enrolledAt,desc' }

/** `GET /teacher/students` (roster + enrolled, with the counts with this teacher), paged. */
export function useRoster() {
  return useInfiniteQuery({
    queryKey: teacherKeys.roster(),
    queryFn: ({ pageParam, signal }) =>
      teacherApi.students({ page: pageParam, size: ROSTER_PAGE_SIZE, sort: 'name,asc' }, signal),
    initialPageParam: 0,
    getNextPageParam: nextPageParam,
  })
}

/**
 * The whole roster, pulling every page. Pickers and name lookups need it; the Students page
 * pages normally and only drains the rest while a search is typed.
 */
export function useFullRoster(enabled = true) {
  const query = useRoster()
  const { complete } = useDrain(query, enabled)
  const students = useMemo(() => flattenPages(query.data?.pages), [query.data?.pages])
  return { ...query, students, complete }
}

/** `Map<studentId, RosterStudent>` for name lookups in lesson lists. */
export function useStudentDirectory() {
  const { students, ...rest } = useFullRoster()
  const byId = useMemo(() => new Map(students.map((s) => [s.id, s])), [students])
  return { byId, students, ...rest }
}

export function filterRoster(students: RosterStudent[], query: string): RosterStudent[] {
  const q = query.trim().toLowerCase()
  if (q.length === 0) return students
  return students.filter(
    (s) => s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q),
  )
}

/** The student's enrollments in the teacher's courses, for course pickers (first 100). */
export function useStudentEnrollments(studentId: string) {
  return useQuery({
    queryKey: studentKeys.enrollments(studentId, ENROLLMENTS),
    queryFn: ({ signal }) => studentsApi.enrollments(studentId, ENROLLMENTS, signal),
    enabled: studentId.length > 0,
    select: (page) => page.content,
  })
}

/** The roster row when loaded, otherwise the plain student record (`GET /students/{id}`). */
export function useStudent(id: string) {
  const { byId, isPending: rosterPending } = useStudentDirectory()
  const fromRoster = byId.get(id)
  const fallback = useQuery({
    queryKey: studentKeys.detail(id),
    queryFn: ({ signal }) => studentsApi.get(id, signal),
    enabled: id.length > 0 && !fromRoster && !rosterPending,
  })
  return {
    student: fromRoster ?? fallback.data,
    rosterStudent: fromRoster,
    isLoading:
      rosterPending || (!fromRoster && fallback.isPending && fallback.fetchStatus !== 'idle'),
    error: fromRoster ? null : fallback.error,
    refetch: () => void fallback.refetch(),
  }
}

/**
 * The student's teachers and how each meets them (D-057, `GET /students/{id}/meeting-links`): a
 * teacher gets their own row only. Edit student reads whether theirs is a WhatsApp call (D-058).
 */
export function useMeetingLinks(studentId: string, enabled = true) {
  return useQuery({
    queryKey: studentKeys.meetingLinks(studentId),
    queryFn: ({ signal }) => studentsApi.meetingLinks(studentId, signal),
    enabled: enabled && studentId.length > 0,
  })
}
