import { ChevronRight } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { cn } from '@/lib/utils'

interface ListRowProps {
  title: ReactNode
  subtitle?: ReactNode
  leading?: ReactNode
  /** Badges under the title. */
  footer?: ReactNode
  /** Buttons at the end of the row (they stop the row's own click). */
  trailing?: ReactNode
  to?: string
  onClick?: () => void
  chevron?: boolean
  className?: string
  'aria-label'?: string
}

/**
 * One row of a list: leading avatar or icon, a title, a line under it, badges, and buttons at the
 * end. The row itself is a link or a button when it opens something.
 */
export function ListRow({
  title,
  subtitle,
  leading,
  footer,
  trailing,
  to,
  onClick,
  chevron,
  className,
  'aria-label': ariaLabel,
}: ListRowProps) {
  const interactive = !!to || !!onClick
  const showChevron = chevron ?? (interactive && !trailing)
  const content = (
    <>
      {leading}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate font-medium text-foreground">{title}</span>
        {subtitle ? (
          <span className="truncate text-sm text-muted-foreground tabular-nums">{subtitle}</span>
        ) : null}
        {footer ? <span className="mt-1 flex flex-wrap items-center gap-1.5">{footer}</span> : null}
      </span>
    </>
  )
  const base = cn(
    'flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left',
    interactive &&
      'rounded-[inherit] transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
  )
  const main = to ? (
    <Link to={to} className={base} aria-label={ariaLabel}>
      {content}
      {showChevron ? (
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      ) : null}
    </Link>
  ) : onClick ? (
    <button type="button" onClick={onClick} className={base} aria-label={ariaLabel}>
      {content}
      {showChevron ? (
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      ) : null}
    </button>
  ) : (
    <div className={base}>{content}</div>
  )
  if (!trailing) return <div className={cn('flex min-w-0 items-stretch', className)}>{main}</div>
  return (
    <div className={cn('flex min-w-0 items-center', className)}>
      <div className="min-w-0 flex-1">{main}</div>
      <div className="flex shrink-0 items-center gap-1 pr-3">{trailing}</div>
    </div>
  )
}

/** Rows one under the other, divided by hairlines, inside a card. */
export function RowList({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('divide-y divide-border', className)}>{children}</div>
}
