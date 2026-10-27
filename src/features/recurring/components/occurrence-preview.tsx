import { AlertTriangle } from 'lucide-react'
import { Link } from 'react-router'
import type { RecurringLessonPlan } from '@/api/types'
import { ToneBadge } from '@/components/status-badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useLessonPaths } from '@/features/lessons/lesson-paths'
import { errorMessage } from '@/api/errors'
import { formatDateTimeRange, pluralize } from '@/lib/format'

interface Props {
  title: string
  /** The dry run's answer; `undefined` while nothing is planned yet. */
  plan: RecurringLessonPlan | undefined
  durationMinutes: number
  isPending: boolean
  error: unknown
  /** Shown instead of the list while the form is not complete enough for a dry run. */
  idleText: string
}

/**
 * The dates a weekly lesson would book up to the horizon (8 weeks), from a dry run, each date that
 * overlaps another lesson of the teacher or the student marked — and linked when the caller may
 * open that lesson. Times are the browser's.
 */
export function OccurrencePreview({
  title,
  plan,
  durationMinutes,
  isPending,
  error,
  idleText,
}: Props) {
  const paths = useLessonPaths()
  const conflicts = plan?.occurrences.filter((occurrence) => occurrence.conflict).length ?? 0
  return (
    <section className="flex flex-col gap-2" aria-label={title}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-foreground">{title}</span>
        {plan ? (
          <span
            className={
              conflicts > 0
                ? 'inline-flex items-center gap-1 text-xs text-warning'
                : 'text-xs text-muted-foreground'
            }
          >
            {conflicts > 0 ? (
              <>
                <AlertTriangle className="size-3.5" aria-hidden />
                {pluralize(conflicts, 'date overlaps', 'dates overlap')} other lessons
              </>
            ) : (
              `${pluralize(plan.occurrences.length, 'date')}, none taken`
            )}
          </span>
        ) : null}
      </div>
      {error && !plan ? (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage(error)}
        </p>
      ) : isPending && !plan ? (
        <div role="status" aria-label="Planning the dates">
          <Skeleton className="h-24 w-full rounded-lg" />
        </div>
      ) : !plan ? (
        <p className="text-xs text-muted-foreground">{idleText}</p>
      ) : plan.occurrences.length === 0 ? (
        <p className="text-xs text-muted-foreground">No dates in the next 8 weeks.</p>
      ) : (
        <ol className="max-h-56 divide-y divide-border overflow-y-auto rounded-lg border border-border bg-muted/40">
          {plan.occurrences.map((occurrence) => (
            <li
              key={occurrence.occurrenceOn}
              className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm tabular-nums"
            >
              <span className="flex-1">
                {formatDateTimeRange(occurrence.scheduledAt, durationMinutes)}
              </span>
              {occurrence.conflict ? (
                occurrence.conflictWithLessonId ? (
                  <Link
                    to={paths.detail(occurrence.conflictWithLessonId)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex"
                  >
                    <ToneBadge tone="warning" icon={AlertTriangle}>
                      Overlaps a lesson
                    </ToneBadge>
                  </Link>
                ) : (
                  <ToneBadge tone="warning" icon={AlertTriangle}>
                    Overlaps a lesson
                  </ToneBadge>
                )
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
