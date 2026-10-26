import type { Course, UpdateCourseRequest } from '@/api/types'
import { optionalText } from '../lib/schemas'

/** What the course sheet holds. */
export interface CourseDraft {
  title: string
  description: string
  defaultMeetingUrl: string
  defaultDurationMinutes: string
}

/** A typed default lesson length (already validated): whole minutes, `undefined` when empty. */
export function lessonMinutes(value: string): number | undefined {
  const text = optionalText(value)
  return text ? Number(text) : undefined
}

/**
 * The `PATCH /courses/{id}` body of the edit sheet: the title, and the description, default
 * meeting link and default lesson length as typed (trimmed). One that had a value and was
 * emptied goes out as `null` (the API removes it); one that was and stays empty is left out, so a
 * save never removes a value added elsewhere meanwhile (D-043).
 */
export function courseUpdateBody(
  course: Pick<Course, 'description' | 'defaultMeetingUrl' | 'defaultDurationMinutes'> | undefined,
  draft: CourseDraft,
): UpdateCourseRequest {
  const body: UpdateCourseRequest = { title: draft.title.trim() }
  const description = optionalText(draft.description)
  if (description || course?.description) body.description = description ?? null
  const defaultMeetingUrl = optionalText(draft.defaultMeetingUrl)
  if (defaultMeetingUrl || course?.defaultMeetingUrl)
    body.defaultMeetingUrl = defaultMeetingUrl ?? null
  const minutes = lessonMinutes(draft.defaultDurationMinutes)
  const currentMinutes = course?.defaultDurationMinutes ?? null
  if (minutes !== undefined || currentMinutes !== null)
    body.defaultDurationMinutes = minutes ?? null
  return body
}
