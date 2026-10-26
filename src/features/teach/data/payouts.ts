import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { teacherApi, teacherKeys } from '@/api/teacher'
import { monthWindow } from '../lib/payouts'
import { flattenPages, nextPageParam } from './pages'

export const PAYOUTS_PAGE_SIZE = 20

/** `GET /teacher/payouts`: the teacher's payouts from their school, newest first, voided ones included. */
export function useMyPayouts(options?: { enabled?: boolean }) {
  const query = useInfiniteQuery({
    queryKey: teacherKeys.payouts(),
    queryFn: ({ pageParam, signal }) =>
      teacherApi.payouts({ page: pageParam, size: PAYOUTS_PAGE_SIZE }, signal),
    initialPageParam: 0,
    getNextPageParam: nextPageParam,
    enabled: options?.enabled ?? true,
  })
  const payouts = useMemo(() => flattenPages(query.data?.pages), [query.data?.pages])
  return { ...query, payouts }
}

/** `GET /teacher/payouts/{id}`: one payout with the lessons it covers. */
export function usePayout(id: string) {
  return useQuery({
    queryKey: teacherKeys.payout(id),
    queryFn: ({ signal }) => teacherApi.payout(id, signal),
    enabled: id.length > 0,
  })
}

/** `GET /teacher/earnings` for the month of `now`: lessons taught, paid out and owed, and the last payout's day. */
export function useMonthEarnings(now: Date, options?: { enabled?: boolean }) {
  const window = useMemo(() => monthWindow(now), [now])
  return useQuery({
    queryKey: teacherKeys.earnings(window),
    queryFn: ({ signal }) => teacherApi.earnings(window, signal),
    enabled: options?.enabled ?? true,
  })
}
