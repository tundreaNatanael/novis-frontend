import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, CalendarCog, OctagonX, Repeat } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { errorMessage, isApiError } from '@/api/errors'
import { lessonKeys } from '@/api/lessons'
import { recurringLessonKeys, recurringLessonsApi } from '@/api/recurring-lessons'
import { studentKeys } from '@/api/students'
import type { RecurringConflict, RecurringLesson, RecurringLessonFilters } from '@/api/types'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { DetailField, DetailPanel } from '@/components/detail/detail-panel'
import { RowActions } from '@/components/row-actions'
import { Button } from '@/components/ui/button'
import { useLessonNames } from '@/features/lessons/hooks/use-lesson-names'
import { useLessonPaths } from '@/features/lessons/lesson-paths'
import { formatDate, formatDateTimeRange, pluralize, shortId } from '@/lib/format'
import {
  browserTimeZone,
  describeRule,
  nextOccurrenceOf,
  todayIn,
  zoneDiffers,
} from '../recurring-state'
import { EditWeeklyLessonSheet } from './edit-weekly-lesson-sheet'
import { SetupWeeklyLessonSheet } from './setup-weekly-lesson-sheet'

/** Active rules of one student, oldest first; one page is plenty for one student. */
const PARAMS = { page: 0, size: 50, sort: 'startsOn,asc' }

interface Props {
  studentId: string
  studentName: string
  /** Fixed teacher (the freelance workspace): the list and Set up are theirs. */
  teacher?: { id: string; name?: string }
  /** The organization whose teachers Set up offers (the org workspace). */
  organizationId?: string
}

/**
 * The student's **weekly lessons** (API.md §9.8): `GET /recurring-lessons?studentId=&status=ACTIVE`
 * — one row per rule ("Every Tuesday, 17:00–18:00 · Piano", the teacher, the next date) with
 * **Change from a date** and **Stop**, and under it the dates the daily run could not book, each
 * with **Book anyway** (`POST …/occurrences/{date}/book { allowOverlap: true }`) and **Skip**
 * (`POST …/skip`, after a confirmation: the date is dropped for good). **Set up weekly lesson**
 * opens the sheet (`POST /recurring-lessons`).
 */
export function WeeklyLessonsPanel({ studentId, studentName, teacher, organizationId }: Props) {
  const queryClient = useQueryClient()
  const paths = useLessonPaths()
  const browserZone = useMemo(() => browserTimeZone(), [])
  const [settingUp, setSettingUp] = useState(false)
  const [editing, setEditing] = useState<RecurringLesson | null>(null)
  const [stopping, setStopping] = useState<RecurringLesson | null>(null)
  const [skipping, setSkipping] = useState<{ rule: RecurringLesson; date: string } | null>(null)
  const filters: RecurringLessonFilters = {
    studentId,
    status: 'ACTIVE',
    ...(teacher ? { teacherId: teacher.id } : {}),
  }
  const query = useQuery({
    queryKey: recurringLessonKeys.list(filters, PARAMS),
    queryFn: ({ signal }) => recurringLessonsApi.list(filters, PARAMS, signal),
  })
  const rules = query.data?.content ?? []
  const names = useLessonNames(rules)

  const invalidate = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: recurringLessonKeys.all }),
      queryClient.invalidateQueries({ queryKey: lessonKeys.all }),
      queryClient.invalidateQueries({ queryKey: studentKeys.all }),
    ])
  const settle = (error: unknown) => {
    // The slot changed hands meanwhile (`409`), or the rule is gone (`404`): the list is stale.
    if (isApiError(error) && (error.isConflict || error.isNotFound)) void invalidate()
    toast.error(errorMessage(error))
  }
  const book = useMutation({
    mutationFn: ({ rule, date }: { rule: RecurringLesson; date: string }) =>
      recurringLessonsApi.bookOccurrence(rule.id, date, true),
    onSuccess: async () => {
      await invalidate()
      toast.success('Lesson booked')
    },
    onError: settle,
  })
  const skip = useMutation({
    mutationFn: ({ rule, date }: { rule: RecurringLesson; date: string }) =>
      recurringLessonsApi.skipOccurrence(rule.id, date),
    onSuccess: async () => {
      await invalidate()
      toast.success('Date skipped')
    },
  })
  const stop = useMutation({
    mutationFn: (rule: RecurringLesson) => recurringLessonsApi.end(rule.id),
    onSuccess: async () => {
      await invalidate()
      toast.success('Weekly lesson stopped')
    },
  })

  return (
    <div id="weekly-lessons" className="scroll-mt-20">
      <DetailPanel
        title="Weekly lessons"
        description={
          teacher
            ? 'A lesson every week or two with this teacher, booked ahead until it is stopped.'
            : 'A lesson every week or two with one of the organization’s teachers, booked ahead until it is stopped.'
        }
        actions={
          <Button variant="outline" size="sm" onClick={() => setSettingUp(true)}>
            <Repeat aria-hidden />
            Set up weekly lesson
          </Button>
        }
      >
        {query.isPending ? (
          <DetailField label="Loading">…</DetailField>
        ) : query.isError ? (
          <DetailField label="Error">
            Could not load the weekly lessons.{' '}
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0"
              onClick={() => void query.refetch()}
            >
              Try again
            </Button>
          </DetailField>
        ) : rules.length === 0 ? (
          <DetailField label="None">
            <span className="inline-flex items-center gap-1 text-muted-foreground">
              <Repeat className="size-3.5" aria-hidden /> No weekly lesson yet.
            </span>
          </DetailField>
        ) : (
          rules.map((rule) => {
            const next = nextOccurrenceOf(rule, todayIn(rule.timeZone))
            const course = names.course(rule.courseId)
            const teacherName = teacher
              ? null
              : (names.teacher(rule.teacherId)?.name ?? shortId(rule.teacherId))
            const meta = [
              teacherName ? `With ${teacherName}` : null,
              course?.title ?? (rule.courseId ? shortId(rule.courseId) : null),
              next ? `Next: ${formatDate(next)}` : 'No date left',
              zoneDiffers(rule, browserZone) ? `${rule.timeZone} time` : null,
            ].filter(Boolean)
            const conflicts = rule.conflicts ?? []
            return (
              <div key={rule.id} className="flex flex-col gap-2 px-4 py-3 text-sm">
                <dt className="flex items-start gap-2">
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="font-medium text-card-foreground">{describeRule(rule)}</span>
                    <span className="text-xs text-muted-foreground">{meta.join(' · ')}</span>
                  </span>
                  <RowActions
                    label={`Actions for ${describeRule(rule)}`}
                    actions={[
                      {
                        label: 'Change from a date',
                        icon: CalendarCog,
                        onSelect: () => setEditing(rule),
                      },
                      {
                        label: 'Stop weekly lesson',
                        icon: OctagonX,
                        destructive: true,
                        onSelect: () => setStopping(rule),
                      },
                    ]}
                  />
                </dt>
                {conflicts.length > 0 ? (
                  <dd className="flex flex-col gap-1.5">
                    <p className="inline-flex items-center gap-1 text-xs font-medium text-warning">
                      <AlertTriangle className="size-3.5" aria-hidden />
                      {pluralize(conflicts.length, 'date needs', 'dates need')} attention: the time
                      was taken when the daily run tried to book.
                    </p>
                    <ul className="flex flex-col gap-1">
                      {conflicts.map((conflict) => (
                        <ConflictRow
                          key={conflict.occurrenceOn}
                          rule={rule}
                          conflict={conflict}
                          lessonHref={
                            conflict.conflictWithLessonId
                              ? paths.detail(conflict.conflictWithLessonId)
                              : null
                          }
                          busy={book.isPending || skip.isPending}
                          onBook={() => book.mutate({ rule, date: conflict.occurrenceOn })}
                          onSkip={() => setSkipping({ rule, date: conflict.occurrenceOn })}
                        />
                      ))}
                    </ul>
                  </dd>
                ) : null}
              </div>
            )
          })
        )}
      </DetailPanel>
      <SetupWeeklyLessonSheet
        studentId={studentId}
        studentName={studentName}
        teacher={teacher}
        organizationId={organizationId}
        open={settingUp}
        onOpenChange={setSettingUp}
      />
      {editing ? (
        <EditWeeklyLessonSheet
          rule={editing}
          studentName={studentName}
          open
          onOpenChange={(open) => !open && setEditing(null)}
        />
      ) : null}
      {stopping ? (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && setStopping(null)}
          title="Stop weekly lesson"
          destructive
          confirmLabel="Stop weekly lesson"
          description={
            <>
              <p>
                Stops <strong>{describeRule(stopping)}</strong> for <strong>{studentName}</strong>{' '}
                after today. Today’s lesson stays.
              </p>
              <p>
                The lessons booked after today that still follow it are given back: a paid one
                returns to the student’s lessons to schedule as a credit, with its payment; an
                unpaid one with a material attached is unscheduled; an unpaid one without is
                deleted.
              </p>
              <p>Lessons that were held, canceled or changed by hand are kept as they are.</p>
            </>
          }
          onConfirm={async () => {
            await stop.mutateAsync(stopping)
            setStopping(null)
          }}
        />
      ) : null}
      {skipping ? (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && setSkipping(null)}
          title="Skip this date"
          confirmLabel="Skip the date"
          description={
            <>
              <p>
                No lesson will be booked on{' '}
                <strong>
                  {formatDateTimeRange(
                    skipping.rule.conflicts?.find((c) => c.occurrenceOn === skipping.date)
                      ?.scheduledAt,
                    skipping.rule.durationMinutes,
                  )}
                </strong>{' '}
                for this weekly lesson, even once the time frees up. The other dates are not
                touched.
              </p>
              <p>To hold the lesson at another time instead, book one from the Lessons tab.</p>
            </>
          }
          onConfirm={async () => {
            try {
              await skip.mutateAsync(skipping)
            } catch (error) {
              if (isApiError(error) && (error.isConflict || error.isNotFound)) void invalidate()
              throw error
            }
            setSkipping(null)
          }}
        />
      ) : null}
    </div>
  )
}

function ConflictRow({
  rule,
  conflict,
  lessonHref,
  busy,
  onBook,
  onSkip,
}: {
  rule: RecurringLesson
  conflict: RecurringConflict
  lessonHref: string | null
  busy: boolean
  onBook: () => void
  onSkip: () => void
}) {
  const when = formatDateTimeRange(conflict.scheduledAt, rule.durationMinutes)
  return (
    <li className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2">
      <span className="min-w-0 flex-1 text-sm tabular-nums">
        {when}
        {lessonHref ? (
          <>
            {' '}
            ·{' '}
            <Link
              to={lessonHref}
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Open the lesson in the way
            </Link>
          </>
        ) : null}
      </span>
      <Button
        variant="outline"
        size="sm"
        disabled={busy}
        onClick={onBook}
        aria-label={`Book anyway on ${when}`}
      >
        Book anyway
      </Button>
      <Button
        variant="ghost"
        size="sm"
        disabled={busy}
        onClick={onSkip}
        aria-label={`Skip ${when}`}
      >
        Skip
      </Button>
    </li>
  )
}
