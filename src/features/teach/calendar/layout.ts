import type { CalendarLesson } from '@/api/types'
import type { Tone } from '../components/tone'
import { dayKey, differenceInCalendarDays, minutesIntoDay } from '../lib/dates'
import type { CalendarWindow } from './dates'

export const DAY_MINUTES = 24 * 60

type Timed = { id: string; scheduledAt: string; durationMinutes: number }

/**
 * A lesson placed in its day's column. `top` and `height` are minutes from local midnight; `lane`
 * of `lanes` is its place among the lessons it overlaps.
 */
export type PlacedLesson<T> = {
  lesson: T
  top: number
  height: number
  lane: number
  lanes: number
}

/**
 * Places one day's lessons on the time grid. The top is the local wall-clock start, so a
 * daylight-saving day keeps its hours where the clock says; the height is the length, cut at
 * midnight. Lessons that overlap — directly or through a chain — share their width side by side:
 * each takes the first lane free when it starts, so back-to-back lessons (one ends as the next
 * starts) do not overlap.
 */
export function placeLessons<T extends Timed>(lessons: T[]): PlacedLesson<T>[] {
  const items = lessons
    .map((lesson) => {
      const top = minutesIntoDay(new Date(lesson.scheduledAt))
      return { lesson, top, end: Math.min(top + lesson.durationMinutes, DAY_MINUTES) }
    })
    .sort((a, b) => a.top - b.top || b.end - a.end || a.lesson.id.localeCompare(b.lesson.id))

  const placed: PlacedLesson<T>[] = []
  let group: { item: (typeof items)[number]; lane: number }[] = []
  let laneEnds: number[] = []
  let groupEnd = -1
  const closeGroup = () => {
    for (const { item, lane } of group) {
      placed.push({
        lesson: item.lesson,
        top: item.top,
        height: item.end - item.top,
        lane,
        lanes: laneEnds.length,
      })
    }
    group = []
    laneEnds = []
    groupEnd = -1
  }

  for (const item of items) {
    if (group.length > 0 && item.top >= groupEnd) closeGroup()
    let lane = laneEnds.findIndex((end) => end <= item.top)
    if (lane === -1) {
      lane = laneEnds.length
      laneEnds.push(item.end)
    } else {
      laneEnds[lane] = item.end
    }
    group.push({ item, lane })
    groupEnd = Math.max(groupEnd, item.end)
  }
  closeGroup()
  return placed
}

/** A window's lessons per local day (index 0 = its first day), each day in start order. */
export function lessonsByDay<T extends { scheduledAt: string }>(
  lessons: T[],
  window: CalendarWindow,
): T[][] {
  const days = differenceInCalendarDays(window.end, window.start)
  const buckets: T[][] = Array.from({ length: days }, () => [])
  for (const lesson of lessons) {
    const index = differenceInCalendarDays(new Date(lesson.scheduledAt), window.start)
    if (index >= 0 && index < days) buckets[index]!.push(lesson)
  }
  for (const bucket of buckets) {
    bucket.sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())
  }
  return buckets
}

/** Minutes into the day at height `y` of a column (inside the day). */
export function minutesAt(y: number, hourHeight: number): number {
  return Math.min(Math.max((y / hourHeight) * 60, 0), DAY_MINUTES - 1)
}

/**
 * Where a click on an empty part of a day's column starts a lesson: that day at those minutes,
 * snapped down to the half hour. A time the clock skips (the spring-forward hour) moves on to the
 * same minute of the next hour.
 */
export function slotStart(day: Date, minutes: number, snap = 30): Date {
  const snapped = Math.floor(minutes / snap) * snap
  return new Date(
    day.getFullYear(),
    day.getMonth(),
    day.getDate(),
    Math.floor(snapped / 60),
    snapped % 60,
  )
}

/** A pending lesson that has started and still waits for its outcome: the "to finish" flag. */
export function isToFinish(
  lesson: Pick<CalendarLesson, 'status' | 'scheduledAt'>,
  now: Date,
): boolean {
  return lesson.status === 'PENDING' && new Date(lesson.scheduledAt).getTime() < now.getTime()
}

/** A block's colour: upcoming indigo, held green, canceled grey, canceled late orange. */
export function blockTone(lesson: Pick<CalendarLesson, 'status'>): Tone {
  switch (lesson.status) {
    case 'PRESENT':
      return 'held'
    case 'CANCELED':
      return 'canceled'
    case 'CANCELED_LATE':
      return 'late'
    default:
      return 'upcoming'
  }
}

/** A month cell's dot: how many lessons the day holds, and whether one is left to finish. */
export type DayMark = { count: number; toFinish: boolean }

export function dayMarks(
  lessons: Pick<CalendarLesson, 'status' | 'scheduledAt'>[],
  now: Date,
): Map<string, DayMark> {
  const marks = new Map<string, DayMark>()
  for (const lesson of lessons) {
    const key = dayKey(new Date(lesson.scheduledAt))
    const mark = marks.get(key) ?? { count: 0, toFinish: false }
    marks.set(key, { count: mark.count + 1, toFinish: mark.toFinish || isToFinish(lesson, now) })
  }
  return marks
}
