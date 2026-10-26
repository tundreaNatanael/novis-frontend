import { ChevronRight, type LucideIcon } from 'lucide-react'
import { Link } from 'react-router'
import { cn } from '@/lib/utils'
import { IconBadge } from './icon-badge'
import type { Tone } from './tone'

/** A number-first tile for the dashboard: icon, big value, label. A link when it opens a page. */
export function StatTile({
  icon,
  tone = 'accent',
  value,
  label,
  hint,
  to,
  className,
}: {
  icon: LucideIcon
  tone?: Tone
  /** The number, or a short value ("…" while loading). */
  value: string
  label: string
  hint?: string
  to?: string
  className?: string
}) {
  const body = (
    <>
      <div className="flex items-center justify-between">
        <IconBadge icon={icon} tone={tone} size="md" />
        {to ? <ChevronRight className="size-4 text-muted-foreground" aria-hidden /> : null}
      </div>
      <div className="flex flex-col gap-0.5">
        <p className="text-3xl font-semibold tracking-tight text-foreground tabular-nums">
          {value}
        </p>
        <p className="text-sm font-medium text-foreground">{label}</p>
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      </div>
    </>
  )
  const classes = cn(
    'flex min-w-0 flex-1 flex-col gap-4 rounded-2xl border border-border bg-card p-4 text-left',
    to &&
      'transition-colors hover:border-primary/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
    className,
  )
  if (to) {
    return (
      <Link to={to} className={classes} aria-label={`${label}: ${value}${hint ? `, ${hint}` : ''}`}>
        {body}
      </Link>
    )
  }
  return (
    <div className={classes} aria-label={`${label}: ${value}${hint ? `, ${hint}` : ''}`}>
      {body}
    </div>
  )
}
