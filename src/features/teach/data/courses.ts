import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { courseKeys, coursesApi } from '@/api/courses'
import { enrollmentKeys, enrollmentsApi } from '@/api/enrollments'
import { useMe } from '@/auth/session'
import { flattenPages, nextPageParam, useDrain } from './pages'

const PAGE = 100

/**
 * The teacher's own courses, every page. A teacher only sees their own courses server-side; the
 * client-side `teacherId` filter is kept as defense in depth.
 */
export function useTeacherCourses(options?: { includeArchived?: boolean }) {
  const me = useMe()
  const query = useInfiniteQuery({
    queryKey: courseKeys.infinite({}),
    queryFn: ({ pageParam, signal }) =>
      coursesApi.list({}, { page: pageParam, size: PAGE, sort: 'title,asc' }, signal),
    initialPageParam: 0,
    getNextPageParam: nextPageParam,
  })
  useDrain(query)
  const includeArchived = options?.includeArchived ?? false
  const courses = useMemo(
    () =>
      flattenPages(query.data?.pages)
        .filter((c) => c.teacherId === me.id && (includeArchived || c.status === 'ACTIVE'))
        .sort((a, b) => a.title.localeCompare(b.title)),
    [query.data?.pages, me.id, includeArchived],
  )
  const byId = useMemo(() => new Map(courses.map((c) => [c.id, c])), [courses])
  return { ...query, courses, byId }
}

/** `GET /courses/{id}`. */
export function useCourse(id: string) {
  return useQuery({
    queryKey: courseKeys.detail(id),
    queryFn: ({ signal }) => coursesApi.get(id, signal),
    enabled: id.length > 0,
  })
}

/** The course's active enrollments, every page. */
export function useCourseEnrollments(courseId: string) {
  const query = useInfiniteQuery({
    queryKey: enrollmentKeys.course(courseId),
    queryFn: ({ pageParam, signal }) =>
      enrollmentsApi.list(courseId, { page: pageParam, size: PAGE }, signal),
    initialPageParam: 0,
    getNextPageParam: nextPageParam,
    enabled: courseId.length > 0,
  })
  useDrain(query)
  const enrollments = useMemo(
    () => flattenPages(query.data?.pages).filter((e) => e.status === 'ACTIVE'),
    [query.data?.pages],
  )
  return { ...query, enrollments }
}

export function useCourseMaterials(courseId: string) {
  const query = useInfiniteQuery({
    queryKey: courseKeys.materials(courseId),
    queryFn: ({ pageParam, signal }) =>
      coursesApi.materials(courseId, { page: pageParam, size: 50 }, signal),
    initialPageParam: 0,
    getNextPageParam: nextPageParam,
    enabled: courseId.length > 0,
  })
  const materials = useMemo(() => flattenPages(query.data?.pages), [query.data?.pages])
  return { ...query, materials }
}

export function useCourseHomework(courseId: string) {
  const query = useInfiniteQuery({
    queryKey: courseKeys.homework(courseId),
    queryFn: ({ pageParam, signal }) =>
      coursesApi.homework(courseId, { page: pageParam, size: 50 }, signal),
    initialPageParam: 0,
    getNextPageParam: nextPageParam,
    enabled: courseId.length > 0,
  })
  const homework = useMemo(() => flattenPages(query.data?.pages), [query.data?.pages])
  return { ...query, homework }
}
