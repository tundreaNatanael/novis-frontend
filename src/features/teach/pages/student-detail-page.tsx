import {
  ArrowLeft,
  BookOpen,
  CalendarDays,
  CalendarPlus,
  CircleAlert,
  ClipboardList,
  Clock,
  Loader2,
  Pencil,
  Repeat,
  Ticket,
  Trash2,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'
import type { RouteHandle } from '@/app/route-handle'
import { useMe } from '@/auth/session'
import { Button } from '@/components/ui/button'
import { TeachAvatar } from '../components/avatar'
import { TeachConfirmDialog } from '../components/confirm-dialog'
import { HomeworkBlock } from '../components/homework-block'
import { DayHeader, LessonRow } from '../components/lesson-row'
import { PageTitle, Section, TeachCard } from '../components/section'
import { EmptyState, ErrorState, SkeletonCard, SkeletonList } from '../components/states'
import { TONE_TEXT, type Tone } from '../components/tone'
import { useTeacherHomework } from '../data/homework'
import { useLessonLookups, useStudentSummary, useTeacherLessons } from '../data/lessons'
import { useDeleteHomework, useRemoveStudent } from '../data/mutations'
import { useStudent, useStudentEnrollments } from '../data/roster'
import { useT } from '../i18n/use-i18n'
import { teachCapabilities } from '../lib/capabilities'
import { dayKey } from '../lib/dates'
import { describeError } from '../lib/error-message'
import { useFormatters } from '../lib/use-formatters'
import { useTeachTitle } from '../lib/use-teach-title'
import { groupByDay, seriesFromToSchedule, teacherJoin } from '../lessons/utils'
import { useTeachSheets } from '../sheets/use-teach-sheets'
import { paymentCounts } from '../students/utils'

export const handle: RouteHandle = { title: 'Student' }

/**
 * A student with this teacher: the balances (a freelance teacher) or what is left to schedule, the
 * lessons to schedule with "Schedule all as a series", homework (assign, edit, delete), the dated
 * lessons by day, and rename / remove.
 */
export function Component() {
  const { studentId = '' } = useParams<{ studentId: string }>()
  const t = useT()
  const fmt = useFormatters()
  const me = useMe()
  const navigate = useNavigate()
  const sheets = useTeachSheets()
  const { canManageStudentPayments } = teachCapabilities(me)
  const { student, rosterStudent, isLoading, error, refetch } = useStudent(studentId)
  const summary = useStudentSummary(studentId)
  // Undated lessons are listed under "To schedule"; the Lessons list keeps the dated ones.
  const toSchedule = useTeacherLessons(
    { studentId, status: 'PENDING', unscheduled: true },
    'createdAt,asc',
  )
  const lessons = useTeacherLessons({ studentId, unscheduled: false }, 'scheduledAt,desc')
  const homework = useTeacherHomework({ studentId })
  const enrollments = useStudentEnrollments(studentId)
  const { courseTitle } = useLessonLookups()
  const remove = useRemoveStudent()
  const deleteHomework = useDeleteHomework()
  const [removing, setRemoving] = useState(false)
  const [deletingHomework, setDeletingHomework] = useState<string | null>(null)
  useTeachTitle(student?.name)

  const groups = useMemo(() => groupByDay(lessons.lessons, dayKey), [lessons.lessons])
  // "Schedule all as a series" needs every lesson to schedule (their courses decide it), so the
  // section loads the remaining pages itself; the heading, the rows and the series agree on the count.
  const { hasNextPage, isFetchingNextPage, fetchNextPage, error: toScheduleError } = toSchedule
  useEffect(() => {
    if (hasNextPage && !isFetchingNextPage && !toScheduleError) void fetchNextPage()
  }, [hasNextPage, isFetchingNextPage, toScheduleError, fetchNextPage])
  const seriesShortcut = seriesFromToSchedule(toSchedule.lessons, toSchedule.total)
  const balances = summary.data ?? rosterStudent
  const join = rosterStudent ? teacherJoin(rosterStudent.meetingUrl, me.whatsappNumber) : null
  // Only a payment manager (a freelance teacher) receives the payment counts; an org teacher
  // plans from what is left to schedule.
  const payments = balances ? paymentCounts(balances) : null
  const myCourses = (enrollments.data ?? []).filter(
    (e) => e.status === 'ACTIVE' && e.teacherId === me.id,
  )
  const homeworkToDelete = homework.homework.find((h) => h.id === deletingHomework) ?? null

  if (isLoading && !student) {
    return (
      <div className="flex flex-col gap-4">
        <SkeletonCard lines={2} />
        <SkeletonList rows={3} />
      </div>
    )
  }
  if (!student) {
    return error ? (
      <ErrorState error={error} onRetry={refetch} />
    ) : (
      <EmptyState
        icon={CircleAlert}
        tone="warning"
        title={t('errors.notFoundTitle')}
        hint={t('errors.notFound')}
      />
    )
  }

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <Link
        to="/teach/students"
        className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" aria-hidden />
        {t('teacher.students.title')}
      </Link>
      <PageTitle
        title={
          <span className="flex items-center gap-3">
            <TeachAvatar name={student.name} size="lg" />
            <span>{student.name}</span>
          </span>
        }
        subtitle={
          <>
            {student.email}
            {/* Your meeting link with this student (D-057), from the roster row; a WhatsApp call on
                your number opens WhatsApp (D-058). */}
            {join ? (
              <>
                {' · '}
                <a
                  href={join.url}
                  // The WhatsApp app opens from this tab; other links in a new one.
                  {...(join.kind === 'openWhatsApp' ? {} : { target: '_blank', rel: 'noreferrer' })}
                  className="text-accent-foreground underline-offset-4 hover:underline"
                >
                  {join.kind === 'openWhatsApp'
                    ? t('teacher.studentDetail.whatsappCall')
                    : join.kind === 'whatsApp'
                      ? t('teacher.studentDetail.whatsappLink')
                      : t('teacher.studentDetail.meetingLink')}
                </a>
              </>
            ) : null}
          </>
        }
        actions={
          <>
            <Button
              type="button"
              variant="outline"
              className="rounded-full"
              onClick={() => sheets.open({ kind: 'student', studentId })}
            >
              <Pencil aria-hidden />
              {t('teacher.studentDetail.edit')}
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="rounded-full"
              onClick={() => setRemoving(true)}
            >
              <Trash2 aria-hidden />
              {t('teacher.studentDetail.remove')}
            </Button>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(18rem,2fr)]">
        <div className="flex min-w-0 flex-col gap-6">
          {toSchedule.total > 0 || toSchedule.error ? (
            <Section
              title={t('teacher.studentDetail.toScheduleSection', { count: toSchedule.total })}
              action={
                seriesShortcut ? (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="rounded-full"
                    onClick={() =>
                      sheets.open({
                        kind: 'book',
                        studentId,
                        count: seriesShortcut.count,
                        ...(seriesShortcut.courseId ? { courseId: seriesShortcut.courseId } : {}),
                      })
                    }
                  >
                    <Repeat aria-hidden />
                    {t('teacher.studentDetail.scheduleAll')}
                  </Button>
                ) : null
              }
            >
              {toSchedule.error ? (
                <ErrorState
                  compact
                  error={toSchedule.error}
                  onRetry={() => void toSchedule.refetch()}
                />
              ) : (
                <div className="flex flex-col gap-2">
                  {toSchedule.lessons.map((lesson) => (
                    <LessonRow
                      key={lesson.id}
                      lesson={lesson}
                      studentName={student.name}
                      courseTitle={courseTitle(lesson.courseId)}
                      onSchedule={() => sheets.open({ kind: 'schedule', lessonId: lesson.id })}
                    />
                  ))}
                </div>
              )}
            </Section>
          ) : null}

          <Section title={t('teacher.studentDetail.lessons')}>
            {lessons.isPending ? (
              <SkeletonList rows={3} />
            ) : lessons.error ? (
              <ErrorState compact error={lessons.error} onRetry={() => void lessons.refetch()} />
            ) : groups.length === 0 ? (
              <EmptyState
                compact
                icon={CalendarDays}
                title={t('teacher.studentDetail.noLessons')}
              />
            ) : (
              <div className="flex flex-col gap-3">
                {groups.map((group) => (
                  <div key={group.key} className="flex flex-col gap-2">
                    <DayHeader date={group.date} />
                    {group.items.map((lesson) => (
                      <LessonRow
                        key={lesson.id}
                        lesson={lesson}
                        timeOnly
                        studentName={student.name}
                        courseTitle={courseTitle(lesson.courseId)}
                      />
                    ))}
                  </div>
                ))}
                {lessons.hasNextPage ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="w-fit self-center rounded-full"
                    disabled={lessons.isFetchingNextPage}
                    onClick={() => void lessons.fetchNextPage()}
                  >
                    {lessons.isFetchingNextPage ? (
                      <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden />
                    ) : null}
                    {t('common.loadMore')}
                  </Button>
                ) : null}
              </div>
            )}
          </Section>
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          <Section
            title={
              payments ? t('teacher.studentDetail.summary') : t('teacher.studentDetail.overview')
            }
          >
            {!balances ? (
              <SkeletonCard lines={2} />
            ) : (
              <TeachCard className="grid grid-cols-2 gap-4">
                {payments ? (
                  <>
                    <Stat
                      icon={Ticket}
                      tone="credits"
                      value={String(payments.prepaidRemaining)}
                      label={t('teacher.studentDetail.prepaidRemaining')}
                    />
                    <Stat
                      icon={CircleAlert}
                      tone={payments.unpaidDue > 0 ? 'unpaid' : 'neutral'}
                      value={String(payments.unpaidDue)}
                      label={t('teacher.studentDetail.unpaidDue')}
                    />
                    <Stat
                      icon={Clock}
                      tone="upcoming"
                      value={String(payments.upcomingUnpaid)}
                      label={t('teacher.studentDetail.upcomingUnpaid')}
                    />
                  </>
                ) : (
                  <Stat
                    icon={CalendarDays}
                    tone="neutral"
                    value={String(balances.toSchedule)}
                    label={t('teacher.studentDetail.toSchedule')}
                  />
                )}
                <Stat
                  icon={CalendarDays}
                  tone="upcoming"
                  value={
                    balances.nextLesson?.scheduledAt
                      ? fmt.whenShort(new Date(balances.nextLesson.scheduledAt))
                      : t('common.none')
                  }
                  label={t('teacher.studentDetail.nextLesson')}
                  small
                />
              </TeachCard>
            )}
          </Section>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              className="rounded-full"
              onClick={() => sheets.open({ kind: 'book', studentId })}
            >
              <CalendarPlus aria-hidden />
              {t('teacher.studentDetail.bookLesson')}
            </Button>
            {canManageStudentPayments ? (
              <Button
                type="button"
                variant="secondary"
                className="rounded-full"
                onClick={() => sheets.open({ kind: 'prepaid', studentId })}
              >
                <Ticket aria-hidden />
                {t('teacher.studentDetail.addPrepaid')}
              </Button>
            ) : null}
          </div>

          <Section title={t('teacher.studentDetail.courses')}>
            {enrollments.isPending ? (
              <SkeletonCard lines={1} />
            ) : myCourses.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t('teacher.studentDetail.noCourses')}
              </p>
            ) : (
              <ul className="flex flex-wrap gap-2">
                {myCourses.map((enrollment) => (
                  <li key={enrollment.id}>
                    <Link
                      to={`/teach/courses/${enrollment.courseId}`}
                      className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border bg-card px-3 text-sm font-medium hover:bg-muted"
                    >
                      <BookOpen className="size-3.5 text-accent-foreground" aria-hidden />
                      {enrollment.courseTitle}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section
            title={t('teacher.studentDetail.homework')}
            action={
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="rounded-full"
                onClick={() => sheets.open({ kind: 'homework', studentId })}
              >
                <ClipboardList aria-hidden />
                {t('teacher.studentDetail.assignHomework')}
              </Button>
            }
          >
            {homework.isPending ? (
              <SkeletonList rows={2} />
            ) : homework.error ? (
              <ErrorState compact error={homework.error} onRetry={() => void homework.refetch()} />
            ) : homework.homework.length === 0 ? (
              <EmptyState
                compact
                icon={ClipboardList}
                title={t('teacher.studentDetail.noHomework')}
              />
            ) : (
              <div className="flex flex-col gap-2">
                {homework.homework.map((h) => (
                  <HomeworkBlock
                    key={h.id}
                    homework={h}
                    showLesson
                    onEdit={() => sheets.open({ kind: 'homework-edit', homeworkId: h.id })}
                    onDelete={() => setDeletingHomework(h.id)}
                  />
                ))}
                {homework.hasNextPage ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="w-fit"
                    disabled={homework.isFetchingNextPage}
                    onClick={() => void homework.fetchNextPage()}
                  >
                    {t('common.loadMore')}
                  </Button>
                ) : null}
              </div>
            )}
          </Section>
        </div>
      </div>

      <TeachConfirmDialog
        open={removing}
        onOpenChange={setRemoving}
        title={t('teacher.studentDetail.removeConfirmTitle', { name: student.name })}
        body={<p>{t('teacher.studentDetail.removeConfirmBody')}</p>}
        confirmLabel={t('common.remove')}
        destructive
        onConfirm={async () => {
          await remove.mutateAsync(studentId)
          toast.success(t('teacher.studentDetail.removed'))
          navigate('/teach/students')
        }}
      />
      <TeachConfirmDialog
        open={homeworkToDelete !== null}
        onOpenChange={(next) => {
          if (!next) setDeletingHomework(null)
        }}
        title={t('teacher.homework.deleteConfirmTitle')}
        body={
          <p>
            {t('teacher.homework.deleteConfirmBody', {
              title: homeworkToDelete?.title ?? t('homework.title'),
              name: homeworkToDelete?.studentName ?? student.name,
            })}
          </p>
        }
        confirmLabel={t('common.delete')}
        destructive
        onConfirm={async () => {
          if (!homeworkToDelete) return
          try {
            await deleteHomework.mutateAsync(homeworkToDelete.id)
            toast.success(t('teacher.homework.deleted'))
          } catch (error) {
            toast.error(describeError(error, t))
            throw error
          }
        }}
      />
    </div>
  )
}

function Stat({
  icon: Icon,
  tone,
  value,
  label,
  small,
}: {
  icon: LucideIcon
  tone: Tone
  value: string
  label: string
  small?: boolean
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className={`size-3.5 ${TONE_TEXT[tone]}`} aria-hidden />
        <span className="truncate">{label}</span>
      </div>
      <p
        className={
          small
            ? 'truncate text-base font-semibold tabular-nums'
            : 'text-2xl font-semibold tabular-nums'
        }
      >
        {value}
      </p>
    </div>
  )
}
