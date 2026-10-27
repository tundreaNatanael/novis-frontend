import { format, parseISO } from 'date-fns'
import { Link } from 'react-router'
import type { Lesson } from '@/api/types'
import { Skeleton } from '@/components/ui/skeleton'
import { formatTimeRange, shortId } from '@/lib/format'
import type { LessonNames } from '../hooks/use-lesson-names'
import { useLessonPaths } from '../lesson-paths'
import { LessonStatusBadge, PaidBadge, WeeklyLessonBadge } from './lesson-badges'

interface LessonAgendaProps {
  lessons: Lesson[]
  names: LessonNames
  isLoading: boolean
}

/** The current page grouped by local day, undated lessons last; the stave rail marks the timeline. */
export function LessonAgenda({ lessons, names, isLoading }: LessonAgendaProps) {
  const paths = useLessonPaths()
  if (isLoading) {
    return (
      <div className="flex flex-col gap-3" role="status" aria-label="Loading lessons">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
      </div>
    )
  }
  const groups = new Map<string, Lesson[]>()
  for (const lesson of lessons) {
    const key = lesson.scheduledAt
      ? format(parseISO(lesson.scheduledAt), 'yyyy-MM-dd')
      : 'unscheduled'
    groups.set(key, [...(groups.get(key) ?? []), lesson])
  }
  const keys = [...groups.keys()].sort((a, b) =>
    a === 'unscheduled' ? 1 : b === 'unscheduled' ? -1 : a.localeCompare(b),
  )

  return (
    <div className="flex flex-col gap-6">
      {keys.map((key) => (
        <section key={key} aria-labelledby={`day-${key}`}>
          <h3 id={`day-${key}`} className="mb-2 text-sm font-semibold text-foreground">
            {key === 'unscheduled' ? 'Not scheduled' : format(parseISO(key), 'EEEE d MMMM yyyy')}
          </h3>
          <div className="flex gap-3">
            <div className="stave-rail shrink-0 rounded-sm" aria-hidden />
            <ol className="flex min-w-0 flex-1 flex-col gap-2">
              {groups.get(key)!.map((lesson) => {
                const student = names.student(lesson.studentId)
                const teacher = names.teacher(lesson.teacherId)
                const course = names.course(lesson.courseId)
                return (
                  <li key={lesson.id}>
                    <Link
                      to={paths.detail(lesson.id)}
                      className="flex min-h-14 flex-col gap-1 rounded-lg border border-border bg-card p-3 hover:border-primary/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none sm:flex-row sm:items-center sm:gap-4"
                    >
                      <span className="w-24 shrink-0 font-mono text-sm text-foreground tabular-nums">
                        {lesson.scheduledAt
                          ? formatTimeRange(lesson.scheduledAt, lesson.durationMinutes)
                          : '—'}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium text-card-foreground">
                          {student?.name ?? shortId(lesson.studentId)}{' '}
                          <span className="text-muted-foreground">with</span>{' '}
                          {teacher?.name ?? shortId(lesson.teacherId)}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {course?.title ??
                            (lesson.courseId ? shortId(lesson.courseId) : 'No course')}
                        </span>
                      </span>
                      <span className="flex shrink-0 flex-wrap items-center gap-1.5">
                        <LessonStatusBadge lesson={lesson} />
                        <WeeklyLessonBadge lesson={lesson} />
                        <PaidBadge lesson={lesson} />
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ol>
          </div>
        </section>
      ))}
    </div>
  )
}
