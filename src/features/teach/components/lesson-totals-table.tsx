import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router'
import type { LessonTotals } from '@/api/types'
import { cn } from '@/lib/utils'
import { useT } from '../i18n/use-i18n'
import { balanceValue } from '../lib/lesson-totals'
import { TeachCard } from './section'
import { TONE_TEXT } from './tone'

/**
 * The main page's table of the teacher's all-time lesson totals (API.md §12): lessons held, lessons
 * paid and the difference. Paid in advance shows "+2"; in arrears the third header becomes "In
 * arrears" and the amount owed shows in red, without a minus. "…" while loading, "—" when the
 * request failed.
 */
export function LessonTotalsTable({
  totals,
  failed = false,
  paidHint,
  to,
  toLabel,
  className,
}: {
  totals: LessonTotals | undefined
  failed?: boolean
  /** Who paid, for a freelance teacher ("by your students"); none for a school's teacher. */
  paidHint?: string
  /** A page the table leads to (Payments for a school's teacher), with its link text. */
  to?: string
  toLabel?: string
  className?: string
}) {
  const t = useT()
  const placeholder = failed ? '—' : '…'
  const balance = totals?.balance ?? 0
  const inArrears = totals !== undefined && balance < 0
  return (
    <TeachCard className={cn('flex flex-col gap-3 p-5', className)}>
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-foreground">
            {t('teacher.today.totals.title')}
          </h2>
          <p className="text-xs text-muted-foreground">{t('teacher.today.totals.allTime')}</p>
        </div>
        {to && toLabel ? (
          <Link
            to={to}
            className="inline-flex shrink-0 items-center gap-0.5 rounded-md text-sm font-medium text-primary hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            {toLabel}
            <ChevronRight className="size-4" aria-hidden />
          </Link>
        ) : null}
      </header>
      <table className="w-full table-fixed border-collapse text-left">
        <caption className="sr-only">{t('teacher.today.totals.title')}</caption>
        <thead>
          <tr className="align-top">
            <th scope="col" className="pr-2 pb-1 text-xs font-medium text-muted-foreground">
              {t('teacher.today.totals.held')}
            </th>
            <th scope="col" className="pr-2 pb-1 text-xs font-medium text-muted-foreground">
              {t('teacher.today.totals.paid')}
              {paidHint ? <span className="block font-normal">{paidHint}</span> : null}
            </th>
            <th
              scope="col"
              className={cn(
                'pb-1 text-xs font-medium',
                inArrears ? TONE_TEXT.unpaid : 'text-muted-foreground',
              )}
            >
              {t(inArrears ? 'teacher.today.totals.arrears' : 'teacher.today.totals.balance')}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr className="align-top">
            <td className={cn('pr-2 text-3xl font-semibold tabular-nums', TONE_TEXT.held)}>
              {totals ? totals.held : placeholder}
            </td>
            <td className={cn('pr-2 text-3xl font-semibold tabular-nums', TONE_TEXT.paid)}>
              {totals ? totals.paid : placeholder}
            </td>
            <td
              className={cn(
                'text-3xl font-semibold tabular-nums',
                !totals || balance === 0
                  ? 'text-foreground'
                  : inArrears
                    ? TONE_TEXT.unpaid
                    : TONE_TEXT.credits,
              )}
            >
              {totals ? balanceValue(balance) : placeholder}
            </td>
          </tr>
        </tbody>
      </table>
    </TeachCard>
  )
}
