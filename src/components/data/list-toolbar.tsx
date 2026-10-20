import { Search, X } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface ListToolbarProps {
  /**
   * The search box. Most lists filter the loaded page on the client (their API has no `q`) and
   * pass `matched` / `loaded`; a list searched by the server omits both.
   */
  query?: string
  onQueryChange?: (query: string) => void
  searchPlaceholder?: string
  /** Filter controls (selects, toggles). */
  filters?: ReactNode
  /** Primary and secondary actions. */
  actions?: ReactNode
  /** "Showing 3 of 20 loaded rows" when a query is active. */
  matched?: number
  loaded?: number
}

export function ListToolbar({
  query,
  onQueryChange,
  searchPlaceholder = 'Filter loaded rows…',
  filters,
  actions,
  matched,
  loaded,
}: ListToolbarProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center">
          {onQueryChange ? (
            <div className="relative w-full sm:max-w-xs">
              <Search
                className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                type="search"
                value={query ?? ''}
                onChange={(event) => onQueryChange(event.target.value)}
                placeholder={searchPlaceholder}
                aria-label={searchPlaceholder}
                className="pl-8"
              />
              {query ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  className="absolute top-1/2 right-1 -translate-y-1/2"
                  onClick={() => onQueryChange('')}
                  aria-label="Clear filter"
                >
                  <X aria-hidden />
                </Button>
              ) : null}
            </div>
          ) : null}
          {filters}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      {query && matched !== undefined && loaded !== undefined ? (
        <p className="text-xs text-muted-foreground" role="status">
          Showing {matched} of {loaded} loaded rows. The filter searches this page only; use paging
          or sorting to find other rows.
        </p>
      ) : null}
    </div>
  )
}

/** Case-insensitive "contains" over the given fields, for the client-side filter. */
export function matchesQuery<T>(
  row: T,
  query: string,
  fields: ((row: T) => string | null | undefined)[],
): boolean {
  const needle = query.trim().toLowerCase()
  if (!needle) return true
  return fields.some((field) => (field(row) ?? '').toLowerCase().includes(needle))
}
