import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { CopyButton } from '@/components/copy-button'
import { StatusBadge } from '@/components/status-badge'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { formatDateTime, utcLabel } from '@/lib/format'
import { cn } from '@/lib/utils'

/** A titled block of label / value pairs. Every field the API returns goes in one of these. */
export function DetailPanel({
  title,
  description,
  children,
  actions,
  className,
}: {
  title: string
  description?: ReactNode
  children: ReactNode
  actions?: ReactNode
  className?: string
}) {
  return (
    <section
      className={cn('rounded-lg border border-border bg-card', className)}
      aria-label={title}
    >
      <header className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-card-foreground">{title}</h2>
          {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
        </div>
        {actions}
      </header>
      <dl className="divide-y divide-border">{children}</dl>
    </section>
  )
}

export function DetailField({
  label,
  children,
  hint,
}: {
  label: string
  children: ReactNode
  hint?: ReactNode
}) {
  return (
    <div className="grid gap-1 px-4 py-2.5 text-sm sm:grid-cols-[9rem_1fr] sm:gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words text-card-foreground">
        {children}
        {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
      </dd>
    </div>
  )
}

/** A UUID in monospace with a copy button. */
export function IdValue({ value }: { value: string }) {
  return (
    <span className="inline-flex max-w-full items-center gap-1">
      <code className="font-mono text-xs break-all">{value}</code>
      <CopyButton value={value} label="Copy id" />
    </span>
  )
}

/** Local time with the UTC instant in the tooltip. */
export function TimeValue({ value }: { value: string | null | undefined }) {
  if (!value) return <span className="text-muted-foreground">—</span>
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <time
          dateTime={value}
          className="tabular-nums underline decoration-dotted decoration-border underline-offset-4"
        >
          {formatDateTime(value)}
        </time>
      </TooltipTrigger>
      <TooltipContent>{utcLabel(value)}</TooltipContent>
    </Tooltip>
  )
}

export function EnumValue({ value }: { value: string | null | undefined }) {
  return <StatusBadge value={value} />
}

/** A related entity: its name as a link, the id underneath for copying. */
export function EntityValue({
  to,
  label,
  id,
}: {
  to: string
  label: ReactNode
  id?: string | null
}) {
  return (
    <span className="inline-flex flex-col gap-0.5">
      <Link to={to} className="font-medium text-primary underline-offset-4 hover:underline">
        {label}
      </Link>
      {id ? <IdValue value={id} /> : null}
    </span>
  )
}

export function BooleanValue({
  value,
  yes = 'Yes',
  no = 'No',
}: {
  value: boolean
  yes?: string
  no?: string
}) {
  return <span>{value ? yes : no}</span>
}

export function TextValue({ value }: { value: string | null | undefined }) {
  return value ? (
    <span className="whitespace-pre-wrap">{value}</span>
  ) : (
    <span className="text-muted-foreground">—</span>
  )
}
