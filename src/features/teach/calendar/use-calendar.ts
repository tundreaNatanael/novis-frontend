import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { lessonKeys, lessonsApi } from '@/api/lessons'
import { teacherApi, teacherKeys } from '@/api/teacher'
import type { CalendarLesson, LessonOutcome } from '@/api/types'
import { useInvalidateLessons } from '../data/mutations'
import { useT } from '../i18n/use-i18n'
import { toIsoWithOffset } from '../lib/dates'
import { describeError } from '../lib/error-message'
import { useTeachSheets } from '../sheets/use-teach-sheets'
import { withClosedLesson } from './actions'
import type { CalendarWindow } from './dates'

function boundsQuery(from: string, to: string) {
  return queryOptions({
    queryKey: teacherKeys.calendarWindow(from, to),
    queryFn: ({ signal }) => teacherApi.calendar({ from, to }, signal),
  })
}

/** One request per window: `GET /teacher/calendar` with its local-midnight bounds. */
export function calendarWindowQuery(window: CalendarWindow) {
  return boundsQuery(toIsoWithOffset(window.start), toIsoWithOffset(window.end))
}

export function useCalendarWindow(window: CalendarWindow) {
  return useQuery(calendarWindowQuery(window))
}

/** Loads the windows on either side of the visible one, so a step lands on lessons already there. */
export function usePrefetchCalendarWindows(windows: CalendarWindow[]) {
  const queryClient = useQueryClient()
  // The bounds as one string: the effect runs when they change, not for every new array.
  const bounds = windows
    .map((window) => `${toIsoWithOffset(window.start)} ${toIsoWithOffset(window.end)}`)
    .join('|')
  useEffect(() => {
    for (const pair of bounds.split('|')) {
      const [from, to] = pair.split(' ')
      if (from && to) void queryClient.prefetchQuery(boundsQuery(from, to))
    }
  }, [queryClient, bounds])
}

/** Every cached window, for an optimistic change to the lesson wherever it shows. */
export function cachedCalendarWindows(queryClient: QueryClient) {
  return queryClient.getQueriesData<CalendarLesson[]>({ queryKey: teacherKeys.calendar() })
}

/**
 * Closes a lesson from the calendar, without a journal: "Mark as held" in one click, or a
 * cancellation. The block changes at once in every cached window and changes back if the request
 * fails; then everything that shows lessons refreshes. Once the server confirms, a lesson marked
 * held offers its journal and homework in the toast.
 */
export function useCloseFromCalendar() {
  const queryClient = useQueryClient()
  const invalidate = useInvalidateLessons()
  const sheets = useTeachSheets()
  const t = useT()
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: LessonOutcome }) =>
      lessonsApi.close(id, { status }),
    onMutate: async ({ id, status }) => {
      await queryClient.cancelQueries({ queryKey: teacherKeys.calendar() })
      const previous = cachedCalendarWindows(queryClient)
      const closedAt = new Date().toISOString()
      queryClient.setQueriesData<CalendarLesson[]>({ queryKey: teacherKeys.calendar() }, (rows) =>
        rows ? withClosedLesson(rows, id, status, closedAt) : rows,
      )
      return { previous }
    },
    onError: (error, _variables, context) => {
      for (const [key, rows] of context?.previous ?? []) queryClient.setQueryData(key, rows)
      toast.error(describeError(error, t))
    },
    onSuccess: (detail, { status }) => {
      queryClient.setQueryData(lessonKeys.detail(detail.lesson.id), detail)
      const { id, studentId } = detail.lesson
      if (status === 'PRESENT') {
        toast.success(t('teacher.calendar.held'), {
          action: {
            label: t('teacher.calendar.addJournal'),
            onClick: () => sheets.open({ kind: 'journal', lessonId: id }),
          },
          cancel: {
            label: t('teacher.calendar.assignHomework'),
            onClick: () => sheets.open({ kind: 'homework', studentId, lessonId: id }),
          },
          duration: 8000,
        })
      } else if (status === 'CANCELED') {
        // Only a payment manager sees the credit a paid lesson's cancellation gave back.
        toast.success(
          detail.rolledOverToLessonId
            ? t('teacher.calendar.canceledCredit')
            : t('teacher.calendar.canceled'),
        )
      } else {
        toast.success(t('teacher.calendar.canceledLate'))
      }
    },
    onSettled: () => invalidate(),
  })
}

/** The current time, ticking on each new minute (the time line, the "to finish" flags). */
export function useMinuteClock(): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    let timer: number
    const tick = () => {
      setNow(new Date())
      timer = window.setTimeout(tick, 60_000 - (Date.now() % 60_000))
    }
    timer = window.setTimeout(tick, 60_000 - (Date.now() % 60_000))
    return () => window.clearTimeout(timer)
  }, [])
  return now
}
