import { BookOpen, Plus } from 'lucide-react'
import { Link, Navigate } from 'react-router'
import type { RouteHandle } from '@/app/route-handle'
import { useMe } from '@/auth/session'
import { Button } from '@/components/ui/button'
import { IconBadge } from '../components/icon-badge'
import { PageTitle } from '../components/section'
import { EmptyState, ErrorState, SkeletonList } from '../components/states'
import { useTeacherCourses } from '../data/courses'
import { useT } from '../i18n/use-i18n'
import { teachCapabilities } from '../lib/capabilities'
import { useFormatters } from '../lib/use-formatters'
import { useTeachTitle } from '../lib/use-teach-title'
import { useTeachSheets } from '../sheets/use-teach-sheets'

export const handle: RouteHandle = { title: 'Courses' }

/**
 * The freelance teacher's active courses, a card each. An org teacher has no Courses tab (their
 * school's admin assigns the courses, D-053): the address sends them to Today.
 */
export function Component() {
  const { canManageCourses } = teachCapabilities(useMe())
  if (!canManageCourses) return <Navigate to="/teach" replace />
  return <CoursesList />
}

function CoursesList() {
  const t = useT()
  const fmt = useFormatters()
  const sheets = useTeachSheets()
  const courses = useTeacherCourses()
  useTeachTitle(t('teacher.courses.title'))

  return (
    <div className="flex flex-col gap-5">
      <PageTitle
        title={t('teacher.courses.title')}
        actions={
          <Button
            type="button"
            className="rounded-full"
            onClick={() => sheets.open({ kind: 'course' })}
          >
            <Plus aria-hidden />
            {t('teacher.courses.add')}
          </Button>
        }
      />
      {courses.isPending ? (
        <SkeletonList rows={4} />
      ) : courses.error && courses.courses.length === 0 ? (
        <ErrorState error={courses.error} onRetry={() => void courses.refetch()} />
      ) : courses.courses.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title={t('teacher.courses.empty')}
          hint={t('teacher.courses.emptyHint')}
          action={
            <Button
              type="button"
              className="rounded-full"
              onClick={() => sheets.open({ kind: 'course' })}
            >
              <Plus aria-hidden />
              {t('teacher.courses.add')}
            </Button>
          }
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {courses.courses.map((course) => (
            <li key={course.id} className="min-w-0">
              <Link
                to={`/teach/courses/${course.id}`}
                className="flex h-full flex-col gap-3 rounded-2xl border border-border bg-card p-4 transition-colors hover:border-primary/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                <div className="flex items-start gap-3">
                  <IconBadge icon={BookOpen} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-foreground">{course.title}</p>
                    {course.description?.trim() ? (
                      <p className="line-clamp-2 text-sm text-muted-foreground">
                        {course.description.trim()}
                      </p>
                    ) : null}
                  </div>
                </div>
                {course.defaultDurationMinutes ? (
                  <p className="text-xs text-muted-foreground">
                    {t('teacher.courseDetail.defaultLength', {
                      length: fmt.duration(course.defaultDurationMinutes),
                    })}
                  </p>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
