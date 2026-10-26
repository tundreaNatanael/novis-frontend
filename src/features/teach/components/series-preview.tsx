import { Flag } from 'lucide-react'
import type { LessonSeriesPlan } from '@/api/types'
import { Skeleton } from '@/components/ui/skeleton'
import { useT } from '../i18n/use-i18n'
import { useFormatters } from '../lib/use-formatters'
import { ErrorState } from './states'
import { TeachBadge } from './teach-badge'

/** The dates of a weekly series from its dry run, each date that overlaps another lesson marked. */
export function SeriesPreview({
  plan,
  durationMinutes,
  isPending,
  error,
  onRetry,
}: {
  plan: LessonSeriesPlan | undefined
  durationMinutes: number
  isPending: boolean
  error: unknown
  onRetry: () => void
}) {
  const t = useT()
  const fmt = useFormatters()
  if (error && !plan) return <ErrorState compact error={error} onRetry={onRetry} />
  if (isPending && !plan) return <Skeleton className="h-28 w-full rounded-xl" />
  if (!plan) return null
  const conflicts = plan.occurrences.filter((occurrence) => occurrence.conflict).length
  return (
    <div className="flex flex-col gap-2" aria-label={t('teacher.book.preview')}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-foreground">{t('teacher.book.preview')}</span>
        <span className={conflicts > 0 ? 'text-xs text-warning' : 'text-xs text-muted-foreground'}>
          {conflicts > 0
            ? t('teacher.book.previewConflicts', { count: conflicts })
            : t('teacher.book.noConflicts')}
        </span>
      </div>
      <ol className="max-h-56 divide-y divide-border overflow-y-auto rounded-xl bg-muted/60">
        {plan.occurrences.map((occurrence) => {
          const date = new Date(occurrence.scheduledAt)
          return (
            <li
              key={occurrence.scheduledAt}
              className="flex items-center gap-2 px-3 py-2 text-sm tabular-nums"
            >
              <span className="flex-1 truncate">
                {fmt.shortDate(date)}, {fmt.timeRange(date, durationMinutes)}
              </span>
              {occurrence.conflict ? (
                <TeachBadge tone="warning" icon={Flag}>
                  {t('teacher.book.overlaps')}
                </TeachBadge>
              ) : null}
            </li>
          )
        })}
      </ol>
    </div>
  )
}
