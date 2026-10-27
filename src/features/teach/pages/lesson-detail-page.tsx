import {
  ArrowLeft,
  BadgeCheck,
  CalendarClock,
  Check,
  CircleAlert,
  ClipboardList,
  Library,
  NotebookPen,
  Paperclip,
  Phone,
  Ticket,
  Trash2,
  Video,
} from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'
import type { Material } from '@/api/types'
import type { RouteHandle } from '@/app/route-handle'
import { useMe } from '@/auth/session'
import { Button } from '@/components/ui/button'
import { TeachAvatar } from '../components/avatar'
import { TeachConfirmDialog } from '../components/confirm-dialog'
import { HomeworkBlock } from '../components/homework-block'
import { JournalBlock } from '../components/journal-block'
import { LessonStatusBadge, PaymentBadge, TeacherPayoutBadge } from '../components/lesson-badges'
import { ListRow, RowList } from '../components/list-row'
import { MaterialRow } from '../components/material-row'
import { Section, TeachCard } from '../components/section'
import { EmptyState, ErrorState, SkeletonCard } from '../components/states'
import { useTeacherHomework } from '../data/homework'
import { useLesson, useLessonLookups } from '../data/lessons'
import {
  useDeleteHomework,
  useDeleteLesson,
  useRemoveMaterial,
  useUpdatePayment,
} from '../data/mutations'
import { useT } from '../i18n/use-i18n'
import { teachCapabilities } from '../lib/capabilities'
import { parseLocalDate } from '../lib/dates'
import { describeError } from '../lib/error-message'
import { openApp, openInNewTab } from '../lib/open-url'
import { useFormatters } from '../lib/use-formatters'
import { useTeachTitle } from '../lib/use-teach-title'
import { canClose, canDelete, canEditJournal, isCharged, teacherJoin } from '../lessons/utils'
import { useOpenMaterial } from '../materials/use-open-material'
import { useTeachSheets } from '../sheets/use-teach-sheets'

export const handle: RouteHandle = { title: 'Lesson' }

/**
 * One lesson: when and with whom, its badges, every action (finish, reschedule, mark paid for a
 * freelance teacher, the journal, materials, homework, delete), then the journal, the homework
 * that refers to it and its materials.
 */
export function Component() {
  const { lessonId = '' } = useParams<{ lessonId: string }>()
  const t = useT()
  const fmt = useFormatters()
  const me = useMe()
  const navigate = useNavigate()
  const sheets = useTeachSheets()
  const { canManageStudentPayments } = teachCapabilities(me)
  const query = useLesson(lessonId)
  const lessonHomework = useTeacherHomework({ lessonId })
  const { studentName, courseTitle } = useLessonLookups()
  const payment = useUpdatePayment()
  const remove = useDeleteLesson()
  const removeMaterial = useRemoveMaterial()
  const deleteHomework = useDeleteHomework()
  const { open, openingId } = useOpenMaterial()
  const [deleting, setDeleting] = useState(false)
  const [removingMaterial, setRemovingMaterial] = useState<Material | null>(null)
  const [deletingHomework, setDeletingHomework] = useState<string | null>(null)
  const lesson = query.data?.lesson
  const date = lesson?.scheduledAt ? new Date(lesson.scheduledAt) : null
  useTeachTitle(
    lesson
      ? date
        ? fmt.weekdayTimeRange(date, lesson.durationMinutes)
        : t('status.unscheduled')
      : undefined,
  )

  if (query.isPending) {
    return (
      <div className="flex flex-col gap-4">
        <SkeletonCard lines={3} />
        <SkeletonCard lines={2} />
      </div>
    )
  }
  if (query.isError || !lesson) {
    return <ErrorState error={query.error} onRetry={() => void query.refetch()} />
  }
  const detail = query.data
  const name = studentName(lesson.studentId)
  const course = courseTitle(lesson.courseId)
  const pendingScheduled = lesson.status === 'PENDING' && lesson.scheduledAt !== null
  // A WhatsApp call on your own number opens the WhatsApp app, not a chat with yourself (D-058).
  const join = teacherJoin(lesson.meetingUrl, me.whatsappNumber)
  const studentPayment = lesson.studentPayment
  // Recording a payment is an action (the capability); showing one follows the data.
  const paymentToggle = canManageStudentPayments ? studentPayment : null
  // The school paying the teacher for the lesson (a teacher payout) — never the student's payment.
  const teacherPaidOn = lesson.teacherPayout ? parseLocalDate(lesson.teacherPayout.paidOn) : null
  const homeworkToDelete = lessonHomework.homework.find((h) => h.id === deletingHomework) ?? null

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <Link
        to="/teach/calendar"
        className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" aria-hidden />
        {t('teacher.lessonDetail.backToCalendar')}
      </Link>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(18rem,2fr)]">
        <div className="flex min-w-0 flex-col gap-6">
          <TeachCard className="flex flex-col gap-4 p-5">
            <div className="flex flex-wrap items-center gap-1.5">
              <LessonStatusBadge lesson={lesson} size="md" />
              <PaymentBadge lesson={lesson} size="md" />
              <TeacherPayoutBadge paidOut={lesson.teacherPayout !== null} size="md" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground tabular-nums md:text-3xl">
                {date
                  ? fmt.weekdayTimeRange(date, lesson.durationMinutes)
                  : t('status.unscheduled')}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {date ? fmt.longDate(date) : t('teacher.lessonDetail.notScheduled')}
                {` · ${fmt.duration(lesson.durationMinutes)}`}
                {course ? ` · ${course}` : ''}
              </p>
            </div>
            <ListRow
              to={`/teach/students/${lesson.studentId}`}
              title={name ?? t('common.student')}
              subtitle={t('teacher.lessonDetail.student')}
              leading={<TeachAvatar name={name ?? '?'} />}
              className="-mx-4 rounded-xl"
            />
            {pendingScheduled && join ? (
              <Button
                type="button"
                size="lg"
                className="w-full rounded-full bg-held text-primary-foreground hover:bg-held/90"
                onClick={() => {
                  const opened =
                    join.kind === 'openWhatsApp' ? openApp(join.url) : openInNewTab(join.url)
                  if (!opened) toast.error(t('lesson.joinFailed'))
                }}
              >
                {join.kind === 'link' ? <Video aria-hidden /> : <Phone aria-hidden />}
                {join.kind === 'openWhatsApp'
                  ? t('lesson.openWhatsApp')
                  : join.kind === 'whatsApp'
                    ? t('lesson.joinWhatsApp')
                    : t('lesson.join')}
              </Button>
            ) : null}
          </TeachCard>

          <div className="flex flex-wrap gap-2">
            {canClose(lesson) ? (
              <Button
                type="button"
                className="rounded-full"
                onClick={() => sheets.open({ kind: 'finish', lessonId })}
              >
                <Check aria-hidden />
                {t('teacher.lessonDetail.finish')}
              </Button>
            ) : null}
            {lesson.status === 'PENDING' ? (
              <Button
                type="button"
                variant="secondary"
                className="rounded-full"
                onClick={() => sheets.open({ kind: 'schedule', lessonId })}
              >
                <CalendarClock aria-hidden />
                {pendingScheduled
                  ? t('teacher.lessonDetail.reschedule')
                  : t('teacher.lessonDetail.schedule')}
              </Button>
            ) : null}
            {paymentToggle ? (
              <Button
                type="button"
                variant={paymentToggle.paid ? 'outline' : 'secondary'}
                className="rounded-full"
                disabled={payment.isPending}
                aria-pressed={paymentToggle.paid}
                onClick={() =>
                  payment.mutate(
                    { id: lessonId, paid: !paymentToggle.paid },
                    {
                      onSuccess: (_lesson, { paid }) =>
                        toast.success(
                          paid
                            ? t('teacher.lessonDetail.markedPaid')
                            : t('teacher.lessonDetail.markedUnpaid'),
                        ),
                      onError: (error) => toast.error(describeError(error, t)),
                    },
                  )
                }
              >
                {paymentToggle.paid ? <CircleAlert aria-hidden /> : <BadgeCheck aria-hidden />}
                {paymentToggle.paid
                  ? t('teacher.lessonDetail.markUnpaid')
                  : t('teacher.lessonDetail.markPaid')}
              </Button>
            ) : null}
            {canEditJournal(lesson) ? (
              <Button
                type="button"
                variant="outline"
                className="rounded-full"
                onClick={() => sheets.open({ kind: 'journal', lessonId })}
              >
                <NotebookPen aria-hidden />
                {t('teacher.lessonDetail.editJournal')}
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              className="rounded-full"
              onClick={() => sheets.open({ kind: 'material', lessonId })}
            >
              <Paperclip aria-hidden />
              {t('teacher.lessonDetail.attachMaterial')}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="rounded-full"
              onClick={() =>
                sheets.open({ kind: 'homework', studentId: lesson.studentId, lessonId })
              }
            >
              <ClipboardList aria-hidden />
              {t('teacher.lessonDetail.assignHomework')}
            </Button>
          </div>

          {lesson.rolledOverFromLessonId || detail.rolledOverToLessonId ? (
            <TeachCard className="flex items-center gap-2 bg-credits-soft text-sm">
              <Ticket className="size-4 shrink-0 text-credits" aria-hidden />
              <span>
                {detail.rolledOverToLessonId
                  ? t('lesson.creditReturned')
                  : t('lesson.creditFromCancellation')}
              </span>
            </TeachCard>
          ) : null}

          {isCharged(lesson) ? <JournalBlock journal={lesson.journal} /> : null}

          {lessonHomework.homework.length > 0 ? (
            <Section title={t('lesson.homework')}>
              <div className="flex flex-col gap-2">
                {lessonHomework.homework.map((h) => (
                  <HomeworkBlock
                    key={h.id}
                    homework={h}
                    onEdit={() => sheets.open({ kind: 'homework-edit', homeworkId: h.id })}
                    onDelete={() => setDeletingHomework(h.id)}
                  />
                ))}
              </div>
            </Section>
          ) : null}
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          <Section title={t('lesson.materials')}>
            {detail.materials.length === 0 ? (
              <EmptyState compact icon={Library} title={t('lesson.noMaterials')} />
            ) : (
              <TeachCard padded={false}>
                <RowList>
                  {detail.materials.map((material) => (
                    <MaterialRow
                      key={material.id}
                      material={material}
                      opening={openingId === material.id}
                      onOpen={() => void open(material)}
                      onRemove={() => setRemovingMaterial(material)}
                    />
                  ))}
                </RowList>
              </TeachCard>
            )}
          </Section>

          <TeachCard className="flex flex-col gap-1.5 text-xs text-muted-foreground">
            {studentPayment?.paidAt ? (
              <p>
                {t('teacher.lessonDetail.paidOn', {
                  date: fmt.dateTime(new Date(studentPayment.paidAt)),
                })}
              </p>
            ) : null}
            {lesson.closedAt ? (
              <p>
                {t('lesson.closedOn')} {fmt.dateTime(new Date(lesson.closedAt))}
              </p>
            ) : null}
            {teacherPaidOn ? (
              <p>{t('teacher.lessonDetail.paidToYouOn', { date: fmt.longDate(teacherPaidOn) })}</p>
            ) : null}
            {join ? (
              <p className="truncate">
                {t('lesson.meetingLink')}:{' '}
                <a
                  href={join.url}
                  // The WhatsApp app opens from this tab; other links in a new one.
                  {...(join.kind === 'openWhatsApp' ? {} : { target: '_blank', rel: 'noreferrer' })}
                  className="text-accent-foreground underline-offset-4 hover:underline"
                >
                  {/* Not the chat with yourself: a WhatsApp call on your number (D-058). */}
                  {join.kind === 'openWhatsApp'
                    ? t('teacher.studentDetail.whatsappCall')
                    : join.url}
                </a>
              </p>
            ) : null}
            {!studentPayment?.paidAt && !lesson.closedAt && !join ? (
              <p>{t('lesson.joinMissing')}</p>
            ) : null}
          </TeachCard>

          {canDelete(lesson) ? (
            <Button
              type="button"
              variant="destructive"
              className="w-fit rounded-full"
              onClick={() => setDeleting(true)}
            >
              <Trash2 aria-hidden />
              {t('teacher.lessonDetail.delete')}
            </Button>
          ) : null}
        </div>
      </div>

      <TeachConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={t('teacher.lessonDetail.deleteConfirmTitle')}
        body={<p>{t('teacher.lessonDetail.deleteConfirmBody')}</p>}
        confirmLabel={t('common.delete')}
        destructive
        onConfirm={async () => {
          await remove.mutateAsync(lessonId)
          toast.success(t('teacher.lessonDetail.deleted'))
          navigate('/teach/calendar')
        }}
      />
      <TeachConfirmDialog
        open={removingMaterial !== null}
        onOpenChange={(next) => {
          if (!next) setRemovingMaterial(null)
        }}
        title={t('teacher.material.removeConfirmTitle')}
        body={<p>{t('teacher.material.removeConfirmBody')}</p>}
        confirmLabel={t('common.remove')}
        destructive
        onConfirm={async () => {
          if (!removingMaterial) return
          await removeMaterial.mutateAsync(removingMaterial)
          toast.success(t('teacher.material.removed'))
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
              name: homeworkToDelete?.studentName ?? name ?? t('common.student'),
            })}
          </p>
        }
        confirmLabel={t('common.delete')}
        destructive
        onConfirm={async () => {
          if (!homeworkToDelete) return
          await deleteHomework.mutateAsync(homeworkToDelete.id)
          toast.success(t('teacher.homework.deleted'))
        }}
      />
    </div>
  )
}
