import { AlertTriangle, RotateCw, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { isApiError } from '@/api/errors'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { useT } from '../i18n/use-i18n'
import { describeError } from '../lib/error-message'
import { IconBadge } from './icon-badge'
import type { Tone } from './tone'

export function EmptyState({
  icon,
  tone = 'accent',
  title,
  hint,
  action,
  compact = false,
  className,
}: {
  icon: LucideIcon
  tone?: Tone
  title: string
  hint?: string
  action?: ReactNode
  compact?: boolean
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border px-6 text-center',
        compact ? 'py-6' : 'py-12',
        className,
      )}
    >
      <IconBadge icon={icon} tone={tone} size={compact ? 'md' : 'lg'} />
      <p className="text-sm font-medium text-foreground">{title}</p>
      {hint ? <p className="max-w-sm text-sm text-muted-foreground">{hint}</p> : null}
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  )
}

/** The server's answer in the workspace's words, and a retry where one can help. */
export function ErrorState({
  error,
  onRetry,
  compact = false,
  className,
}: {
  error: unknown
  onRetry?: () => void
  compact?: boolean
  className?: string
}) {
  const t = useT()
  const notFound = isApiError(error) && error.isNotFound
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center justify-center gap-2 rounded-2xl border border-border bg-card px-6 text-center',
        compact ? 'py-6' : 'py-10',
        className,
      )}
    >
      <AlertTriangle className="size-6 text-danger" aria-hidden />
      <p className="text-sm font-medium text-foreground">
        {notFound ? t('errors.notFoundTitle') : t('errors.title')}
      </p>
      <p className="max-w-md text-sm text-muted-foreground">{describeError(error, t)}</p>
      {onRetry && !notFound ? (
        <Button variant="outline" size="sm" onClick={onRetry} className="mt-1">
          <RotateCw aria-hidden />
          {t('common.retry')}
        </Button>
      ) : null}
    </div>
  )
}

export function SkeletonList({ rows = 3, className }: { rows?: number; className?: string }) {
  const t = useT()
  return (
    <div
      className={cn('flex flex-col gap-2', className)}
      role="status"
      aria-label={t('common.loading')}
    >
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} className="h-16 w-full rounded-2xl" />
      ))}
    </div>
  )
}

export function SkeletonCard({ lines = 2, className }: { lines?: number; className?: string }) {
  const t = useT()
  return (
    <div
      className={cn('flex flex-col gap-3 rounded-2xl border border-border bg-card p-4', className)}
      role="status"
      aria-label={t('common.loading')}
    >
      <Skeleton className="h-5 w-1/2" />
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton key={index} className="h-4 w-full" />
      ))}
    </div>
  )
}
