import type { LessonSegment } from '../lessons/utils'
import { anchorParam } from './dates'

/** Where a dated lesson shows in the calendar: its day, scrolled to it and marked for a moment. */
export function calendarLinkTo(lesson: { id: string; scheduledAt: string | null }): string {
  if (!lesson.scheduledAt) return '/teach/calendar'
  return `/teach/calendar?view=day&date=${anchorParam(new Date(lesson.scheduledAt))}&focus=${lesson.id}`
}

/** The calendar's List on one segment (Today's "See all"). */
export function calendarListLink(segment: LessonSegment): string {
  return `/teach/calendar?view=list&segment=${segment}`
}
