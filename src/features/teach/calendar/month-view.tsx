import type { CalendarLesson } from '@/api/types'
import { cn } from '@/lib/utils'
import { LessonStatusBadge } from '../components/lesson-badges'
import { DayHeader } from '../components/lesson-row'
import { ErrorState, SkeletonList } from '../components/states'
import { TONE_SOLID } from '../components/tone'
import { useT } from '../i18n/use-i18n'
import { addDays, dayKey, isSameDay, startOfWeek, type Weekday } from '../lib/dates'
import { useFormatters } from '../lib/use-formatters'
import { daysOf, type CalendarWindow } from './dates'
import { blockTone, dayMarks } from './layout'
import { lessonLabel } from './labels'
import { useCalendarWindow } from './use-calendar'

export interface MonthViewProps {
  /** The six-week grid of the month. */
  window: CalendarWindow
  /** The first of the month shown. */
  month: Date
  selected: Date
  onSelect: (day: Date) => void
  now: Date
  focusId: string | null
  onOpen: (lesson: CalendarLesson) => void
}

/**
 * The month: a six-week grid with a dot under each day with lessons (orange when one is left to
 * finish), and the selected day's lessons beside it. Both come from the month's one query.
 */
export function MonthView({
  window,
  month,
  selected,
  onSelect,
  now,
  focusId,
  onOpen,
}: MonthViewProps) {
  const t = useT()
  const fmt = useFormatters()
  const query = useCalendarWindow(window)
  const marks = dayMarks(query.data ?? [], now)
  const days = daysOf(window)
  const weeks = Array.from({ length: 6 }, (_, week) => days.slice(week * 7, week * 7 + 7))
  const agenda = (query.data ?? []).filter((lesson) =>
    isSameDay(new Date(lesson.scheduledAt), selected),
  )

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(18rem,2fr)]">
      <div className="min-w-0 rounded-2xl border border-border bg-card p-3">
        <WeekdayRow weekStartsOn={window.start.getDay() as Weekday} />
        <div role="grid" aria-label={fmt.monthYear(month)} className="flex flex-col gap-1">
          {weeks.map((week) => (
            <div key={dayKey(week[0]!)} role="row" className="grid grid-cols-7 gap-1">
              {week.map((day) => {
                const mark = marks.get(dayKey(day))
                const count = mark?.count ?? 0
                const today = isSameDay(day, now)
                const isSelected = isSameDay(day, selected)
                const outside = day.getMonth() !== month.getMonth()
                const date = today
                  ? `${t('common.today')}, ${fmt.weekdayDate(day)}`
                  : fmt.weekdayDate(day)
                const label = mark?.toFinish
                  ? `${t('teacher.calendar.day', { count, date })}, ${t('status.toFinish')}`
                  : t('teacher.calendar.day', { count, date })
                return (
                  <div key={dayKey(day)} role="gridcell">
                    <button
                      type="button"
                      aria-label={label}
                      aria-pressed={isSelected}
                      onClick={() => onSelect(day)}
                      className={cn(
                        'flex h-14 w-full flex-col items-center justify-center gap-1 rounded-xl transition-colors hover:bg-muted/70 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                        isSelected && 'bg-accent hover:bg-accent',
                      )}
                    >
                      <span
                        className={cn(
                          'flex size-7 items-center justify-center rounded-full text-sm font-semibold tabular-nums',
                          today && 'bg-primary text-primary-foreground',
                          !today && outside && 'text-muted-foreground/60',
                          !today && !outside && 'text-foreground',
                        )}
                      >
                        {fmt.dayOfMonth(day)}
                      </span>
                      <span
                        aria-hidden
                        className={cn(
                          'size-1.5 rounded-full',
                          count === 0
                            ? 'bg-transparent'
                            : mark?.toFinish
                              ? 'bg-warning'
                              : 'bg-upcoming',
                          outside && 'opacity-50',
                        )}
                      />
                    </button>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>
      <div className="flex min-w-0 flex-col gap-2">
        <DayHeader date={selected} count={query.isPending ? undefined : agenda.length} />
        {query.isPending ? (
          <SkeletonList rows={2} />
        ) : query.isError ? (
          <ErrorState compact error={query.error} onRetry={() => void query.refetch()} />
        ) : agenda.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('teacher.calendar.noLessons')}</p>
        ) : (
          <ol className="flex flex-col gap-2">
            {agenda.map((lesson) => (
              <li key={lesson.id}>
                <AgendaRow
                  lesson={lesson}
                  now={now}
                  highlighted={lesson.id === focusId}
                  onOpen={onOpen}
                />
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  )
}

/** The weekday initials over the grid, from the week's first day. */
function WeekdayRow({ weekStartsOn }: { weekStartsOn: Weekday }) {
  const fmt = useFormatters()
  const first = startOfWeek(new Date(), weekStartsOn)
  return (
    <div aria-hidden className="mb-1 grid grid-cols-7 gap-1">
      {Array.from({ length: 7 }, (_, i) => addDays(first, i)).map((day) => (
        <span key={dayKey(day)} className="text-center text-xs font-medium text-muted-foreground">
          {fmt.weekdayShort(day)}
        </span>
      ))}
    </div>
  )
}

/** A lesson of the selected day: click for the actions. */
export function AgendaRow({
  lesson,
  now,
  highlighted,
  onOpen,
}: {
  lesson: CalendarLesson
  now: Date
  highlighted: boolean
  onOpen: (lesson: CalendarLesson) => void
}) {
  const t = useT()
  const fmt = useFormatters()
  const time = fmt.timeRange(new Date(lesson.scheduledAt), lesson.durationMinutes)
  return (
    <button
      type="button"
      aria-label={lessonLabel(t, fmt, lesson, now)}
      title={t('teacher.calendar.lessonHint')}
      onClick={() => onOpen(lesson)}
      className={cn(
        'flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-3 text-left transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
        highlighted && 'ring-2 ring-ring',
      )}
    >
      <span
        aria-hidden
        className={cn('h-10 w-1 shrink-0 rounded-full', TONE_SOLID[blockTone(lesson)])}
      />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-semibold text-foreground">{lesson.studentName}</span>
        <span className="truncate text-xs text-muted-foreground tabular-nums">
          {[time, lesson.courseTitle, lesson.paidOut ? t('status.paidToYou') : null]
            .filter(Boolean)
            .join(' · ')}
        </span>
      </span>
      <LessonStatusBadge lesson={lesson} now={now} />
    </button>
  )
}
