import type { ReactNode } from 'react'
import { StaveRule } from './brand-mark'
import { cn } from '@/lib/utils'

interface PageHeaderProps {
  title: ReactNode
  description?: ReactNode
  /** Status badge or similar, shown next to the title. */
  badge?: ReactNode
  /** Primary and secondary actions; collapse into a menu on phones where needed. */
  actions?: ReactNode
  /** Optional line under the title, e.g. email and id. */
  meta?: ReactNode
  className?: string
}

/** Title, stave rule, actions: the top of every page. */
export function PageHeader({
  title,
  description,
  badge,
  actions,
  meta,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate text-2xl font-semibold tracking-tight text-foreground">
              {title}
            </h1>
            {badge}
          </div>
          {meta ? <div className="mt-1 text-sm text-muted-foreground">{meta}</div> : null}
        </div>
        {actions ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
        ) : null}
      </div>
      <StaveRule />
      {description ? (
        <p className="max-w-2xl text-sm text-muted-foreground">{description}</p>
      ) : null}
    </div>
  )
}
