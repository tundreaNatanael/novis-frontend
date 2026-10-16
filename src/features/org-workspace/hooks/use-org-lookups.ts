import { useQuery } from '@tanstack/react-query'
import { courseKeys, coursesApi } from '@/api/courses'
import { memberKeys, membersApi } from '@/api/members'
import type { Course, Member } from '@/api/types'

const LOOKUP = { page: 0, size: 100 }

/** Teachers of the organization, for selects and name lookups (first 100). */
export function useOrgTeachers(orgId: string, enabled = true) {
  return useQuery({
    queryKey: memberKeys.list(orgId, 'TEACHER', LOOKUP),
    queryFn: ({ signal }) => membersApi.list(orgId, 'TEACHER', LOOKUP, signal),
    enabled,
    staleTime: 60_000,
    select: (page) => page.content,
  })
}

/** Students of the organization, for the enrol select (first 100). */
export function useOrgStudents(orgId: string, enabled = true) {
  return useQuery({
    queryKey: memberKeys.list(orgId, 'STUDENT', LOOKUP),
    queryFn: ({ signal }) => membersApi.list(orgId, 'STUDENT', LOOKUP, signal),
    enabled,
    staleTime: 60_000,
    select: (page) => page.content,
  })
}

/** Courses of the organization, for selects (first 100, active first by title). */
export function useOrgCourses(orgId: string, enabled = true) {
  return useQuery({
    queryKey: courseKeys.list({ organizationId: orgId }, { ...LOOKUP, sort: 'title,asc' }),
    queryFn: ({ signal }) =>
      coursesApi.list({ organizationId: orgId }, { ...LOOKUP, sort: 'title,asc' }, signal),
    enabled,
    staleTime: 60_000,
    select: (page) => page.content,
  })
}

export function memberName(members: Member[] | undefined, userId: string): string | undefined {
  return members?.find((m) => m.userId === userId)?.name
}

export function courseLabel(course: Course, teachers: Member[] | undefined): string {
  const teacher = memberName(teachers, course.teacherId)
  return teacher ? `${course.title} — ${teacher}` : course.title
}

/** Courses owned by one teacher (any scope), for selects (first 100). */
export function useTeacherCourses(teacherId: string, enabled = true) {
  return useQuery({
    queryKey: courseKeys.list({ teacherId }, { ...LOOKUP, sort: 'title,asc' }),
    queryFn: ({ signal }) =>
      coursesApi.list({ teacherId }, { ...LOOKUP, sort: 'title,asc' }, signal),
    enabled: enabled && !!teacherId,
    staleTime: 60_000,
    select: (page) => page.content,
  })
}
