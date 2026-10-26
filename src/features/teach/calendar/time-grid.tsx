import { Banknote, Flag, RotateCw } from 'lucide-react'
import { useEffect, useRef, type CSSProperties } from 'react'
import type { CalendarLesson } from '@/api/types'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { TONE_BORDER, TONE_SOFT } from '../components/tone'
import { useT } from '../i18n/use-i18n'
import { dayKey, differenceInCalendarDays, isSameDay, minutesIntoDay } from '../lib/dates'
import { useFormatters } from '../lib/use-formatters'
import { daysOf, type CalendarWindow } from './dates'
import { lessonLabel } from './labels'
import {
  blockTone,
  isToFinish,
  lessonsByDay,
  minutesAt,
  placeLessons,
  slotStart,
  type PlacedLesson,
} from './layout'
import { useCalendarWindow } from './use-calendar'

/** One hour of the grid, in pixels; the day is 24 of them. */
export const HOUR_HEIGHT = 56
const GUTTER = 56
const HOURS = Array.from({ length: 24 }, (_, hour) => hour)

export interface TimeGridProps {
  window: CalendarWindow
  now: Date
  /** A lesson to bring into view and mark (the "To finish" jump). */
  focusId: string | null
  onOpen: (lesson: CalendarLesson) => void
  /** An empty part of a day was clicked: book a lesson starting then. */
  onSlot: (start: Date) => void
  onDayPress: (day: Date) => void
}

/**
 * The day and week views: the day heads on top, one vertical scroll for 24 hours, the hour
 * gutter on the left and a column per day with its lessons as blocks. Clicking an empty part of a
 * column books a lesson there; screen readers book with the page's Book lesson button instead.
 */
export function TimeGrid({ window, now, focusId, onOpen, onSlot, onDayPress }: TimeGridProps) {
  const t = useT()
  const fmt = useFormatters()
  const query = useCalendarWindow(window)
  const days = daysOf(window)
  const byDay = lessonsByDay(query.data ?? [], window)
  const scroller = useRef<HTMLDivElement>(null)
  const windowKey = `${dayKey(window.start)}-${dayKey(window.end)}`
  const todayColumn = differenceInCalendarDays(now, window.start)
  const focusMinutes =
    focusId === null
      ? null
      : (query.data?.find((lesson) => lesson.id === focusId)?.scheduledAt ?? null)

  // Open an hour before now when today shows, else at 08:00; a jump brings its lesson an hour below the top.
  useEffect(() => {
    const element = scroller.current
    if (!element) return
    let minutes: number
    if (focusMinutes !== null) minutes = minutesIntoDay(new Date(focusMinutes)) - 60
    else minutes = todayColumn >= 0 && todayColumn < days.length ? minutesIntoDay(now) - 60 : 8 * 60
    element.scrollTop = Math.max(0, (minutes / 60) * HOUR_HEIGHT)
    // Only when the window or the jump changes: the clock's ticks must not scroll the grid.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [windowKey, focusMinutes])

  return (
    <div className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-border bg-card">
      {days.length > 1 ? (
        <div className="flex border-b border-border" style={{ paddingLeft: GUTTER }}>
          {days.map((day) => {
            const today = isSameDay(day, now)
            return (
              <button
                key={dayKey(day)}
                type="button"
                onClick={() => onDayPress(day)}
                aria-label={
                  today ? `${t('common.today')}, ${fmt.weekdayDate(day)}` : fmt.weekdayDate(day)
                }
                title={t('teacher.calendar.showDay')}
                className="flex flex-1 flex-col items-center gap-0.5 border-l border-border py-2 text-xs font-medium text-muted-foreground transition-colors first:border-l-0 hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                <span className={today ? 'text-accent-foreground' : undefined}>
                  {fmt.weekdayShort(day)}
                </span>
                <span
                  className={cn(
                    'flex size-7 items-center justify-center rounded-full text-sm font-semibold tabular-nums',
                    today ? 'bg-primary text-primary-foreground' : 'text-foreground',
                  )}
                >
                  {fmt.dayOfMonth(day)}
                </span>
              </button>
            )
          })}
        </div>
      ) : null}
      <div
        ref={scroller}
        className="relative overflow-y-auto"
        style={{ maxHeight: 'calc(100vh - 17rem)', minHeight: '24rem' }}
      >
        <div className="relative flex" style={{ height: HOUR_HEIGHT * 24 }}>
          <div aria-hidden className="relative shrink-0" style={{ width: GUTTER }}>
            {HOURS.slice(1).map((hour) => (
              <span
                key={hour}
                className="absolute right-2 -translate-y-1/2 text-[11px] text-muted-foreground tabular-nums"
                style={{ top: hour * HOUR_HEIGHT }}
              >
                {fmt.hour(hour)}
              </span>
            ))}
          </div>
          <div
            className="relative flex flex-1"
            style={
              {
                backgroundImage: `repeating-linear-gradient(to bottom, var(--border) 0 1px, transparent 1px ${HOUR_HEIGHT}px)`,
              } as CSSProperties
            }
          >
            {days.map((day, column) => (
              <div
                key={dayKey(day)}
                className="relative flex-1 border-l border-border"
                onClick={(event) => {
                  if (event.target !== event.currentTarget) return
                  const rect = event.currentTarget.getBoundingClientRect()
                  onSlot(slotStart(day, minutesAt(event.clientY - rect.top, HOUR_HEIGHT)))
                }}
                title={t('teacher.calendar.slotHint')}
              >
                {placeLessons(byDay[column] ?? []).map((placed) => (
                  <LessonBlock
                    key={placed.lesson.id}
                    placed={placed}
                    now={now}
                    highlighted={placed.lesson.id === focusId}
                    onOpen={onOpen}
                  />
                ))}
                {column === todayColumn ? (
                  <div
                    aria-hidden
                    className="pointer-events-none absolute right-0 -left-1 z-20 flex items-center"
                    style={{ top: (minutesIntoDay(now) / 60) * HOUR_HEIGHT - 4 }}
                  >
                    <span className="size-2 rounded-full bg-danger" />
                    <span className="h-0.5 flex-1 bg-danger" />
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
        {query.isError ? (
          <div
            role="alert"
            className="absolute top-3 right-3 left-3 flex items-center gap-2 rounded-xl border border-border bg-popover p-3 text-sm shadow-md"
          >
            <span className="flex-1">{t('teacher.calendar.loadFailed')}</span>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => void query.refetch()}
            >
              <RotateCw aria-hidden />
              {t('common.retry')}
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  )
}

/**
 * A lesson on the time grid: as tall as it lasts, in its status colour, with the orange "to
 * finish" flag once a pending lesson has started. Click for the actions.
 */
function LessonBlock({
  placed,
  now,
  highlighted,
  onOpen,
}: {
  placed: PlacedLesson<CalendarLesson>
  now: Date
  highlighted: boolean
  onOpen: (lesson: CalendarLesson) => void
}) {
  const t = useT()
  const fmt = useFormatters()
  const { lesson, top, height, lane, lanes } = placed
  const tone = blockTone(lesson)
  const perMinute = HOUR_HEIGHT / 60
  const blockHeight = Math.max(height * perMinute - 2, 16)
  const time = fmt.timeRange(new Date(lesson.scheduledAt), lesson.durationMinutes)
  const toFinish = isToFinish(lesson, now)
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation()
        onOpen(lesson)
      }}
      aria-label={lessonLabel(t, fmt, lesson, now)}
      title={t('teacher.calendar.lessonHint')}
      className={cn(
        'absolute z-10 overflow-hidden rounded-md border-l-[3px] px-1.5 py-0.5 text-left text-xs transition-shadow hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
        TONE_SOFT[tone],
        TONE_BORDER[tone],
        highlighted && 'ring-2 ring-ring ring-offset-2 ring-offset-card',
      )}
      style={{
        top: top * perMinute + 1,
        left: `calc(${(lane / lanes) * 100}% + 2px)`,
        width: `calc(${100 / lanes}% - 4px)`,
        height: blockHeight,
      }}
    >
      <span
        className={cn(
          'block truncate font-semibold',
          tone === 'canceled' ? 'text-muted-foreground line-through' : 'text-foreground',
        )}
      >
        {lesson.studentName}
      </span>
      {blockHeight >= 32 ? (
        <span className="block truncate text-muted-foreground">{lesson.courseTitle ?? time}</span>
      ) : null}
      {toFinish ? (
        <Flag className="absolute top-1 right-1 size-3 text-warning" aria-hidden />
      ) : lesson.paidOut ? (
        <Banknote className="absolute top-1 right-1 size-3 text-paid" aria-hidden />
      ) : null}
    </button>
  )
}
