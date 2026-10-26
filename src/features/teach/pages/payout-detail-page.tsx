import { ArrowLeft, XCircle } from 'lucide-react'
import { Link, useParams } from 'react-router'
import type { RouteHandle } from '@/app/route-handle'
import { TeachAvatar } from '../components/avatar'
import { LessonStatusBadge } from '../components/lesson-badges'
import { ListRow, RowList } from '../components/list-row'
import { PageTitle, Section, TeachCard } from '../components/section'
import { ErrorState, SkeletonCard, SkeletonList } from '../components/states'
import { TeachBadge } from '../components/teach-badge'
import { usePayout } from '../data/payouts'
import { useT } from '../i18n/use-i18n'
import { isVoided, paidOnDate } from '../lib/payouts'
import { useFormatters } from '../lib/use-formatters'
import { useTeachTitle } from '../lib/use-teach-title'

export const handle: RouteHandle = { title: 'Payout' }

/** One payout from the school: when it paid, who recorded it, the note, and the lessons it covers. */
export function Component() {
  const { payoutId = '' } = useParams<{ payoutId: string }>()
  const t = useT()
  const fmt = useFormatters()
  const query = usePayout(payoutId)
  useTeachTitle(t('teacher.payout.title'))

  if (query.isPending) {
    return (
      <div className="flex flex-col gap-4">
        <SkeletonCard lines={3} />
        <SkeletonList rows={3} />
      </div>
    )
  }
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />
  const { payout, lessons } = query.data
  const day = paidOnDate(payout)
  const voided = isVoided(payout)

  return (
    <div className="flex flex-col gap-6">
      <Link
        to="/teach/payments"
        className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" aria-hidden />
        {t('teacher.payout.back')}
      </Link>
      <PageTitle
        eyebrow={t('teacher.payout.title')}
        title={t('teacher.payout.paidOn', { date: day ? fmt.longDate(day) : payout.paidOn })}
        subtitle={`${t('teacher.payments.lessons', { count: payout.lessonCount })} · ${t('teacher.payout.recordedBy', { name: payout.recordedByName })}`}
      />
      {voided || payout.note ? (
        <TeachCard className="flex flex-col gap-2">
          {voided ? (
            <TeachBadge tone="canceled" icon={XCircle} size="md">
              {t('teacher.payments.voided')}
            </TeachBadge>
          ) : null}
          {payout.note ? <p className="whitespace-pre-wrap text-sm">{payout.note}</p> : null}
          {payout.voidedAt ? (
            <p className="text-xs text-muted-foreground">
              {t('teacher.payments.voidedOn', {
                date: fmt.longDate(new Date(payout.voidedAt)),
                reason: payout.voidReason ?? '',
              })}
            </p>
          ) : null}
        </TeachCard>
      ) : null}
      <Section title={t('teacher.payout.lessons')}>
        {voided ? (
          <p className="text-sm text-muted-foreground">{t('teacher.payout.noLessons')}</p>
        ) : (
          <TeachCard padded={false}>
            <RowList>
              {lessons.map((lesson) => (
                <ListRow
                  key={lesson.id}
                  to={`/teach/lessons/${lesson.id}`}
                  title={lesson.studentName}
                  subtitle={[
                    fmt.whenShortRange(new Date(lesson.scheduledAt), lesson.durationMinutes),
                    lesson.courseTitle,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                  leading={<TeachAvatar name={lesson.studentName} />}
                  footer={<LessonStatusBadge lesson={lesson} />}
                />
              ))}
            </RowList>
          </TeachCard>
        )}
      </Section>
    </div>
  )
}
