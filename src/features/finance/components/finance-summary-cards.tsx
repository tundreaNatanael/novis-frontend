import { useQuery } from '@tanstack/react-query'
import { reportKeys, reportsApi } from '@/api/reports'
import type { FinancePeriod } from '@/api/types'
import { ErrorState } from '@/components/data/error-state'
import { Skeleton } from '@/components/ui/skeleton'
import { LESSON_COUNTS } from '@/features/lessons/lesson-counts'

interface FinanceSummaryCardsProps {
  orgId: string
  period: FinancePeriod
}

/**
 * The period's totals (`GET /orgs/{orgId}/reports/summary`): lessons paid by students, used, paid
 * out to teachers and owed to them — the sums of the two tables below.
 */
export function FinanceSummaryCards({ orgId, period }: FinanceSummaryCardsProps) {
  const summary = useQuery({
    queryKey: reportKeys.summary(orgId, period),
    queryFn: ({ signal }) => reportsApi.summary(orgId, period, signal),
    staleTime: 0,
  })
  if (summary.isError) {
    return <ErrorState error={summary.error} onRetry={() => void summary.refetch()} />
  }
  const totals = summary.data
  const cards = [
    {
      label: 'Paid by students',
      value: totals?.students.paidByStudent,
      hint: LESSON_COUNTS.paidByStudent.hint,
    },
    { label: 'Used', value: totals?.students.used, hint: LESSON_COUNTS.used.hint },
    {
      label: 'Paid to teachers',
      value: totals?.teachers.paidOut,
      hint: LESSON_COUNTS.paidOut.hint,
    },
    {
      label: 'Owed to teachers',
      value: totals?.teachers.owed,
      hint:
        totals === undefined
          ? LESSON_COUNTS.owed.hint
          : `${LESSON_COUNTS.owed.hint} ${totals.teachers.owedAllTime} owed all time.`,
    },
  ]
  return (
    <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Totals for the period">
      {cards.map((card) => (
        <li
          key={card.label}
          className="flex flex-col gap-1 rounded-lg border border-border bg-card p-3"
        >
          <span className="text-xs text-muted-foreground">{card.label}</span>
          {card.value === undefined ? (
            <Skeleton className="h-8 w-12" />
          ) : (
            <span className="text-2xl font-semibold text-card-foreground tabular-nums">
              {card.value}
            </span>
          )}
          <span className="text-xs text-muted-foreground">{card.hint}</span>
        </li>
      ))}
    </ul>
  )
}
