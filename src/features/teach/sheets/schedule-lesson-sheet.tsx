import { CalendarCheck, Loader2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { isApiError } from '@/api/errors'
import type { Lesson, ScheduleLessonRequest } from '@/api/types'
import { Field } from '@/components/form/field'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { TeachConfirmDialog } from '../components/confirm-dialog'
import { DateTimeField, Stepper } from '../components/form-controls'
import { ErrorState, SkeletonCard } from '../components/states'
import { TeachSheet } from '../components/teach-sheet'
import { useLesson } from '../data/lessons'
import { useScheduleLesson } from '../data/mutations'
import { useT } from '../i18n/use-i18n'
import { nextQuarterHour, toIsoWithOffset } from '../lib/dates'
import { describeError } from '../lib/error-message'
import { makeSchemas } from '../lib/schemas'
import { LESSON_LENGTH, scheduleBody } from '../lessons/utils'
import { OverlapDialog } from './overlap-dialog'

export function ScheduleLessonSheet({
  lessonId,
  open,
  onOpenChange,
}: {
  lessonId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = useT()
  const query = useLesson(lessonId)
  const lesson = query.data?.lesson
  if (!lesson) {
    return (
      <TeachSheet open={open} onOpenChange={onOpenChange} title={t('teacher.schedule.title')}>
        {query.isError ? (
          <ErrorState compact error={query.error} onRetry={() => void query.refetch()} />
        ) : (
          <SkeletonCard lines={2} />
        )}
      </TeachSheet>
    )
  }
  return <ScheduleForm key={lesson.id} lesson={lesson} open={open} onOpenChange={onOpenChange} />
}

/** Date, length and link of a pending lesson; a new slot that overlaps another lesson asks before moving it anyway. */
function ScheduleForm({
  lesson,
  open,
  onOpenChange,
}: {
  lesson: Lesson
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = useT()
  const schemas = useMemo(() => makeSchemas(t), [t])
  const schedule = useScheduleLesson()
  const [date, setDate] = useState(() =>
    lesson.scheduledAt ? new Date(lesson.scheduledAt) : nextQuarterHour(),
  )
  const [durationMinutes, setDurationMinutes] = useState(lesson.durationMinutes)
  const [meetingUrl, setMeetingUrl] = useState(lesson.meetingUrl ?? '')
  const [error, setError] = useState<string | undefined>()
  const [pending, setPending] = useState<ScheduleLessonRequest | null>(null)
  const [unscheduling, setUnscheduling] = useState(false)
  const title = lesson.scheduledAt
    ? t('teacher.schedule.title')
    : t('teacher.lessonDetail.schedule')

  const send = async (body: ScheduleLessonRequest) => {
    try {
      await schedule.mutateAsync({ id: lesson.id, body })
      toast.success(t('teacher.schedule.saved'))
      onOpenChange(false)
    } catch (e) {
      if (isApiError(e) && e.is('SCHEDULE_CONFLICT') && !body.allowOverlap) setPending(body)
      else toast.error(describeError(e, t))
    }
  }

  const save = () => {
    const url = schemas.optionalHttpsUrl.safeParse(meetingUrl)
    if (!url.success) {
      setError(url.error.issues[0]?.message)
      return
    }
    setError(undefined)
    void send(scheduleBody(lesson, toIsoWithOffset(date), url.data, durationMinutes))
  }

  return (
    <>
      <TeachSheet
        open={open}
        onOpenChange={onOpenChange}
        title={title}
        onSubmit={save}
        footer={
          <>
            {lesson.scheduledAt ? (
              <Button
                type="button"
                variant="destructive"
                className="rounded-full sm:mr-auto"
                onClick={() => setUnscheduling(true)}
                disabled={schedule.isPending}
              >
                {t('teacher.schedule.unschedule')}
              </Button>
            ) : null}
            <Button
              type="submit"
              size="lg"
              className="w-full rounded-full sm:w-auto"
              disabled={schedule.isPending}
            >
              {schedule.isPending ? (
                <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden />
              ) : (
                <CalendarCheck aria-hidden />
              )}
              {t('teacher.schedule.submit')}
            </Button>
          </>
        }
      >
        <DateTimeField
          label={t('teacher.schedule.when')}
          value={date}
          onChange={setDate}
          autoFocus
        />
        <Stepper
          label={t('teacher.schedule.duration')}
          value={durationMinutes}
          min={LESSON_LENGTH.min}
          max={LESSON_LENGTH.max}
          step={LESSON_LENGTH.step}
          onChange={setDurationMinutes}
        />
        <Field label={t('teacher.schedule.meetingLink')} error={error}>
          {(a11y) => (
            <Input
              {...a11y}
              type="url"
              inputMode="url"
              placeholder={t('lesson.meetingLinkPlaceholder')}
              value={meetingUrl}
              onChange={(event) => setMeetingUrl(event.target.value)}
            />
          )}
        </Field>
      </TeachSheet>
      <OverlapDialog
        open={pending !== null}
        onOpenChange={(next) => {
          if (!next) setPending(null)
        }}
        move={!!lesson.scheduledAt}
        onConfirm={async () => {
          if (!pending) return
          await schedule.mutateAsync({ id: lesson.id, body: { ...pending, allowOverlap: true } })
          toast.success(t('teacher.schedule.saved'))
          onOpenChange(false)
        }}
      />
      <TeachConfirmDialog
        open={unscheduling}
        onOpenChange={setUnscheduling}
        title={t('teacher.schedule.unscheduleConfirmTitle')}
        body={<p>{t('teacher.schedule.unscheduleConfirmBody')}</p>}
        confirmLabel={t('teacher.schedule.unschedule')}
        destructive
        onConfirm={async () => {
          await schedule.mutateAsync({ id: lesson.id, body: { scheduledAt: null } })
          toast.success(t('teacher.schedule.saved'))
          onOpenChange(false)
        }}
      />
    </>
  )
}
