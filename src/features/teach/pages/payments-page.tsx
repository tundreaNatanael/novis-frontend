import { Banknote, Loader2, XCircle } from 'lucide-react'
import { useState } from 'react'
import { Navigate } from 'react-router'
import type { TeacherEarnings, TeacherPayout } from '@/api/types'
import type { RouteHandle } from '@/app/route-handle'
import { useMe } from '@/auth/session'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ListRow, RowList } from '../components/list-row'
import { PageTitle, Section, TeachCard } from '../components/section'
import { EmptyState, ErrorState, SkeletonCard, SkeletonList } from '../components/states'
import { TeachBadge } from '../components/teach-badge'
import { TONE_SOFT, TONE_TEXT, type Tone } from '../components/tone'
import { useMonthEarnings, useMyPayouts } from '../data/payouts'
import { useT } from '../i18n/use-i18n'
import { teachCapabilities } from '../lib/capabilities'
import { parseLocalDate } from '../lib/dates'
import { isVoided, paidOnDate } from '../lib/payouts'
import { useFormatters } from '../lib/use-formatters'
import { useTeachTitle } from '../lib/use-teach-title'

export const handle: RouteHandle = { title: 'Payments' }

/**
 * "Payments from <school>": this month counted in lessons (taught, paid to the teacher, owed), then
 * every payout the school recorded, newest first; a voided one stays, marked. Org teachers only.
 */
export function Component() {
  const t = useT()
  const me = useMe()
  const { canViewPayouts, place } = teachCapabilities(me)
  const [now] = useState(() => new Date())
  const earnings = useMonthEarnings(now, { enabled: canViewPayouts })
  const payouts = useMyPayouts({ enabled: canViewPayouts })
  const school = place.kind === 'org' ? place.organization.name : ''
  useTeachTitle(t('nav.payments'))

  if (!canViewPayouts) return <Navigate to="/teach" replace />

  return (
    <div className="flex flex-col gap-6">
      <PageTitle title={t('teacher.payments.title', { school })} />
      {earnings.isError ? (
        <ErrorState compact error={earnings.error} onRetry={() => void earnings.refetch()} />
      ) : (
        <EarningsSummary earnings={earnings.data} month={now} />
      )}
      <Section title={t('teacher.payments.history')}>
        {payouts.isPending ? (
          <SkeletonList rows={3} />
        ) : payouts.error ? (
          <ErrorState compact error={payouts.error} onRetry={() => void payouts.refetch()} />
        ) : payouts.payouts.length === 0 ? (
          <EmptyState
            compact
            icon={Banknote}
            tone="paid"
            title={t('teacher.payments.empty')}
            hint={t('teacher.payments.emptyHint')}
          />
        ) : (
          <div className="flex flex-col gap-3">
            <TeachCard padded={false}>
              <RowList>
                {payouts.payouts.map((payout) => (
                  <PayoutRow key={payout.id} payout={payout} />
                ))}
              </RowList>
            </TeachCard>
            {payouts.hasNextPage ? (
              <Button
                type="button"
                variant="outline"
                className="w-fit self-center rounded-full"
                disabled={payouts.isFetchingNextPage}
                onClick={() => void payouts.fetchNextPage()}
              >
                {payouts.isFetchingNextPage ? (
                  <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden />
                ) : null}
                {t('common.loadMore')}
              </Button>
            ) : null}
          </div>
        )}
      </Section>
    </div>
  )
}

/** This month's lessons taught, paid to the teacher and still owed by the school, and the last payout's day. */
function EarningsSummary({
  earnings,
  month,
}: {
  earnings: TeacherEarnings | undefined
  month: Date
}) {
  const t = useT()
  const fmt = useFormatters()
  const lastPaidOn = earnings?.lastPaidOn ? parseLocalDate(earnings.lastPaidOn) : null
  const figures: { key: string; label: string; value: number | undefined; tone: Tone }[] = [
    // Taught mixes held (green) and canceled-late (orange) lessons, so it takes the neutral accent.
    { key: 'taught', label: t('teacher.payments.taught'), value: earnings?.taught, tone: 'accent' },
    { key: 'paid', label: t('teacher.payments.paid'), value: earnings?.paidOut, tone: 'paid' },
    { key: 'owed', label: t('teacher.payments.owed'), value: earnings?.owed, tone: 'warning' },
  ]
  if (!earnings) return <SkeletonCard lines={3} />
  return (
    <TeachCard className="flex flex-col gap-4 p-5">
      <div>
        <h2 className="text-base font-semibold text-foreground">
          {t('teacher.payments.thisMonth')}
        </h2>
        <p className="text-xs text-muted-foreground">{fmt.monthYear(month)}</p>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {figures.map((figure) => (
          <div
            key={figure.key}
            aria-label={`${figure.label}: ${figure.value ?? '…'}`}
            className={cn('flex flex-col gap-0.5 rounded-xl p-3', TONE_SOFT[figure.tone])}
          >
            <p className={cn('text-2xl font-semibold tabular-nums', TONE_TEXT[figure.tone])}>
              {figure.value ?? '…'}
            </p>
            <p className="text-xs text-muted-foreground">{figure.label}</p>
          </div>
        ))}
      </div>
      <div>
        <p className="text-sm text-foreground">
          {lastPaidOn
            ? t('teacher.payments.lastPaidOn', { date: fmt.longDate(lastPaidOn) })
            : t('teacher.payments.neverPaid')}
        </p>
        <p className="text-xs text-muted-foreground">{t('teacher.payments.countedHint')}</p>
      </div>
    </TeachCard>
  )
}

/** One payout from the school: the day it paid, how many lessons, the note; a voided one says so. */
function PayoutRow({ payout }: { payout: TeacherPayout }) {
  const t = useT()
  const fmt = useFormatters()
  const day = paidOnDate(payout)
  const voided = isVoided(payout)
  return (
    <ListRow
      to={`/teach/payments/${payout.id}`}
      title={day ? fmt.longDate(day) : payout.paidOn}
      subtitle={[t('teacher.payments.lessons', { count: payout.lessonCount }), payout.note]
        .filter(Boolean)
        .join(' · ')}
      leading={
        <span
          className={cn(
            'inline-flex size-10 shrink-0 items-center justify-center rounded-xl',
            voided ? 'bg-muted text-muted-foreground' : 'bg-paid-soft text-paid',
          )}
        >
          <Banknote className="size-5" aria-hidden />
        </span>
      }
      footer={
        voided ? (
          <TeachBadge tone="canceled" icon={XCircle}>
            {t('teacher.payments.voided')}
          </TeachBadge>
        ) : undefined
      }
    />
  )
}
