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
import type { LessonDetail, StudentPayment } from '@/api/types'
import type { RouteHandle } from '@/app/route-handle'
import { PageSkeleton } from '@/app/shell/app-shell'
import { useMe } from '@/auth/session'
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
import { HomeworkPanel } from '@/features/homework/components/homework-panel'
import {
  enumLabel,
  formatDate,
  formatDateTime,
  formatDateTimeRange,
  formatDuration,
  formatTimeRange,
  shortId,
} from '@/lib/format'
import { deriveCapabilities, lessonRules } from '@/lib/permissions'
import { usePageTitle } from '@/lib/use-page-title'
import { AddPrepaidSheet } from './components/add-prepaid-sheet'
import { BalanceFields } from './components/balance-fields'
import { CloseLessonSheet } from './components/close-lesson-sheet'
import { JournalSheet } from './components/journal-sheet'
import {
  LessonStatusBadge,
  PaidBadge,
  TeacherPayoutBadge,
  WeeklyLessonBadge,
} from './components/lesson-badges'
import { LessonCrumb } from './components/lesson-crumb'
import { OpenMaterialButton } from './components/open-material-button'
import { ScheduleLessonSheet } from './components/schedule-lesson-sheet'
import { useLessonNames } from './hooks/use-lesson-names'
import { useLessonPaths } from './lesson-paths'

export const handle: RouteHandle = { crumb: (params) => <LessonCrumb lessonId={params.lessonId} /> }

/**
 * `GET /lessons/{id}` with every field and the materials (an uploaded file opens in a new tab), the
 * homework that refers to the lesson (`GET /homework?lessonId=`, with Assign, Edit and Delete), the
 * student's balances and every supported action. Mounted at `/platform/lessons/:lessonId` for the super-admin and at
 * `/org/:orgId/lessons/:lessonId` for an org admin (D-040).
 */
export function Component() {
  const { lessonId = '' } = useParams<{ lessonId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const me = useMe()
  const paths = useLessonPaths()
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
        ? `Lesson · ${formatDateTimeRange(lesson.scheduledAt, lesson.durationMinutes)}`
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
          lesson: { ...previous.lesson, studentPayment: expectedPayment(paid, me.id) },
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
      navigate(paths.ledger)
    },
  })

  if (detailQuery.isPending) return <PageSkeleton />
  if (detailQuery.isError || !lesson)
    return <ErrorState error={detailQuery.error} onRetry={() => void detailQuery.refetch()} />
  const detail = detailQuery.data
  const payment = lesson.studentPayment
  const { canManageStudentPayments, canManageHomework } = deriveCapabilities(
    me,
    lesson.organizationId,
  )
  const teacher = names.teacher(lesson.teacherId)
  const student = names.student(lesson.studentId)
  const course = names.course(lesson.courseId)
  const organization = names.organization(lesson.organizationId)
  const orgBase = paths.workspace(lesson)
  const teacherHref = lesson.organizationId ? `${orgBase}/teachers/${lesson.teacherId}` : orgBase
  const studentHref = `${orgBase}/students/${lesson.studentId}`
  const courseHref = lesson.courseId ? `${orgBase}/courses/${lesson.courseId}` : null

  return (
    <div className="flex flex-col gap-5">
      <DetailHeader
        backTo={paths.ledger}
        backLabel="Lessons"
        title={
          lesson.scheduledAt
            ? `Lesson on ${formatDateTimeRange(lesson.scheduledAt, lesson.durationMinutes)}`
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
            {canManageStudentPayments && payment ? (
              <Button
                variant={payment.paid ? 'outline' : 'default'}
                onClick={() => setPaid.mutate(!payment.paid)}
                disabled={setPaid.isPending}
                aria-pressed={payment.paid}
              >
                {payment.paid ? <CircleDollarSign aria-hidden /> : <BadgeCheck aria-hidden />}
                {payment.paid ? 'Mark unpaid' : 'Mark paid'}
              </Button>
            ) : null}
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
                ...(canManageStudentPayments
                  ? [
                      {
                        label: 'Add prepaid lessons for this student',
                        icon: Ticket,
                        separatorBefore: true,
                        onSelect: () => setAddingPrepaid(true),
                      },
                    ]
                  : []),
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
                  : payment?.paid
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
          <DetailField label="Length">
            {formatDuration(lesson.durationMinutes)}
            {lesson.scheduledAt ? (
              <span className="text-muted-foreground tabular-nums">
                {' '}
                · {formatTimeRange(lesson.scheduledAt, lesson.durationMinutes)}
              </span>
            ) : null}
          </DetailField>
          {lesson.seriesId ? (
            <DetailField
              label="Series"
              hint="Booked together with other lessons of a weekly series."
            >
              <IdValue value={lesson.seriesId} />
            </DetailField>
          ) : null}
          {lesson.recurringLessonId ? (
            <DetailField
              label="Weekly lesson"
              hint={
                lesson.followsRule
                  ? 'Still follows its weekly lesson: a change of the weekly lesson from a date moves it.'
                  : 'Changed by hand: changes of the weekly lesson leave this lesson alone.'
              }
            >
              <span className="flex flex-wrap items-center gap-2">
                <WeeklyLessonBadge lesson={lesson} />
                {lesson.occurrenceOn ? (
                  <span>The date of {formatDate(lesson.occurrenceOn)}</span>
                ) : null}
                <Link
                  to={`${paths.workspace(lesson)}/students/${lesson.studentId}#weekly-lessons`}
                  className="font-medium text-primary underline-offset-4 hover:underline"
                >
                  Open the student’s weekly lessons
                </Link>
              </span>
            </DetailField>
          ) : null}
          {payment ? (
            <>
              <DetailField label="Payment">
                <PaidBadge lesson={lesson} />
              </DetailField>
              <DetailField label="Paid at">
                <TimeValue value={payment.paidAt} />
              </DetailField>
            </>
          ) : null}
          {lesson.organizationId ? (
            <DetailField
              label="Teacher payout"
              hint="What the organization paid the teacher for this lesson — not the student’s payment."
            >
              {lesson.teacherPayout ? (
                <TeacherPayoutBadge lesson={lesson} />
              ) : lesson.status === 'PRESENT' || lesson.status === 'CANCELED_LATE' ? (
                'Not paid out yet'
              ) : (
                <span className="text-muted-foreground">
                  Only held and late-canceled lessons are paid out
                </span>
              )}
            </DetailField>
          ) : null}
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
                to={paths.detail(lesson.rolledOverFromLessonId)}
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
                to={paths.detail(detail.rolledOverToLessonId)}
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
              canManageStudentPayments ? (
                <Button variant="outline" size="sm" onClick={() => setAddingPrepaid(true)}>
                  <Ticket aria-hidden />
                  Add prepaid
                </Button>
              ) : null
            }
          >
            {summary.isPending ? (
              <DetailField label="Loading">…</DetailField>
            ) : summary.isError ? (
              <DetailField label="Error">Could not load balances.</DetailField>
            ) : (
              <>
                <BalanceFields summary={summary.data} />
                <DetailField label="All lessons">
                  <Link
                    to={paths.ledgerOf(lesson)}
                    className="font-medium text-primary underline-offset-4 hover:underline"
                  >
                    Open the ledger for this student
                  </Link>
                </DetailField>
              </>
            )}
          </DetailPanel>
          <HomeworkPanel
            description="Assigned for this lesson, open first."
            filters={{ lessonId }}
            emptyText="No homework for this lesson yet."
            manage={
              canManageHomework
                ? {
                    studentId: lesson.studentId,
                    studentName: student?.name ?? 'this student',
                    teacher: { id: lesson.teacherId, name: teacher?.name },
                    lesson: {
                      id: lesson.id,
                      label: lesson.scheduledAt
                        ? formatDateTime(lesson.scheduledAt)
                        : 'no date yet',
                      courseId: lesson.courseId,
                    },
                  }
                : undefined
            }
          />
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
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span>
                        {m.title}{' '}
                        <span className="text-xs text-muted-foreground">
                          ({m.fileName ?? 'file'})
                        </span>
                      </span>
                      <OpenMaterialButton material={m} />
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
      {canManageStudentPayments ? (
        <AddPrepaidSheet
          studentId={lesson.studentId}
          studentName={student?.name ?? 'this student'}
          teacher={{ id: lesson.teacherId, name: teacher?.name }}
          open={addingPrepaid}
          onOpenChange={setAddingPrepaid}
        />
      ) : null}
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title="Delete lesson"
        destructive
        confirmLabel="Delete lesson"
        description={
          <>
            <p>
              Removes this pending, unpaid lesson. Homework for it is kept, without the link to the
              lesson; materials that also belong to a course are kept; lesson-only materials are
              removed.
            </p>
            <p>Closed or paid lessons are history and cannot be deleted.</p>
          </>
        }
        onConfirm={() => remove.mutateAsync()}
      />
    </div>
  )
}

/** The payment the server is about to answer with, shown optimistically (rolled back on error). */
function expectedPayment(paid: boolean, recorderId: string): StudentPayment {
  return paid
    ? { paid: true, paidAt: new Date().toISOString(), recordedById: recorderId }
    : { paid: false, paidAt: null, recordedById: null }
}
