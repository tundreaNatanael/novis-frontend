import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { PAGE_SIZES } from '@/lib/use-list-params'

interface PaginationProps {
  page: number
  size: number
  total: number
  onPageChange: (page: number) => void
  onSizeChange?: (size: number) => void
}

/** "1–20 of 42" with previous / next and an optional page-size selector. */
export function Pagination({ page, size, total, onPageChange, onSizeChange }: PaginationProps) {
  const first = total === 0 ? 0 : page * size + 1
  const last = Math.min(total, (page + 1) * size)
  const pages = Math.max(1, Math.ceil(total / size))
  return (
    <nav
      className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground"
      aria-label="Pagination"
    >
      <p className="tabular-nums">
        {first}–{last} of {total}
      </p>
      <div className="flex items-center gap-2">
        {onSizeChange ? (
          <Select value={String(size)} onValueChange={(value) => onSizeChange(Number(value))}>
            <SelectTrigger size="sm" className="w-24" aria-label="Rows per page">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZES.map((option) => (
                <SelectItem key={option} value={String(option)}>
                  {option} rows
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
        <span className="tabular-nums">
          Page {page + 1} of {pages}
        </span>
        <Button
          variant="outline"
          size="icon-sm"
          onClick={() => onPageChange(page - 1)}
          disabled={page === 0}
          aria-label="Previous page"
        >
          <ChevronLeft aria-hidden />
        </Button>
        <Button
          variant="outline"
          size="icon-sm"
          onClick={() => onPageChange(page + 1)}
          disabled={page + 1 >= pages}
          aria-label="Next page"
        >
          <ChevronRight aria-hidden />
        </Button>
      </div>
    </nav>
  )
}
