import { CalendarPlus, ChevronLeft, ChevronRight } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import type { CalendarLesson } from '@/api/types'
import type { RouteHandle } from '@/app/route-handle'
import { useMe } from '@/auth/session'
import { Button } from '@/components/ui/button'
import { closeOutcome, type LessonAction } from '../calendar/actions'
import {
  anchorFromParam,
  anchorParam,
  isCalendarView,
  neighbourWindows,
  stepAnchor,
  windowFor,
  type CalendarView,
  type GridView,
} from '../calendar/dates'
import { LessonActionsDialog } from '../calendar/lesson-actions-dialog'
import { calendarLinkTo } from '../calendar/links'
import { LessonList } from '../calendar/lesson-list'
import { MonthView } from '../calendar/month-view'
import { TimeGrid } from '../calendar/time-grid'
import {
  useCloseFromCalendar,
  useMinuteClock,
  usePrefetchCalendarWindows,
} from '../calendar/use-calendar'
import { Segmented } from '../components/form-controls'
import { PageTitle } from '../components/section'
import { ToFinishBanner } from '../components/to-finish-banner'
import { useToFinish } from '../data/lessons'
import { useT } from '../i18n/use-i18n'
import { startOfDay, startOfMonth, toIsoWithOffset } from '../lib/dates'
import { openApp, openInNewTab } from '../lib/open-url'
import { useFormatters } from '../lib/use-formatters'
import { useTeachTitle } from '../lib/use-teach-title'
import { isLessonSegment, teacherJoin, type LessonSegment } from '../lessons/utils'
import { useTeachSheets } from '../sheets/use-teach-sheets'

export const handle: RouteHandle = { title: 'Calendar' }

/**
 * The teacher's calendar: Day and Week time grids, a Month grid with the selected day's lessons,
 * and List (the lesson lists). The view, the day and the list's segment live in the URL. One
 * `GET /teacher/calendar` per visible window, the neighbours prefetched. Clicking a lesson opens
 * its actions ("Mark as held" closes it in one click), clicking an empty slot books a lesson
 * there, and "To finish (N)" jumps to the oldest lesson still waiting for an outcome.
 */
export function Component() {
  const t = useT()
  const me = useMe()
  const fmt = useFormatters()
  const navigate = useNavigate()
  const sheets = useTeachSheets()
  const [params, setParams] = useSearchParams()
  const now = useMinuteClock()
  const today = startOfDay(now)
  const viewParam = params.get('view')
  const view: CalendarView = isCalendarView(viewParam) ? viewParam : 'week'
  const anchor = anchorFromParam(params.get('date'), today)
  const segmentParam = params.get('segment')
  const segment: LessonSegment = isLessonSegment(segmentParam) ? segmentParam : 'upcoming'
  const focusId = params.get('focus')
  const [dialog, setDialog] = useState<{ lesson: CalendarLesson; open: boolean } | null>(null)
  const toFinish = useToFinish(now)
  const close = useCloseFromCalendar()
  useTeachTitle(t('teacher.calendar.title'))

  const gridView: GridView | null = view === 'list' ? null : view
  const window = gridView ? windowFor(gridView, anchor, fmt.weekStartsOn) : null
  usePrefetchCalendarWindows(
    gridView ? neighbourWindows(gridView, anchor, fmt.weekStartsOn, today) : [],
  )

  const update = (patch: Record<string, string | null>) => {
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous)
        for (const [key, value] of Object.entries(patch)) {
          if (value === null) next.delete(key)
          else next.set(key, value)
        }
        return next
      },
      { replace: true },
    )
  }

  // A jump marks its lesson for a moment, then the URL forgets it.
  useEffect(() => {
    if (!focusId) return
    const timer = globalThis.setTimeout(() => {
      setParams(
        (previous) => {
          const next = new URLSearchParams(previous)
          next.delete('focus')
          return next
        },
        { replace: true },
      )
    }, 4000)
    return () => globalThis.clearTimeout(timer)
  }, [focusId, setParams])
  const setView = (next: CalendarView) => update({ view: next, focus: null })
  const setAnchor = (next: Date) => update({ date: anchorParam(next), focus: null })
  const move = (direction: -1 | 1) => {
    if (gridView) setAnchor(stepAnchor(gridView, anchor, direction, today))
  }

  const runAction = (action: LessonAction, lesson: CalendarLesson) => {
    setDialog((current) => (current ? { ...current, open: false } : current))
    switch (action) {
      case 'markHeld':
      case 'canceledOnTime':
      case 'canceledLate':
        close.mutate({ id: lesson.id, status: closeOutcome[action] })
        return
      case 'join': {
        // A WhatsApp call on your own number opens the WhatsApp app (D-058).
        const target = teacherJoin(lesson.meetingUrl, me.whatsappNumber)
        const opened =
          target?.kind === 'openWhatsApp'
            ? openApp(target.url)
            : target
              ? openInNewTab(target.url)
              : true
        if (!opened) toast.error(t('lesson.joinFailed'))
        return
      }
      case 'reschedule':
        sheets.open({ kind: 'schedule', lessonId: lesson.id })
        return
      case 'open':
        navigate(`/teach/lessons/${lesson.id}`)
    }
  }

  let title = t('teacher.calendar.title')
  let previousLabel = ''
  let nextLabel = ''
  if (gridView === 'day') {
    title = fmt.weekdayDate(anchor)
    previousLabel = t('teacher.calendar.previous.day')
    nextLabel = t('teacher.calendar.next.day')
  } else if (gridView === 'week' && window) {
    title = fmt.monthSpan(window.start, window.end)
    previousLabel = t('teacher.calendar.previous.week')
    nextLabel = t('teacher.calendar.next.week')
  } else if (gridView === 'month') {
    title = fmt.monthYear(startOfMonth(anchor))
    previousLabel = t('teacher.calendar.previous.month')
    nextLabel = t('teacher.calendar.next.month')
  }
  const oldest = toFinish.data?.oldest ?? null

  return (
    <div className="flex flex-col gap-4">
      <PageTitle
        eyebrow={t('teacher.calendar.title')}
        title={
          gridView ? (
            <span className="inline-flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="rounded-full"
                aria-label={previousLabel}
                onClick={() => move(-1)}
              >
                <ChevronLeft aria-hidden />
              </Button>
              <span>{title}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="rounded-full"
                aria-label={nextLabel}
                onClick={() => move(1)}
              >
                <ChevronRight aria-hidden />
              </Button>
            </span>
          ) : (
            title
          )
        }
        actions={
          <>
            {gridView ? (
              <Button
                type="button"
                variant="outline"
                className="rounded-full"
                onClick={() => setAnchor(today)}
              >
                {t('teacher.calendar.today')}
              </Button>
            ) : null}
            <Segmented<CalendarView>
              label={t('teacher.calendar.viewLabel')}
              value={view}
              onChange={setView}
              options={(['day', 'week', 'month', 'list'] as const).map((value) => ({
                value,
                label: t(`teacher.calendar.views.${value}`),
              }))}
            />
            <Button
              type="button"
              className="rounded-full"
              onClick={() => sheets.open({ kind: 'book', startAt: toIsoWithOffset(anchor) })}
            >
              <CalendarPlus aria-hidden />
              {t('teacher.calendar.book')}
            </Button>
          </>
        }
      />
      {gridView && oldest && toFinish.data ? (
        <ToFinishBanner count={toFinish.data.count} to={calendarLinkTo(oldest)} />
      ) : null}
      {window && gridView && gridView !== 'month' ? (
        <TimeGrid
          window={window}
          now={now}
          focusId={focusId}
          onOpen={(lesson) => setDialog({ lesson, open: true })}
          onSlot={(start) => sheets.open({ kind: 'book', startAt: toIsoWithOffset(start) })}
          onDayPress={(day) => update({ view: 'day', date: anchorParam(day), focus: null })}
        />
      ) : null}
      {window && gridView === 'month' ? (
        <MonthView
          window={window}
          month={startOfMonth(anchor)}
          selected={anchor}
          onSelect={setAnchor}
          now={now}
          focusId={focusId}
          onOpen={(lesson) => setDialog({ lesson, open: true })}
        />
      ) : null}
      {view === 'list' ? (
        <LessonList
          segment={segment}
          onSegmentChange={(next) => update({ segment: next })}
          now={now}
        />
      ) : null}
      <LessonActionsDialog
        lesson={dialog?.lesson ?? null}
        open={dialog?.open ?? false}
        now={now}
        onOpenChange={(open) => setDialog((current) => (current ? { ...current, open } : current))}
        onAction={runAction}
      />
    </div>
  )
}
