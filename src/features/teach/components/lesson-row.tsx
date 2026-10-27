import { CalendarPlus, Check, Repeat } from 'lucide-react'
import type { Lesson } from '@/api/types'
import { Button } from '@/components/ui/button'
import { useT } from '../i18n/use-i18n'
import { useFormatters } from '../lib/use-formatters'
import { TeachAvatar } from './avatar'
import { LessonStatusBadge, PaymentBadge, TeacherPayoutBadge } from './lesson-badges'
import { ListRow } from './list-row'
import { TeachBadge } from './teach-badge'

export interface LessonRowProps {
  lesson: Lesson
  studentName?: string
  courseTitle?: string
  /** A one-click Finish for a lesson that took place. */
  onFinish?: () => void
  /** A Schedule button for a lesson without a date. */
  onSchedule?: () => void
  /** Show only the time (lists already grouped by day). */
  timeOnly?: boolean
  now?: Date
}

/** A lesson in a list: who, when (start–end), the course, its badges, one-click Finish or Schedule. */
export function LessonRow({
  lesson,
  studentName,
  courseTitle,
  onFinish,
  onSchedule,
  timeOnly = false,
  now,
}: LessonRowProps) {
  const t = useT()
  const fmt = useFormatters()
  const date = lesson.scheduledAt ? new Date(lesson.scheduledAt) : null
  // Undated lessons already carry the "Not scheduled" badge: they show their length instead of a time.
  const when = date
    ? timeOnly
      ? fmt.timeRange(date, lesson.durationMinutes)
      : fmt.whenShortRange(date, lesson.durationMinutes)
    : fmt.duration(lesson.durationMinutes)
  const name = studentName ?? t('common.student')
  return (
    <div className="rounded-2xl border border-border bg-card">
      <ListRow
        to={`/teach/lessons/${lesson.id}`}
        title={name}
        subtitle={[when, courseTitle].filter(Boolean).join(' · ')}
        leading={<TeachAvatar name={name} />}
        footer={
          <>
            <LessonStatusBadge lesson={lesson} now={now} />
            <PaymentBadge lesson={lesson} />
            <TeacherPayoutBadge paidOut={lesson.teacherPayout !== null} />
            {lesson.recurringLessonId ? (
              <TeachBadge icon={Repeat}>{t('lesson.weekly')}</TeachBadge>
            ) : null}
          </>
        }
        trailing={
          onFinish ? (
            <Button type="button" size="sm" className="rounded-full" onClick={onFinish}>
              <Check aria-hidden />
              {t('teacher.today.finish')}
            </Button>
          ) : onSchedule ? (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="rounded-full"
              onClick={onSchedule}
            >
              <CalendarPlus aria-hidden />
              {t('teacher.studentDetail.scheduleOne')}
            </Button>
          ) : undefined
        }
      />
    </div>
  )
}

/** Section heading for lists grouped by day. `null` = undated lessons. */
export function DayHeader({ date, count }: { date: Date | null; count?: number }) {
  const t = useT()
  const fmt = useFormatters()
  return (
    <div className="flex items-baseline justify-between pt-1 pb-1">
      <h3 className="text-sm font-semibold text-muted-foreground">
        {date ? fmt.dayHeading(date) : t('status.unscheduled')}
      </h3>
      {count !== undefined ? (
        <span className="text-xs text-muted-foreground tabular-nums">{count}</span>
      ) : null}
    </div>
  )
}
