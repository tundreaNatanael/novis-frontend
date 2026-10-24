import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router'
import type { PageParams } from '@/api/types'

export const PAGE_SIZES = [20, 50, 100] as const

type Patch = Partial<Record<string, string | number | boolean | null | undefined>>

/**
 * List state in the URL (decision D-012): `page`, `size`, `sort`, `q` and any filter keys.
 * Changing a filter, the search or the sort resets the page. Two lists on one page each take a
 * `prefix` (`students` → `studentsPage`, `studentsSize`, `studentsSort`, `studentsQ`).
 */
export function useListParams(defaults: { size?: number; sort?: string; prefix?: string } = {}) {
  const [searchParams, setSearchParams] = useSearchParams()
  const { prefix } = defaults
  const keys = useMemo(() => {
    const key = (name: string) =>
      prefix ? `${prefix}${name.charAt(0).toUpperCase()}${name.slice(1)}` : name
    return { page: key('page'), size: key('size'), sort: key('sort'), q: key('q') }
  }, [prefix])
  const page = Math.max(0, Number.parseInt(searchParams.get(keys.page) ?? '0', 10) || 0)
  const rawSize = Number.parseInt(searchParams.get(keys.size) ?? '', 10)
  const size =
    Number.isFinite(rawSize) && rawSize > 0 ? Math.min(rawSize, 100) : (defaults.size ?? 20)
  const sort = searchParams.get(keys.sort) ?? defaults.sort
  const q = searchParams.get(keys.q) ?? ''

  const set = useCallback(
    (patch: Patch) => {
      setSearchParams(
        (previous) => {
          const next = new URLSearchParams(previous)
          for (const [name, value] of Object.entries(patch)) {
            const key = Object.hasOwn(keys, name) ? keys[name as keyof typeof keys] : name
            if (value === undefined || value === null || value === '') next.delete(key)
            else next.set(key, String(value))
          }
          if (!('page' in patch)) next.delete(keys.page)
          return next
        },
        { replace: true },
      )
    },
    [setSearchParams, keys],
  )

  const filter = useCallback((key: string) => searchParams.get(key) ?? undefined, [searchParams])

  const pageParams = useMemo<PageParams>(() => ({ page, size, sort }), [page, size, sort])

  return {
    page,
    size,
    sort,
    q,
    pageParams,
    filter,
    /** Patch any keys (`page`, `size`, `sort` and `q` take the prefix); `page` is reset unless it is part of the patch. */
    set,
    setPage: (next: number) => set({ page: next > 0 ? next : null }),
    setSize: (next: number) => set({ size: next === (defaults.size ?? 20) ? null : next }),
    setSort: (next: string | undefined) => set({ sort: next === defaults.sort ? null : next }),
    setQuery: (next: string) => set({ q: next }),
    /** Open / close a sheet (`?new=1`, `?edit=<id>`) without resetting the page. */
    setFlag: (key: string, value: string | number | null | undefined) =>
      set({ [key]: value, page: page > 0 ? page : null }),
  }
}

export type ListParams = ReturnType<typeof useListParams>
