import { BadgeCheck, CalendarDays, History, Loader2 } from 'lucide-react'
import { useMemo } from 'react'
import type { LessonFilters } from '@/api/types'
import { useMe } from '@/auth/session'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { DayHeader, LessonRow } from '../components/lesson-row'
import { EmptyState, ErrorState, SkeletonList } from '../components/states'
import { useLessonLookups, useTeacherLessons } from '../data/lessons'
import { useT } from '../i18n/use-i18n'
import { teachCapabilities } from '../lib/capabilities'
import { dayKey, toIsoWithOffset } from '../lib/dates'
import { groupByDay, lessonSegments, type LessonSegment } from '../lessons/utils'
import { useTeachSheets } from '../sheets/use-teach-sheets'

/**
 * The Calendar's List mode: upcoming, to finish, to schedule or credits, unpaid for a payment
 * manager, history. The page owns the segment, so other screens can open a given list.
 */
export function LessonList({
  segment: requested,
  onSegmentChange,
  now,
}: {
  segment: LessonSegment
  onSegmentChange: (segment: LessonSegment) => void
  now: Date
}) {
  const t = useT()
  const me = useMe()
  const sheets = useTeachSheets()
  const segments = lessonSegments(teachCapabilities(me))
  // A list this teacher does not have (e.g. "Unpaid" for an org teacher) falls back to the first.
  const segment = segments.includes(requested) ? requested : segments[0]!
  const nowIso = useMemo(() => toIsoWithOffset(now), [now])

  const filters: Record<LessonSegment, { filters: LessonFilters; sort: string }> = {
    upcoming: { filters: { status: 'PENDING', from: nowIso }, sort: 'scheduledAt,asc' },
    toFinish: {
      filters: { status: 'PENDING', unscheduled: false, to: nowIso },
      sort: 'scheduledAt,desc',
    },
    unscheduled: { filters: { status: 'PENDING', unscheduled: true }, sort: 'createdAt,desc' },
    toSchedule: { filters: { status: 'PENDING', unscheduled: true }, sort: 'createdAt,desc' },
    unpaid: { filters: { status: 'PRESENT', paid: false }, sort: 'scheduledAt,desc' },
    history: { filters: { unscheduled: false, to: nowIso }, sort: 'scheduledAt,desc' },
  }

  const primary = useTeacherLessons(filters[segment].filters, filters[segment].sort)
  // "Unpaid" needs two statuses; the API filters one status at a time.
  const lateUnpaid = useTeacherLessons(
    { status: 'CANCELED_LATE', paid: false },
    'scheduledAt,desc',
    {
      enabled: segment === 'unpaid',
    },
  )
  const { studentName, courseTitle } = useLessonLookups()

  const sections =
    segment === 'unpaid'
      ? [
          {
            key: 'held',
            title: t('teacher.lessons.unpaidHeld'),
            date: null,
            items: primary.lessons,
          },
          {
            key: 'late',
            title: t('teacher.lessons.unpaidLate'),
            date: null,
            items: lateUnpaid.lessons,
          },
        ].filter((s) => s.items.length > 0)
      : groupByDay(
          segment === 'history'
            ? primary.lessons.filter((l) => l.status !== 'PENDING')
            : primary.lessons,
          dayKey,
        ).map((g) => ({ key: g.key, title: null, date: g.date, items: g.items }))

  const isPending = primary.isPending || (segment === 'unpaid' && lateUnpaid.isPending)
  const error = primary.error ?? (segment === 'unpaid' ? lateUnpaid.error : null)
  const hasMore = primary.hasNextPage || (segment === 'unpaid' && lateUnpaid.hasNextPage)
  const fetchingMore = primary.isFetchingNextPage || lateUnpaid.isFetchingNextPage
  const loadMore = () => {
    if (primary.hasNextPage && !primary.isFetchingNextPage) void primary.fetchNextPage()
    if (segment === 'unpaid' && lateUnpaid.hasNextPage && !lateUnpaid.isFetchingNextPage)
      void lateUnpaid.fetchNextPage()
  }

  return (
    <div className="flex flex-col gap-4">
      <div
        role="radiogroup"
        aria-label={t('teacher.calendar.views.list')}
        className="flex flex-wrap gap-2"
      >
        {segments.map((value) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={value === segment}
            onClick={() => onSegmentChange(value)}
            className={cn(
              'h-8 rounded-full border px-3.5 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
              value === segment
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-card text-foreground hover:bg-muted',
            )}
          >
            {t(`teacher.lessons.segments.${value}`)}
          </button>
        ))}
      </div>
      {isPending ? (
        <SkeletonList rows={5} />
      ) : error && sections.length === 0 ? (
        <ErrorState error={error} onRetry={() => void primary.refetch()} />
      ) : sections.length === 0 ? (
        <EmptyState
          icon={segment === 'history' ? History : segment === 'unpaid' ? BadgeCheck : CalendarDays}
          title={t(`teacher.lessons.empty.${segment}`)}
          hint={t(`teacher.lessons.empty.${segment}Hint`)}
        />
      ) : (
        <div className="flex flex-col gap-4">
          {sections.map((section) => (
            <section key={section.key} className="flex flex-col gap-2">
              {section.title ? (
                <h3 className="text-sm font-semibold text-muted-foreground">{section.title}</h3>
              ) : (
                <DayHeader date={section.date} count={section.items.length} />
              )}
              {section.items.map((lesson) => (
                <LessonRow
                  key={lesson.id}
                  lesson={lesson}
                  now={now}
                  timeOnly={section.title === null && lesson.scheduledAt !== null}
                  studentName={studentName(lesson.studentId)}
                  courseTitle={courseTitle(lesson.courseId)}
                  onFinish={
                    segment === 'toFinish'
                      ? () => sheets.open({ kind: 'finish', lessonId: lesson.id })
                      : undefined
                  }
                  onSchedule={
                    segment === 'toSchedule' || segment === 'unscheduled'
                      ? () => sheets.open({ kind: 'schedule', lessonId: lesson.id })
                      : undefined
                  }
                />
              ))}
            </section>
          ))}
          {hasMore ? (
            <Button
              type="button"
              variant="outline"
              className="w-fit self-center rounded-full"
              onClick={loadMore}
              disabled={fetchingMore}
            >
              {fetchingMore ? (
                <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden />
              ) : null}
              {t('common.loadMore')}
            </Button>
          ) : null}
        </div>
      )}
    </div>
  )
}
