import { Banknote, CalendarPlus, CheckCircle2, PartyPopper } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import type { RouteHandle } from '@/app/route-handle'
import { useMe } from '@/auth/session'
import { Button } from '@/components/ui/button'
import { calendarLinkTo, calendarListLink } from '../calendar/links'
import { LessonRow } from '../components/lesson-row'
import { PageTitle, Section } from '../components/section'
import { StatTile } from '../components/stat-tile'
import { EmptyState, ErrorState, SkeletonList } from '../components/states'
import { ToFinishBanner } from '../components/to-finish-banner'
import { useLessonCount, useLessonLookups, useTeacherLessons, useToFinish } from '../data/lessons'
import { useMonthEarnings } from '../data/payouts'
import { useT } from '../i18n/use-i18n'
import { teachCapabilities } from '../lib/capabilities'
import { endOfDay, endOfMonth, parseLocalDate, startOfMonth, toIsoWithOffset } from '../lib/dates'
import { useFormatters } from '../lib/use-formatters'
import { useTeachTitle } from '../lib/use-teach-title'
import { useTeachSheets } from '../sheets/use-teach-sheets'

export const handle: RouteHandle = { title: 'Today' }

/**
 * Today: the date, the "To finish" banner, two number tiles (lessons held this month; for a
 * school's teacher what the school still owes, opening Payments), then the lessons to finish,
 * today's and the coming ones.
 */
export function Component() {
  const t = useT()
  const fmt = useFormatters()
  const me = useMe()
  const sheets = useTeachSheets()
  const { canViewPayouts, place } = teachCapabilities(me)
  const [now] = useState(() => new Date())
  useTeachTitle(t('teacher.today.title'))

  const bounds = useMemo(
    () => ({
      now: toIsoWithOffset(now),
      endOfToday: toIsoWithOffset(endOfDay(now)),
      monthStart: toIsoWithOffset(startOfMonth(now)),
      monthEnd: toIsoWithOffset(endOfMonth(now)),
    }),
    [now],
  )

  const toFinish = useTeacherLessons(
    { status: 'PENDING', unscheduled: false, to: bounds.now },
    'scheduledAt,desc',
  )
  const toFinishSummary = useToFinish(now)
  const today = useTeacherLessons(
    { status: 'PENDING', from: bounds.now, to: bounds.endOfToday },
    'scheduledAt,asc',
  )
  const upcoming = useTeacherLessons(
    { status: 'PENDING', from: bounds.endOfToday },
    'scheduledAt,asc',
  )
  const heldPresent = useLessonCount({
    status: 'PRESENT',
    from: bounds.monthStart,
    to: bounds.monthEnd,
  })
  const heldLate = useLessonCount({
    status: 'CANCELED_LATE',
    from: bounds.monthStart,
    to: bounds.monthEnd,
  })
  // What the school paid this teacher for (a teacher payout); a freelance teacher has no school.
  const earnings = useMonthEarnings(now, { enabled: canViewPayouts })
  const { studentName, courseTitle } = useLessonLookups()
  const oldestToFinish = toFinishSummary.data?.oldest ?? null

  const heldValue =
    heldPresent.isPending || heldLate.isPending
      ? '…'
      : String((heldPresent.data ?? 0) + (heldLate.data ?? 0))
  const lastPaidOn = earnings.data?.lastPaidOn ? parseLocalDate(earnings.data.lastPaidOn) : null
  const owedValue = earnings.data ? String(earnings.data.owed) : earnings.isError ? '—' : '…'
  const school = place.kind === 'org' ? place.organization.name : ''
  const owedHint = earnings.data
    ? lastPaidOn
      ? t('teacher.payments.lastPaidOn', { date: fmt.shortDate(lastPaidOn) })
      : t('teacher.payments.neverPaid')
    : school

  return (
    <div className="flex flex-col gap-6">
      <PageTitle
        eyebrow={fmt.weekdayDate(now)}
        title={t('teacher.today.greeting', { name: me.name.split(/\s+/)[0] ?? me.name })}
        actions={
          <Button
            type="button"
            className="rounded-full"
            onClick={() => sheets.open({ kind: 'book' })}
          >
            <CalendarPlus aria-hidden />
            {t('teacher.today.book')}
          </Button>
        }
      />
      {oldestToFinish && toFinishSummary.data ? (
        <ToFinishBanner count={toFinishSummary.data.count} to={calendarLinkTo(oldestToFinish)} />
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2 lg:max-w-xl">
        <StatTile
          icon={CheckCircle2}
          tone="held"
          value={heldValue}
          label={t('teacher.today.heldLabel')}
          hint={fmt.monthYear(now)}
        />
        {canViewPayouts ? (
          <StatTile
            icon={Banknote}
            tone="paid"
            value={owedValue}
            label={t('teacher.today.owedLabel')}
            hint={owedHint}
            to="/teach/payments"
          />
        ) : null}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-6">
          <Section title={t('teacher.today.toFinish')} hint={t('teacher.today.toFinishHint')}>
            {toFinish.isPending ? (
              <SkeletonList rows={2} />
            ) : toFinish.error ? (
              <ErrorState compact error={toFinish.error} onRetry={() => void toFinish.refetch()} />
            ) : toFinish.lessons.length === 0 ? (
              <EmptyState
                compact
                icon={PartyPopper}
                tone="held"
                title={t('teacher.today.allCaughtUp')}
                hint={t('teacher.today.allCaughtUpHint')}
              />
            ) : (
              <div className="flex flex-col gap-2">
                {toFinish.lessons.map((lesson) => (
                  <LessonRow
                    key={lesson.id}
                    lesson={lesson}
                    now={now}
                    studentName={studentName(lesson.studentId)}
                    courseTitle={courseTitle(lesson.courseId)}
                    onFinish={() => sheets.open({ kind: 'finish', lessonId: lesson.id })}
                  />
                ))}
                {toFinish.hasNextPage ? (
                  <Button asChild variant="ghost" size="sm" className="w-fit">
                    <Link to={calendarListLink('toFinish')}>{t('common.seeAll')}</Link>
                  </Button>
                ) : null}
              </div>
            )}
          </Section>
          <Section title={t('teacher.today.todayLessons')}>
            {today.isPending ? (
              <SkeletonList rows={2} />
            ) : today.error ? (
              <ErrorState compact error={today.error} onRetry={() => void today.refetch()} />
            ) : today.lessons.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('teacher.today.todayEmpty')}</p>
            ) : (
              <div className="flex flex-col gap-2">
                {today.lessons.map((lesson) => (
                  <LessonRow
                    key={lesson.id}
                    lesson={lesson}
                    now={now}
                    timeOnly
                    studentName={studentName(lesson.studentId)}
                    courseTitle={courseTitle(lesson.courseId)}
                  />
                ))}
              </div>
            )}
          </Section>
        </div>
        <Section
          title={t('teacher.today.upcoming')}
          action={
            <Button asChild variant="ghost" size="sm">
              <Link to={calendarListLink('upcoming')}>{t('common.seeAll')}</Link>
            </Button>
          }
        >
          {upcoming.isPending ? (
            <SkeletonList rows={3} />
          ) : upcoming.error ? (
            <ErrorState compact error={upcoming.error} onRetry={() => void upcoming.refetch()} />
          ) : upcoming.lessons.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('teacher.today.upcomingEmpty')}</p>
          ) : (
            <div className="flex flex-col gap-2">
              {upcoming.lessons.slice(0, 8).map((lesson) => (
                <LessonRow
                  key={lesson.id}
                  lesson={lesson}
                  now={now}
                  studentName={studentName(lesson.studentId)}
                  courseTitle={courseTitle(lesson.courseId)}
                />
              ))}
            </div>
          )}
        </Section>
      </div>
    </div>
  )
}
