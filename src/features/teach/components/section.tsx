import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/** A flat white card with a hairline border: the surface of every panel in the workspace. */
export function TeachCard({
  children,
  className,
  padded = true,
}: {
  children: ReactNode
  className?: string
  padded?: boolean
}) {
  return (
    <div
      className={cn(
        'min-w-0 rounded-2xl border border-border bg-card text-card-foreground',
        padded && 'p-4',
        className,
      )}
    >
      {children}
    </div>
  )
}

/** A titled block of a page: heading, hint, an optional action on the right, then its content. */
export function Section({
  title,
  hint,
  action,
  children,
  className,
}: {
  title: ReactNode
  hint?: ReactNode
  action?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={cn('flex min-w-0 flex-col gap-3', className)}>
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold tracking-tight text-foreground">{title}</h2>
          {hint ? <p className="text-sm text-muted-foreground">{hint}</p> : null}
        </div>
        {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
      </header>
      {children}
    </section>
  )
}

/** The top of a page: a large title, a line under it, and the page's actions on the right. */
export function PageTitle({
  title,
  subtitle,
  eyebrow,
  actions,
  className,
}: {
  title: ReactNode
  subtitle?: ReactNode
  eyebrow?: ReactNode
  actions?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-wrap items-end justify-between gap-3', className)}>
      <div className="min-w-0">
        {eyebrow ? <p className="text-sm font-medium text-muted-foreground">{eyebrow}</p> : null}
        <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
          {title}
        </h1>
        {subtitle ? <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  )
}
