import {
  columnVisibilityFeature,
  createColumnHelper,
  flexRender,
  rowSortingFeature,
  tableFeatures,
  useTable,
  type ColumnDef,
  type RowData,
  type SortingState,
} from '@tanstack/react-table'
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'
import { type ReactNode, useMemo } from 'react'
import { useNavigate } from 'react-router'
import { parseSort, toSort } from '@/api/paging'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { ErrorState } from './error-state'
import { Pagination } from './pagination'

/** The one feature set every console table uses; sorting is manual (server-side). */
export const dataTableFeatures = tableFeatures({ rowSortingFeature, columnVisibilityFeature })
export type DataTableFeatures = typeof dataTableFeatures
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- TanStack's own ColumnDef arrays are typed with `any` for TValue
export type DataColumn<TData extends RowData> = ColumnDef<DataTableFeatures, TData, any>

export function columnHelper<TData extends RowData>() {
  return createColumnHelper<DataTableFeatures, TData>()
}

/** Per-column presentation hints, read from `meta`. */
export interface ColumnPresentation {
  className?: string
  headerClassName?: string
  /** Hide below `md`; the mobile row shows the key fields instead. */
  secondary?: boolean
}

export interface DataTableProps<TData extends RowData> {
  columns: DataColumn<TData>[]
  data: TData[]
  total: number
  page: number
  size: number
  onPageChange: (page: number) => void
  onSizeChange?: (size: number) => void
  sort: string | undefined
  onSortChange: (sort: string | undefined) => void
  getRowId: (row: TData) => string
  /** Row click target; also used by the mobile list. `undefined` leaves that row unclickable. */
  rowHref?: (row: TData) => string | undefined
  rowActions?: (row: TData) => ReactNode
  /** The phone layout for one row: title, subtitle, badge. */
  renderMobileRow: (row: TData) => ReactNode
  isLoading?: boolean
  isFetching?: boolean
  error?: unknown
  onRetry?: () => void
  emptyState: ReactNode
  caption: string
  className?: string
}

/**
 * Server-paginated, server-sorted table (desktop) that becomes a stacked list on phones.
 * Loading shows skeleton rows; errors show an inline retry; empty pages show `emptyState`.
 */
export function DataTable<TData extends RowData>({
  columns,
  data,
  total,
  page,
  size,
  onPageChange,
  onSizeChange,
  sort,
  onSortChange,
  getRowId,
  rowHref,
  rowActions,
  renderMobileRow,
  isLoading = false,
  isFetching = false,
  error,
  onRetry,
  emptyState,
  caption,
  className,
}: DataTableProps<TData>) {
  const navigate = useNavigate()
  const sorting = useMemo<SortingState>(() => {
    const parsed = parseSort(sort)
    return parsed ? [parsed] : []
  }, [sort])

  const table = useTable<DataTableFeatures, TData>({
    features: dataTableFeatures,
    columns,
    data,
    getRowId,
    manualSorting: true,
    enableMultiSort: false,
    enableSortingRemoval: false,
    state: { sorting },
    onSortingChange: (updater) => {
      const next = typeof updater === 'function' ? updater(sorting) : updater
      const first = next[0]
      onSortChange(first ? toSort(first.id, first.desc) : undefined)
    },
  })

  if (error) {
    return <ErrorState error={error} onRetry={onRetry} className={className} />
  }

  const rows = table.getRowModel().rows
  const showEmpty = !isLoading && rows.length === 0

  return (
    <div className={cn('flex flex-col gap-3', className)} aria-busy={isFetching || undefined}>
      {/* Desktop: dense table with a sticky header. */}
      <div className="hidden overflow-hidden rounded-lg border border-border bg-card md:block">
        <Table>
          <caption className="sr-only">{caption}</caption>
          <TableHeader className="bg-card">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="hover:bg-transparent">
                {headerGroup.headers.map((header) => {
                  const presentation = header.column.columnDef.meta as
                    ColumnPresentation | undefined
                  const canSort = header.column.getCanSort()
                  const sorted = header.column.getIsSorted()
                  return (
                    <TableHead
                      key={header.id}
                      className={cn('h-10 whitespace-nowrap', presentation?.headerClassName)}
                      aria-sort={
                        sorted === 'asc'
                          ? 'ascending'
                          : sorted === 'desc'
                            ? 'descending'
                            : undefined
                      }
                    >
                      {header.isPlaceholder ? null : canSort ? (
                        <button
                          type="button"
                          onClick={header.column.getToggleSortingHandler()}
                          className="-ml-2 inline-flex h-8 items-center gap-1 rounded-md px-2 text-left font-medium hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {sorted === 'asc' ? (
                            <ArrowUp className="size-3.5" aria-hidden />
                          ) : sorted === 'desc' ? (
                            <ArrowDown className="size-3.5" aria-hidden />
                          ) : (
                            <ArrowUpDown
                              className="size-3.5 text-muted-foreground/60"
                              aria-hidden
                            />
                          )}
                        </button>
                      ) : (
                        flexRender(header.column.columnDef.header, header.getContext())
                      )}
                    </TableHead>
                  )
                })}
                {rowActions ? (
                  <TableHead className="h-10 w-12">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                ) : null}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading
              ? Array.from({ length: Math.min(size, 6) }).map((_, index) => (
                  <TableRow key={index}>
                    {columns.map((_column, columnIndex) => (
                      <TableCell key={columnIndex} className="h-10">
                        <Skeleton className="h-3.5 w-3/4" />
                      </TableCell>
                    ))}
                    {rowActions ? <TableCell /> : null}
                  </TableRow>
                ))
              : rows.map((row) => {
                  const href = rowHref?.(row.original)
                  return (
                    <TableRow
                      key={row.id}
                      className={cn(href && 'cursor-pointer')}
                      onClick={href ? () => navigate(href) : undefined}
                      data-href={href}
                    >
                      {row.getVisibleCells().map((cell) => {
                        const presentation = cell.column.columnDef.meta as
                          ColumnPresentation | undefined
                        return (
                          <TableCell
                            key={cell.id}
                            className={cn('h-10 py-0', presentation?.className)}
                          >
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </TableCell>
                        )
                      })}
                      {rowActions ? (
                        <TableCell
                          className="h-10 w-12 py-0 text-right"
                          onClick={(event) => event.stopPropagation()}
                        >
                          {rowActions(row.original)}
                        </TableCell>
                      ) : null}
                    </TableRow>
                  )
                })}
          </TableBody>
        </Table>
        {showEmpty ? <div className="border-t border-border">{emptyState}</div> : null}
      </div>

      {/* Phones: the same rows stacked, key fields only, actions in a menu. */}
      <ul className="flex flex-col gap-2 md:hidden" aria-label={caption}>
        {isLoading
          ? Array.from({ length: 4 }).map((_, index) => (
              <li key={index} className="rounded-lg border border-border bg-card p-3">
                <Skeleton className="mb-2 h-4 w-1/2" />
                <Skeleton className="h-3 w-3/4" />
              </li>
            ))
          : rows.map((row) => {
              const href = rowHref?.(row.original)
              return (
                <li
                  key={row.id}
                  className="flex min-h-14 items-stretch rounded-lg border border-border bg-card"
                >
                  {href ? (
                    <button
                      type="button"
                      onClick={() => navigate(href)}
                      className="min-w-0 flex-1 rounded-l-lg p-3 text-left focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                    >
                      {renderMobileRow(row.original)}
                    </button>
                  ) : (
                    <div className="min-w-0 flex-1 p-3">{renderMobileRow(row.original)}</div>
                  )}
                  {rowActions ? (
                    <div className="flex items-center pr-1">{rowActions(row.original)}</div>
                  ) : null}
                </li>
              )
            })}
        {showEmpty ? (
          <li className="rounded-lg border border-border bg-card">{emptyState}</li>
        ) : null}
      </ul>

      {total > 0 ? (
        <Pagination
          page={page}
          size={size}
          total={total}
          onPageChange={onPageChange}
          onSizeChange={onSizeChange}
        />
      ) : null}
    </div>
  )
}
