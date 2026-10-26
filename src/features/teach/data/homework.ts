import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { homeworkApi, homeworkKeys } from '@/api/homework'
import type { HomeworkFilters } from '@/api/types'
import { useMe } from '@/auth/session'
import { flattenPages, nextPageParam } from './pages'

export const HOMEWORK_PAGE_SIZE = 30

/** Open homework first, then by due date (undated last). */
const OPEN_FIRST = ['status,asc', 'dueAt,asc']

/**
 * `GET /homework` for the signed-in teacher, open first. `teacherId` is always the caller, so the
 * list stays the teacher's own even if the server's visibility ever widens (defense in depth).
 */
export function useTeacherHomework(filters: HomeworkFilters, options?: { enabled?: boolean }) {
  const me = useMe()
  const scoped: HomeworkFilters = { ...filters, teacherId: me.id }
  const query = useInfiniteQuery({
    queryKey: homeworkKeys.infinite(scoped),
    queryFn: ({ pageParam, signal }) =>
      homeworkApi.list(
        scoped,
        { page: pageParam, size: HOMEWORK_PAGE_SIZE, sort: OPEN_FIRST },
        signal,
      ),
    initialPageParam: 0,
    getNextPageParam: nextPageParam,
    enabled: options?.enabled ?? true,
  })
  const homework = useMemo(() => flattenPages(query.data?.pages), [query.data?.pages])
  return { ...query, homework }
}

/** `GET /homework/{id}`: one homework as it is now (the edit sheet starts from it). */
export function useHomework(id: string) {
  return useQuery({
    queryKey: homeworkKeys.detail(id),
    queryFn: () => homeworkApi.get(id),
    enabled: id.length > 0,
  })
}
