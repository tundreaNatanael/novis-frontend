import type { CalendarLesson } from '@/api/types'
import type { Translator } from '../i18n/types'
import type { Formatters } from '../lib/use-formatters'
import { lessonStatusMeta, lessonUiStatus } from '../lessons/utils'

/** "Piano with Ana, 17:00–18:00, held, paid to you": what a screen reader says for a lesson. */
export function lessonLabel(
  t: Translator,
  fmt: Formatters,
  lesson: CalendarLesson,
  now: Date,
): string {
  const time = fmt.timeRange(new Date(lesson.scheduledAt), lesson.durationMinutes)
  const status = t(lessonStatusMeta[lessonUiStatus(lesson, now)].labelKey).toLocaleLowerCase()
  const label = lesson.courseTitle
    ? t('teacher.calendar.lesson', {
        course: lesson.courseTitle,
        student: lesson.studentName,
        time,
        status,
      })
    : t('teacher.calendar.lessonNoCourse', { student: lesson.studentName, time, status })
  return lesson.paidOut ? `${label}, ${t('status.paidToYou').toLocaleLowerCase()}` : label
}
