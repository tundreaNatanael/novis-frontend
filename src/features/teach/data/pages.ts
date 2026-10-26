import type { InfiniteData, UseInfiniteQueryResult } from '@tanstack/react-query'
import { useEffect } from 'react'
import type { Page } from '@/api/types'

/** Every row of every loaded page, in order. */
export function flattenPages<T>(pages: Page<T>[] | undefined): T[] {
  return pages?.flatMap((page) => page.content) ?? []
}

/** The next 0-based page, or nothing after the last one (API.md §1.5). */
export function nextPageParam<T>(last: Page<T>): number | undefined {
  return last.last ? undefined : last.page + 1
}

/**
 * Pulls every page of an infinite query while `enabled`: pickers and name lookups need the whole
 * list, a list screen pages normally.
 */
export function useDrain<T>(
  query: UseInfiniteQueryResult<InfiniteData<Page<T>>, unknown>,
  enabled = true,
) {
  const { hasNextPage, isFetchingNextPage, fetchNextPage, isPending, isError } = query
  const shouldFetchMore = enabled && !isPending && !isError && hasNextPage && !isFetchingNextPage
  useEffect(() => {
    if (shouldFetchMore) void fetchNextPage()
  }, [shouldFetchMore, fetchNextPage])
  return { complete: !isPending && !hasNextPage }
}
