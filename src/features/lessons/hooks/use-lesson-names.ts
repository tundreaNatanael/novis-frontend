import { useQueries } from '@tanstack/react-query'
import { courseKeys, coursesApi } from '@/api/courses'
import { orgKeys, orgsApi } from '@/api/orgs'
import { studentKeys, studentsApi } from '@/api/students'
import type { Course, Lesson, Organization, Student, User } from '@/api/types'
import { userKeys, usersApi } from '@/api/users'

export interface LessonNames {
  teacher: (id: string) => User | undefined
  student: (id: string) => Student | undefined
  course: (id: string | null) => Course | undefined
  organization: (id: string | null) => Organization | undefined
  loading: boolean
}

const STALE = 5 * 60_000

/**
 * Lesson rows carry ids only, so the console resolves names per distinct id (cached for five
 * minutes; one request per entity, not per row). A denormalized ledger row would avoid this (gap G19).
 */
/** What a row must carry to be named: a lesson, or a weekly lesson (the same ids). */
export type NamedRow = Pick<Lesson, 'teacherId' | 'studentId' | 'courseId' | 'organizationId'>

export function useLessonNames(lessons: NamedRow[]): LessonNames {
  const teacherIds = unique(lessons.map((l) => l.teacherId))
  const studentIds = unique(lessons.map((l) => l.studentId))
  const courseIds = unique(lessons.map((l) => l.courseId).filter((id): id is string => !!id))
  const orgIds = unique(lessons.map((l) => l.organizationId).filter((id): id is string => !!id))

  const teachers = useQueries({
    queries: teacherIds.map((id) => ({
      queryKey: userKeys.detail(id),
      queryFn: ({ signal }: { signal: AbortSignal }) => usersApi.get(id, signal),
      staleTime: STALE,
      retry: false,
    })),
  })
  const students = useQueries({
    queries: studentIds.map((id) => ({
      queryKey: studentKeys.detail(id),
      queryFn: ({ signal }: { signal: AbortSignal }) => studentsApi.get(id, signal),
      staleTime: STALE,
      retry: false,
    })),
  })
  const courses = useQueries({
    queries: courseIds.map((id) => ({
      queryKey: courseKeys.detail(id),
      queryFn: ({ signal }: { signal: AbortSignal }) => coursesApi.get(id, signal),
      staleTime: STALE,
      retry: false,
    })),
  })
  const organizations = useQueries({
    queries: orgIds.map((id) => ({
      queryKey: orgKeys.detail(id),
      queryFn: ({ signal }: { signal: AbortSignal }) => orgsApi.get(id, signal),
      staleTime: STALE,
      retry: false,
    })),
  })

  const teacherMap = new Map(teachers.map((q, i) => [teacherIds[i]!, q.data]))
  const studentMap = new Map(students.map((q, i) => [studentIds[i]!, q.data]))
  const courseMap = new Map(courses.map((q, i) => [courseIds[i]!, q.data]))
  const orgMap = new Map(organizations.map((q, i) => [orgIds[i]!, q.data]))

  return {
    teacher: (id) => teacherMap.get(id),
    student: (id) => studentMap.get(id),
    course: (id) => (id ? courseMap.get(id) : undefined),
    organization: (id) => (id ? orgMap.get(id) : undefined),
    loading: [...teachers, ...students, ...courses, ...organizations].some((q) => q.isPending),
  }
}

function unique(ids: string[]): string[] {
  return [...new Set(ids)]
}
