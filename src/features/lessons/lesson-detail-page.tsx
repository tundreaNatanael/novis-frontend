import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  BadgeCheck,
  CalendarClock,
  CircleDollarSign,
  ExternalLink,
  NotebookPen,
  Ticket,
  Trash2,
  CheckSquare,
} from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'
import { errorMessage } from '@/api/errors'
import { lessonKeys, lessonsApi } from '@/api/lessons'
import { studentKeys, studentsApi } from '@/api/students'
import type { LessonDetail } from '@/api/types'
import type { RouteHandle } from '@/app/route-handle'
import { PageSkeleton } from '@/app/shell/app-shell'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { ErrorState } from '@/components/data/error-state'
import { DetailHeader } from '@/components/detail/detail-header'
import {
  DetailField,
  DetailPanel,
  EntityValue,
  IdValue,
  TextValue,
  TimeValue,
} from '@/components/detail/detail-panel'
import { RowActions } from '@/components/row-actions'
import { Button } from '@/components/ui/button'
import { enumLabel, formatDateTime, shortId } from '@/lib/format'
import { lessonRules } from '@/lib/permissions'
import { usePageTitle } from '@/lib/use-page-title'
import { AddPrepaidSheet } from './components/add-prepaid-sheet'
import { CloseLessonSheet } from './components/close-lesson-sheet'
import { JournalSheet } from './components/journal-sheet'
import { LessonStatusBadge, PaidBadge } from './components/lesson-badges'
import { LessonCrumb } from './components/lesson-crumb'
import { ScheduleLessonSheet } from './components/schedule-lesson-sheet'
import { useLessonNames } from './hooks/use-lesson-names'

export const handle: RouteHandle = { crumb: (params) => <LessonCrumb lessonId={params.lessonId} /> }

/** `GET /lessons/{id}` with every field, the homework and materials, the student's balances and every supported action. */
export function Component() {
  const { lessonId = '' } = useParams<{ lessonId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [scheduling, setScheduling] = useState(false)
  const [closing, setClosing] = useState(false)
  const [editingJournal, setEditingJournal] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [addingPrepaid, setAddingPrepaid] = useState(false)

  const detailQuery = useQuery({
    queryKey: lessonKeys.detail(lessonId),
    queryFn: ({ signal }) => lessonsApi.get(lessonId, signal),
  })
  const lesson = detailQuery.data?.lesson
  const names = useLessonNames(lesson ? [lesson] : [])
  const summary = useQuery({
    queryKey: studentKeys.summary(lesson?.studentId ?? '', lesson?.teacherId ?? null),
    queryFn: ({ signal }) =>
      studentsApi.summary(lesson?.studentId ?? '', lesson?.teacherId ?? null, signal),
    enabled: !!lesson,
  })
  usePageTitle(
    lesson
      ? lesson.scheduledAt
        ? `Lesson · ${formatDateTime(lesson.scheduledAt)}`
        : 'Unscheduled lesson'
      : undefined,
  )

  const invalidate = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: lessonKeys.detail(lessonId) }),
      queryClient.invalidateQueries({ queryKey: lessonKeys.lists() }),
      queryClient.invalidateQueries({ queryKey: studentKeys.all }),
    ])

  /** The one optimistic update in the console: the paid / unpaid toggle. */
  const setPaid = useMutation({
    mutationFn: (paid: boolean) => lessonsApi.setPaid(lessonId, { paid }),
    onMutate: async (paid) => {
      await queryClient.cancelQueries({ queryKey: lessonKeys.detail(lessonId) })
      const previous = queryClient.getQueryData<LessonDetail>(lessonKeys.detail(lessonId))
      if (previous) {
        queryClient.setQueryData<LessonDetail>(lessonKeys.detail(lessonId), {
          ...previous,
          lesson: { ...previous.lesson, paid, paidAt: paid ? new Date().toISOString() : null },
        })
      }
      return { previous }
    },
    onError: (error, _paid, context) => {
      if (context?.previous) queryClient.setQueryData(lessonKeys.detail(lessonId), context.previous)
      toast.error(errorMessage(error))
    },
    onSuccess: (_lesson, paid) =>
      toast.success(paid ? 'Lesson marked paid' : 'Lesson marked unpaid'),
    onSettled: () => invalidate(),
  })
  const remove = useMutation({
    mutationFn: () => lessonsApi.remove(lessonId),
    onSuccess: async () => {
      await invalidate()
      toast.success('Lesson deleted')
      navigate('/platform/lessons')
    },
  })

  if (detailQuery.isPending) return <PageSkeleton />
  if (detailQuery.isError || !lesson)
    return <ErrorState error={detailQuery.error} onRetry={() => void detailQuery.refetch()} />
  const detail = detailQuery.data
  const teacher = names.teacher(lesson.teacherId)
  const student = names.student(lesson.studentId)
  const course = names.course(lesson.courseId)
  const organization = names.organization(lesson.organizationId)
  const orgBase = lesson.organizationId
    ? `/platform/orgs/${lesson.organizationId}`
    : `/platform/freelance/${lesson.teacherId}`
  const teacherHref = lesson.organizationId ? `${orgBase}/teachers/${lesson.teacherId}` : orgBase
  const studentHref = `${orgBase}/students/${lesson.studentId}`
  const courseHref = lesson.courseId ? `${orgBase}/courses/${lesson.courseId}` : null

  return (
    <div className="flex flex-col gap-5">
      <DetailHeader
        backTo="/platform/lessons"
        backLabel="Lessons"
        title={
          lesson.scheduledAt
            ? `Lesson on ${formatDateTime(lesson.scheduledAt)}`
            : 'Unscheduled lesson'
        }
        badge={
          <>
            <LessonStatusBadge lesson={lesson} />
            <PaidBadge lesson={lesson} />
          </>
        }
        meta={
          <>
            <span>
              {student?.name ?? shortId(lesson.studentId)} with{' '}
              {teacher?.name ?? shortId(lesson.teacherId)}
              {course ? ` · ${course.title}` : ''}
            </span>
            <IdValue value={lesson.id} />
          </>
        }
        actions={
          <>
            {lesson.meetingUrl ? (
              <Button asChild variant="outline">
                <a href={lesson.meetingUrl} target="_blank" rel="noreferrer">
                  <ExternalLink aria-hidden />
                  Join lesson
                </a>
              </Button>
            ) : null}
            <Button
              variant={lesson.paid ? 'outline' : 'default'}
              onClick={() => setPaid.mutate(!lesson.paid)}
              disabled={setPaid.isPending}
              aria-pressed={lesson.paid}
            >
              {lesson.paid ? <CircleDollarSign aria-hidden /> : <BadgeCheck aria-hidden />}
              {lesson.paid ? 'Mark unpaid' : 'Mark paid'}
            </Button>
            <RowActions
              label="More actions"
              actions={[
                {
                  label: lesson.scheduledAt ? 'Reschedule or unschedule' : 'Schedule',
                  icon: CalendarClock,
                  onSelect: () => setScheduling(true),
                  disabledReason: lessonRules.scheduleDisabledReason(lesson),
                },
                {
                  label: 'Close lesson',
                  icon: CheckSquare,
                  onSelect: () => setClosing(true),
                  disabledReason: lessonRules.closeDisabledReason(lesson),
                },
                {
                  label: 'Edit journal',
                  icon: NotebookPen,
                  onSelect: () => setEditingJournal(true),
                  disabledReason: lessonRules.journalDisabledReason(lesson),
                },
                {
                  label: 'Add prepaid lessons for this student',
                  icon: Ticket,
                  separatorBefore: true,
                  onSelect: () => setAddingPrepaid(true),
                },
                {
                  label: 'Delete lesson',
                  icon: Trash2,
                  destructive: true,
                  separatorBefore: true,
                  onSelect: () => setDeleting(true),
                  disabledReason: lessonRules.deleteDisabledReason(lesson),
                },
              ]}
            />
          </>
        }
      />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <DetailPanel title="Details" description="Every field the API returns for this lesson.">
          <DetailField label="Id">
            <IdValue value={lesson.id} />
          </DetailField>
          <DetailField
            label="Status"
            hint={
              lesson.status === 'PENDING'
                ? lesson.scheduledAt
                  ? 'Upcoming: pending with a date.'
                  : lesson.paid
                    ? 'A prepaid credit: paid, pending, no date yet.'
                    : 'Pending without a date.'
                : undefined
            }
          >
            <LessonStatusBadge lesson={lesson} />
          </DetailField>
          <DetailField label="Scheduled at">
            <TimeValue value={lesson.scheduledAt} />
          </DetailField>
          <DetailField label="Payment">
            <PaidBadge lesson={lesson} />
          </DetailField>
          <DetailField label="Paid at">
            <TimeValue value={lesson.paidAt} />
          </DetailField>
          <DetailField label="Teacher">
            <EntityValue
              to={teacherHref}
              label={teacher?.name ?? 'Teacher'}
              id={lesson.teacherId}
            />
          </DetailField>
          <DetailField label="Student">
            <EntityValue
              to={studentHref}
              label={student?.name ?? 'Student'}
              id={lesson.studentId}
            />
          </DetailField>
          <DetailField label="Course">
            {courseHref && lesson.courseId ? (
              <EntityValue to={courseHref} label={course?.title ?? 'Course'} id={lesson.courseId} />
            ) : (
              <span className="text-muted-foreground">No course</span>
            )}
          </DetailField>
          <DetailField label="Organization">
            {lesson.organizationId ? (
              <EntityValue
                to={orgBase}
                label={organization?.name ?? 'Organization'}
                id={lesson.organizationId}
              />
            ) : (
              <span className="text-muted-foreground">None (freelance lesson)</span>
            )}
          </DetailField>
          <DetailField label="Meeting link">
            {lesson.meetingUrl ? (
              <a
                href={lesson.meetingUrl}
                target="_blank"
                rel="noreferrer"
                className="break-all text-primary underline-offset-4 hover:underline"
              >
                {lesson.meetingUrl}
              </a>
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
          </DetailField>
          <DetailField
            label="Journal"
            hint={lesson.status === 'PENDING' ? 'Written when the lesson is closed.' : undefined}
          >
            <TextValue value={lesson.journal} />
          </DetailField>
          <DetailField label="Closed at">
            <TimeValue value={lesson.closedAt} />
          </DetailField>
          <DetailField
            label="Rolled over from"
            hint="Set when this lesson is the credit a paid cancellation produced."
          >
            {lesson.rolledOverFromLessonId ? (
              <EntityValue
                to={`/platform/lessons/${lesson.rolledOverFromLessonId}`}
                label="Canceled lesson"
                id={lesson.rolledOverFromLessonId}
              />
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
          </DetailField>
          <DetailField
            label="Rolled over to"
            hint="The credit this lesson's on-time cancellation produced."
          >
            {detail.rolledOverToLessonId ? (
              <EntityValue
                to={`/platform/lessons/${detail.rolledOverToLessonId}`}
                label="Prepaid credit"
                id={detail.rolledOverToLessonId}
              />
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
          </DetailField>
          <DetailField label="Created">
            <TimeValue value={lesson.createdAt} />
          </DetailField>
          <DetailField label="Updated">
            <TimeValue value={lesson.updatedAt} />
          </DetailField>
        </DetailPanel>
        <div className="flex flex-col gap-5">
          <DetailPanel
            title="Student balances"
            description="With this teacher."
            actions={
              <Button variant="outline" size="sm" onClick={() => setAddingPrepaid(true)}>
                <Ticket aria-hidden />
                Add prepaid
              </Button>
            }
          >
            {summary.isPending ? (
              <DetailField label="Loading">…</DetailField>
            ) : summary.isError ? (
              <DetailField label="Error">Could not load balances.</DetailField>
            ) : (
              <>
                <DetailField label="Prepaid left">
                  <span className="text-lg font-semibold tabular-nums">
                    {summary.data.prepaidRemaining}
                  </span>
                </DetailField>
                <DetailField label="Unpaid due">
                  <span className="text-lg font-semibold tabular-nums">
                    {summary.data.unpaidDue}
                  </span>
                </DetailField>
                <DetailField label="Upcoming unpaid">
                  <span className="text-lg font-semibold tabular-nums">
                    {summary.data.upcomingUnpaid}
                  </span>
                </DetailField>
                <DetailField label="All lessons">
                  <Link
                    to={`/platform/lessons?org=${lesson.organizationId ?? 'freelance'}&teacherId=${lesson.teacherId}&studentId=${lesson.studentId}`}
                    className="font-medium text-primary underline-offset-4 hover:underline"
                  >
                    Open the ledger for this student
                  </Link>
                </DetailField>
              </>
            )}
          </DetailPanel>
          <DetailPanel title="Homework" description="Handed out in this lesson.">
            {detail.homework.length === 0 ? (
              <DetailField label="None">No homework handed out in this lesson.</DetailField>
            ) : (
              detail.homework.map((hw) => (
                <DetailField key={hw.id} label="Homework">
                  {hw.notes ? <p className="mb-1 whitespace-pre-wrap">{hw.notes}</p> : null}
                  {hw.items.length > 0 ? (
                    <ul className="flex flex-col gap-1">
                      {hw.items.map((item) => (
                        <li key={item.id} className="flex items-start gap-2 text-sm">
                          <span
                            aria-hidden
                            className={item.done ? 'text-success' : 'text-muted-foreground'}
                          >
                            {item.done ? '☑' : '☐'}
                          </span>
                          <span className={item.done ? 'text-muted-foreground line-through' : ''}>
                            {item.text}
                            <span className="sr-only">{item.done ? ' (done)' : ' (open)'}</span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </DetailField>
              ))
            )}
          </DetailPanel>
          <DetailPanel title="Materials" description="Attached to this lesson.">
            {detail.materials.length === 0 ? (
              <DetailField label="None">No materials attached to this lesson.</DetailField>
            ) : (
              detail.materials.map((m) => (
                <DetailField key={m.id} label={enumLabel(m.type)}>
                  {m.externalUrl ? (
                    <a
                      href={m.externalUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary underline-offset-4 hover:underline"
                    >
                      {m.title}
                    </a>
                  ) : (
                    <span>
                      {m.title}{' '}
                      <span className="text-xs text-muted-foreground">
                        ({m.fileName ?? 'file'})
                      </span>
                    </span>
                  )}
                </DetailField>
              ))
            )}
          </DetailPanel>
        </div>
      </div>
      <ScheduleLessonSheet lesson={lesson} open={scheduling} onOpenChange={setScheduling} />
      <CloseLessonSheet lesson={lesson} open={closing} onOpenChange={setClosing} />
      <JournalSheet lesson={lesson} open={editingJournal} onOpenChange={setEditingJournal} />
      <AddPrepaidSheet
        studentId={lesson.studentId}
        studentName={student?.name ?? 'this student'}
        teacher={{ id: lesson.teacherId, name: teacher?.name }}
        open={addingPrepaid}
        onOpenChange={setAddingPrepaid}
      />
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title="Delete lesson"
        destructive
        confirmLabel="Delete lesson"
        description={
          <>
            <p>
              Removes this pending, unpaid lesson. Homework handed out in it is kept and unlinked;
              materials that also belong to a course are kept; lesson-only materials are removed.
            </p>
            <p>Closed or paid lessons are history and cannot be deleted.</p>
          </>
        }
        onConfirm={() => remove.mutateAsync()}
      />
    </div>
  )
}
