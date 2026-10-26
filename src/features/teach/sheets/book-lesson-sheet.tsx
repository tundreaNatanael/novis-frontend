import { CalendarPlus, Loader2, Users } from 'lucide-react'
import { useId, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { isApiError } from '@/api/errors'
import type { CreateLessonRequest, CreateLessonSeriesRequest } from '@/api/types'
import { useMe } from '@/auth/session'
import { Field } from '@/components/form/field'
import { SelectField } from '@/components/form/select-field'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useDebouncedValue } from '@/lib/use-debounced-value'
import { DateTimeField, Segmented, Stepper, SwitchRow } from '../components/form-controls'
import { SeriesPreview } from '../components/series-preview'
import { EmptyState, SkeletonCard } from '../components/states'
import { TeachSheet } from '../components/teach-sheet'
import { useTeacherCourses } from '../data/courses'
import { useSeriesPlan } from '../data/lessons'
import { useBookLesson, useBookSeries } from '../data/mutations'
import { useFullRoster } from '../data/roster'
import { useT } from '../i18n/use-i18n'
import { teachCapabilities } from '../lib/capabilities'
import { browserTimeZone, nextQuarterHour, toIsoWithOffset } from '../lib/dates'
import { describeError, fieldErrorOf } from '../lib/error-message'
import { makeSchemas } from '../lib/schemas'
import { defaultLessonLength, LESSON_LENGTH, SERIES_COUNT, seriesBody } from '../lessons/utils'
import { OverlapDialog } from './overlap-dialog'
import { useTeachSheets } from './use-teach-sheets'

const NO_COURSE = '__none__'

export interface BookLessonSheetProps {
  studentId?: string
  courseId?: string
  /** ISO instant to start from, e.g. an empty slot of the calendar. */
  startAt?: string
  /** A series of this many dates (2–52), e.g. the student's lessons to schedule. */
  count?: number
  open: boolean
  onOpenChange: (open: boolean) => void
}

function initialDate(startAt: string | undefined): Date {
  const date = startAt ? new Date(startAt) : null
  return date && !Number.isNaN(date.getTime()) ? date : nextQuarterHour()
}

type Pending = { one: CreateLessonRequest } | { series: CreateLessonSeriesRequest }

/**
 * Books one lesson (`POST /lessons`) or a weekly series (`POST /lessons/series`). The length
 * follows the course's default until the teacher changes it; a series is previewed with a dry run
 * that marks the dates overlapping other lessons, and is sent with the browser's time zone. A
 * `409 SCHEDULE_CONFLICT` asks before booking anyway (`allowOverlap`, D-045).
 */
export function BookLessonSheet({
  studentId: initialStudentId,
  courseId: initialCourseId,
  startAt,
  count: initialCount,
  open,
  onOpenChange,
}: BookLessonSheetProps) {
  const t = useT()
  const me = useMe()
  const sheets = useTeachSheets()
  const { canManageStudentPayments } = teachCapabilities(me)
  const schemas = useMemo(() => makeSchemas(t), [t])
  const roster = useFullRoster()
  const courses = useTeacherCourses()
  const book = useBookLesson()
  const bookSeries = useBookSeries()
  const studentFieldId = useId()
  const courseFieldId = useId()

  const [studentId, setStudentId] = useState(initialStudentId ?? '')
  const [courseId, setCourseId] = useState(initialCourseId ?? NO_COURSE)
  const [scheduled, setScheduled] = useState(true)
  const [date, setDate] = useState(() => initialDate(startAt))
  const [length, setLength] = useState<number | null>(null)
  const [repeat, setRepeat] = useState(
    initialCount !== undefined && initialCount >= SERIES_COUNT.min,
  )
  const [intervalWeeks, setIntervalWeeks] = useState<1 | 2>(1)
  const [count, setCount] = useState(() =>
    Math.min(Math.max(initialCount ?? SERIES_COUNT.initial, SERIES_COUNT.min), SERIES_COUNT.max),
  )
  const [meetingUrl, setMeetingUrl] = useState('')
  const [usePrepaid, setUsePrepaid] = useState(true)
  const [errors, setErrors] = useState<{ meetingUrl?: string; student?: string }>({})
  const [pending, setPending] = useState<Pending | null>(null)

  const effectiveStudentId = studentId || roster.students[0]?.id || ''
  const selectedCourseId = courseId === NO_COURSE ? null : courseId
  // The length follows the course until the teacher changes it.
  const durationMinutes =
    length ?? defaultLessonLength(selectedCourseId ? courses.byId.get(selectedCourseId) : undefined)
  const series = scheduled && repeat
  const timeZone = useMemo(() => browserTimeZone(), [])

  const planBody = useMemo<CreateLessonSeriesRequest | null>(
    () =>
      series && effectiveStudentId
        ? seriesBody({
            studentId: effectiveStudentId,
            courseId: selectedCourseId,
            firstAt: date,
            timeZone,
            intervalWeeks,
            count,
            durationMinutes,
          })
        : null,
    [
      series,
      effectiveStudentId,
      selectedCourseId,
      date,
      timeZone,
      intervalWeeks,
      count,
      durationMinutes,
    ],
  )
  const plan = useSeriesPlan(useDebouncedValue(planBody, 300))

  const failed = (error: unknown) => {
    const link = fieldErrorOf(error, 'meetingUrl')
    if (link) setErrors({ meetingUrl: link })
    else toast.error(describeError(error, t))
  }

  const bookedOne = (paidWithCredit: boolean) => {
    toast.success(t('teacher.book.booked'))
    if (paidWithCredit && scheduled) {
      toast.info(t('teacher.book.creditUsedTitle'), {
        description: t('teacher.book.creditUsedBody'),
      })
    }
    onOpenChange(false)
  }

  const bookOne = async (body: CreateLessonRequest) => {
    try {
      const detail = await book.mutateAsync(body)
      bookedOne(!!detail.lesson.studentPayment?.paid)
    } catch (error) {
      if (isApiError(error) && error.is('SCHEDULE_CONFLICT') && !body.allowOverlap)
        setPending({ one: body })
      else failed(error)
    }
  }

  const bookAll = async (body: CreateLessonSeriesRequest) => {
    try {
      const booked = await bookSeries.mutateAsync(body)
      toast.success(t('teacher.book.seriesBooked', { count: booked.lessons.length }))
      onOpenChange(false)
    } catch (error) {
      if (isApiError(error) && error.is('SCHEDULE_CONFLICT') && !body.allowOverlap)
        setPending({ series: body })
      else failed(error)
    }
  }

  const submit = () => {
    const nextErrors: typeof errors = {}
    if (!effectiveStudentId) nextErrors.student = t('validation.required')
    const url = schemas.optionalHttpsUrl.safeParse(meetingUrl)
    if (!url.success) nextErrors.meetingUrl = url.error.issues[0]?.message
    setErrors(nextErrors)
    if (nextErrors.student || !url.success) return

    if (series) {
      void bookAll(
        seriesBody({
          studentId: effectiveStudentId,
          courseId: selectedCourseId,
          firstAt: date,
          timeZone,
          intervalWeeks,
          count,
          durationMinutes,
          meetingUrl: url.data,
        }),
      )
      return
    }
    const body: CreateLessonRequest = { studentId: effectiveStudentId, durationMinutes }
    // Skipping credits is a payment decision; without it the server still spends one by default.
    if (canManageStudentPayments) body.usePrepaid = usePrepaid
    if (selectedCourseId) body.courseId = selectedCourseId
    if (scheduled) body.scheduledAt = toIsoWithOffset(date)
    if (url.data.length > 0) body.meetingUrl = url.data
    void bookOne(body)
  }

  const confirmOverlap = async () => {
    if (!pending) return
    if ('one' in pending) {
      const detail = await book.mutateAsync({ ...pending.one, allowOverlap: true })
      bookedOne(!!detail.lesson.studentPayment?.paid)
    } else {
      const booked = await bookSeries.mutateAsync({ ...pending.series, allowOverlap: true })
      toast.success(t('teacher.book.seriesBooked', { count: booked.lessons.length }))
      onOpenChange(false)
    }
  }

  const loading = roster.isPending || courses.isPending
  const busy = book.isPending || bookSeries.isPending

  return (
    <>
      <TeachSheet
        open={open}
        onOpenChange={onOpenChange}
        title={t('teacher.book.title')}
        onSubmit={submit}
        footer={
          <Button
            type="submit"
            size="lg"
            className="w-full rounded-full sm:w-auto"
            disabled={loading || roster.students.length === 0 || busy}
          >
            {busy ? (
              <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden />
            ) : (
              <CalendarPlus aria-hidden />
            )}
            {series ? t('teacher.book.submitSeries', { count }) : t('teacher.book.submit')}
          </Button>
        }
      >
        {loading ? (
          <SkeletonCard lines={4} />
        ) : roster.students.length === 0 ? (
          <EmptyState
            compact
            icon={Users}
            title={t('teacher.book.noStudents')}
            action={
              <Button
                type="button"
                size="sm"
                className="rounded-full"
                onClick={() => sheets.open({ kind: 'student' })}
              >
                {t('teacher.students.add')}
              </Button>
            }
          />
        ) : (
          <>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={studentFieldId}>{t('teacher.book.student')}</Label>
              <SelectField
                id={studentFieldId}
                value={effectiveStudentId}
                onChange={setStudentId}
                placeholder={t('teacher.book.studentPlaceholder')}
                options={roster.students.map((s) => ({
                  value: s.id,
                  label: s.name,
                  description: s.email,
                }))}
                aria-invalid={errors.student ? true : undefined}
              />
              {errors.student ? (
                <p role="alert" className="text-xs font-medium text-destructive">
                  {errors.student}
                </p>
              ) : null}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={courseFieldId}>{t('teacher.book.course')}</Label>
              <SelectField
                id={courseFieldId}
                value={courseId}
                onChange={setCourseId}
                placeholder={t('teacher.book.noCourse')}
                options={[
                  { value: NO_COURSE, label: t('teacher.book.noCourse') },
                  ...courses.courses.map((c) => ({ value: c.id, label: c.title })),
                ]}
              />
            </div>
            <SwitchRow
              label={t('teacher.book.scheduled')}
              hint={t('teacher.book.scheduledHint')}
              checked={scheduled}
              onCheckedChange={setScheduled}
            />
            {scheduled ? (
              <DateTimeField label={t('teacher.book.when')} value={date} onChange={setDate} />
            ) : null}
            <Stepper
              label={t('teacher.book.duration')}
              value={durationMinutes}
              min={LESSON_LENGTH.min}
              max={LESSON_LENGTH.max}
              step={LESSON_LENGTH.step}
              onChange={setLength}
            />
            {scheduled ? (
              <SwitchRow
                label={t('teacher.book.repeat')}
                hint={t('teacher.book.repeatHint')}
                checked={repeat}
                onCheckedChange={setRepeat}
              />
            ) : null}
            {series ? (
              <>
                <Segmented<'1' | '2'>
                  label={t('teacher.book.repeat')}
                  options={[
                    { value: '1', label: t('teacher.book.weekly') },
                    { value: '2', label: t('teacher.book.everyTwoWeeks') },
                  ]}
                  value={String(intervalWeeks) as '1' | '2'}
                  onChange={(value) => setIntervalWeeks(value === '2' ? 2 : 1)}
                  className="w-full"
                />
                <Stepper
                  label={t('teacher.book.count')}
                  value={count}
                  min={SERIES_COUNT.min}
                  max={SERIES_COUNT.max}
                  onChange={setCount}
                />
                <SeriesPreview
                  plan={plan.data}
                  durationMinutes={durationMinutes}
                  isPending={plan.isPending || plan.isFetching}
                  error={plan.error}
                  onRetry={() => void plan.refetch()}
                />
                <p className="text-xs text-muted-foreground">{t('teacher.book.seriesHint')}</p>
              </>
            ) : null}
            <Field
              label={t('teacher.book.meetingLink')}
              hint={t('teacher.book.meetingLinkHint')}
              error={errors.meetingUrl}
            >
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
            {canManageStudentPayments && !series ? (
              <SwitchRow
                label={t('teacher.book.usePrepaid')}
                hint={t('teacher.book.usePrepaidHint')}
                checked={usePrepaid}
                onCheckedChange={setUsePrepaid}
                disabled={!scheduled}
              />
            ) : null}
          </>
        )}
      </TeachSheet>
      <OverlapDialog
        open={pending !== null}
        onOpenChange={(next) => {
          if (!next) setPending(null)
        }}
        series={pending !== null && 'series' in pending}
        onConfirm={confirmOverlap}
      />
    </>
  )
}
