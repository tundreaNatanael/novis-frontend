import type { Query } from './client'
import type { PageParams } from './types'

/** Maps `PageParams` (+ optional filters) onto the `page` / `size` / `sort` query the API expects. */
export function pageQuery(
  params: PageParams = {},
  filters: Record<string, Query[string]> = {},
): Query {
  return {
    ...filters,
    page: params.page,
    size: params.size,
    sort: params.sort,
  }
}

/** Parses the `sort` string used in URLs (`name,asc`) into the table's notion of sorting. */
export function parseSort(sort: string | undefined): { id: string; desc: boolean } | null {
  if (!sort) return null
  const [id, direction] = sort.split(',')
  if (!id) return null
  return { id, desc: direction === 'desc' }
}

export function toSort(id: string, desc: boolean): string {
  return `${id},${desc ? 'desc' : 'asc'}`
}
