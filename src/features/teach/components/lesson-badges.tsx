import {
  AlertTriangle,
  BadgeCheck,
  Banknote,
  CalendarOff,
  CheckCircle2,
  CircleAlert,
  Clock,
  Flag,
  Ticket,
  XCircle,
  type LucideIcon,
} from 'lucide-react'
import type { Lesson } from '@/api/types'
import { useT } from '../i18n/use-i18n'
import {
  lessonStatusMeta,
  lessonUiStatus,
  paymentBadge,
  type LessonUiStatus,
} from '../lessons/utils'
import { TeachBadge } from './teach-badge'

const STATUS_ICON: Record<LessonUiStatus, LucideIcon> = {
  upcoming: Clock,
  toFinish: Flag,
  unscheduled: CalendarOff,
  present: CheckCircle2,
  canceled: XCircle,
  canceledLate: AlertTriangle,
}

export function LessonStatusBadge({
  lesson,
  now,
  size = 'sm',
}: {
  lesson: Pick<Lesson, 'status' | 'scheduledAt'>
  now?: Date
  size?: 'sm' | 'md'
}) {
  const t = useT()
  const status = lessonUiStatus(lesson, now)
  const meta = lessonStatusMeta[status]
  return (
    <TeachBadge tone={meta.tone} icon={STATUS_ICON[status]} size={size}>
      {t(meta.labelKey)}
    </TeachBadge>
  )
}

/** Renders nothing without payment data (`studentPayment: null`): a hidden payment is never "unpaid". */
export function PaymentBadge({
  lesson,
  size = 'sm',
}: {
  lesson: Pick<Lesson, 'status' | 'studentPayment'>
  size?: 'sm' | 'md'
}) {
  const t = useT()
  const meta = paymentBadge(lesson)
  if (!meta) return null
  const icon = meta.tone === 'credits' ? Ticket : meta.tone === 'paid' ? BadgeCheck : CircleAlert
  return (
    <TeachBadge tone={meta.tone} icon={icon} size={size}>
      {t(meta.labelKey)}
    </TeachBadge>
  )
}

/**
 * "Paid to you": the school paid the teacher for this lesson (a teacher payout) — never the
 * student's payment. Renders nothing while no payout covers the lesson.
 */
export function TeacherPayoutBadge({
  paidOut,
  size = 'sm',
}: {
  paidOut: boolean
  size?: 'sm' | 'md'
}) {
  const t = useT()
  if (!paidOut) return null
  return (
    <TeachBadge tone="paid" icon={Banknote} size={size}>
      {t('status.paidToYou')}
    </TeachBadge>
  )
}
