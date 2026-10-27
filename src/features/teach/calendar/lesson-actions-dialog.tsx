import {
  AlertTriangle,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  NotebookPen,
  Phone,
  Repeat,
  Video,
  XCircle,
  type LucideIcon,
} from 'lucide-react'
import { useState } from 'react'
import type { CalendarLesson } from '@/api/types'
import { useMe } from '@/auth/session'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { TeachConfirmDialog } from '../components/confirm-dialog'
import { LessonStatusBadge, TeacherPayoutBadge } from '../components/lesson-badges'
import { TeachBadge } from '../components/teach-badge'
import { TONE_TEXT, type Tone } from '../components/tone'
import { useT } from '../i18n/use-i18n'
import { useFormatters } from '../lib/use-formatters'
import { teacherJoin } from '../lessons/utils'
import { lessonActions, type LessonAction } from './actions'

const ACTION_META: Record<LessonAction, { icon: LucideIcon; tone: Tone }> = {
  markHeld: { icon: CheckCircle2, tone: 'held' },
  canceledOnTime: { icon: XCircle, tone: 'canceled' },
  canceledLate: { icon: AlertTriangle, tone: 'late' },
  join: { icon: Video, tone: 'accent' },
  reschedule: { icon: CalendarClock, tone: 'accent' },
  open: { icon: BookOpen, tone: 'accent' },
}

/**
 * What a clicked lesson offers (rules in `lessonActions`): "Mark as held" once it has started,
 * the two cancellations (each asks once: neither can be undone), Join, Reschedule and Open lesson.
 */
export function LessonActionsDialog({
  lesson,
  open,
  now,
  onOpenChange,
  onAction,
}: {
  /** The last lesson clicked; it stays while the dialog fades out. */
  lesson: CalendarLesson | null
  open: boolean
  now: Date
  onOpenChange: (open: boolean) => void
  onAction: (action: LessonAction, lesson: CalendarLesson) => void
}) {
  const t = useT()
  const me = useMe()
  const fmt = useFormatters()
  const [confirming, setConfirming] = useState<'canceledOnTime' | 'canceledLate' | null>(null)
  if (!lesson) return null
  const when = fmt.whenShortRange(new Date(lesson.scheduledAt), lesson.durationMinutes)
  const charged = lesson.status === 'PRESENT' || lesson.status === 'CANCELED_LATE'
  const copy = confirming === 'canceledOnTime' ? 'cancelOnTime' : 'cancelLate'
  const joinKind = teacherJoin(lesson.meetingUrl, me.whatsappNumber)?.kind ?? 'link'
  const joinLabel =
    joinKind === 'openWhatsApp'
      ? t('lesson.openWhatsApp')
      : joinKind === 'whatsApp'
        ? t('lesson.joinWhatsApp')
        : t('teacher.calendar.actions.join')

  return (
    <>
      <Dialog open={open && confirming === null} onOpenChange={onOpenChange}>
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg">{lesson.studentName}</DialogTitle>
            <DialogDescription>
              {lesson.courseTitle ? `${lesson.courseTitle} · ${when}` : when}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap items-center gap-1.5">
            <LessonStatusBadge lesson={lesson} now={now} size="md" />
            {lesson.seriesId ? (
              <TeachBadge icon={Repeat} size="md">
                {t('lesson.inSeries')}
              </TeachBadge>
            ) : null}
            {charged ? (
              <TeachBadge icon={NotebookPen} size="md">
                {lesson.hasJournal
                  ? t('teacher.calendar.journalWritten')
                  : t('teacher.calendar.noJournal')}
              </TeachBadge>
            ) : null}
            <TeacherPayoutBadge paidOut={lesson.paidOut} size="md" />
          </div>
          <div className="flex flex-col overflow-hidden rounded-xl bg-muted/60">
            {lessonActions(lesson, now).map((action) => {
              const meta = ACTION_META[action]
              return (
                <button
                  key={action}
                  type="button"
                  onClick={() => {
                    if (action === 'canceledOnTime' || action === 'canceledLate')
                      setConfirming(action)
                    else onAction(action, lesson)
                  }}
                  className="flex min-h-12 items-center gap-3 border-t border-border px-4 py-2 text-left text-sm font-medium transition-colors first:border-t-0 hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  {action === 'join' && joinKind !== 'link' ? (
                    <Phone className={cn('size-5 shrink-0', TONE_TEXT[meta.tone])} aria-hidden />
                  ) : (
                    <meta.icon
                      className={cn('size-5 shrink-0', TONE_TEXT[meta.tone])}
                      aria-hidden
                    />
                  )}
                  {action === 'join' ? joinLabel : t(`teacher.calendar.actions.${action}`)}
                </button>
              )
            })}
          </div>
        </DialogContent>
      </Dialog>
      <TeachConfirmDialog
        open={confirming !== null}
        onOpenChange={(next) => {
          if (!next) setConfirming(null)
        }}
        title={t(`teacher.calendar.${copy}.title`)}
        body={<p>{t(`teacher.calendar.${copy}.body`)}</p>}
        confirmLabel={t(`teacher.calendar.${copy}.confirm`)}
        cancelLabel={t('teacher.calendar.keep')}
        destructive
        onConfirm={() => {
          if (confirming) onAction(confirming, lesson)
          setConfirming(null)
        }}
      />
    </>
  )
}
