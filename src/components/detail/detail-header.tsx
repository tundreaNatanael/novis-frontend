import { ArrowLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'

interface DetailHeaderProps {
  backTo: string
  backLabel: string
  title: ReactNode
  badge?: ReactNode
  meta?: ReactNode
  actions?: ReactNode
}

/** Top of a detail page inside a workspace: back link, name, status, actions. */
export function DetailHeader({
  backTo,
  backLabel,
  title,
  badge,
  meta,
  actions,
}: DetailHeaderProps) {
  return (
    <div className="flex flex-col gap-2">
      <Link
        to={backTo}
        className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" aria-hidden />
        {backLabel}
      </Link>
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-xl font-semibold tracking-tight text-foreground">
              {title}
            </h2>
            {badge}
          </div>
          {meta ? (
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              {meta}
            </div>
          ) : null}
        </div>
        {actions ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
        ) : null}
      </div>
    </div>
  )
}
