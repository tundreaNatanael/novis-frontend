import {
  AlertTriangle,
  BadgeCheck,
  CheckCircle2,
  CircleDollarSign,
  Clock,
  Ticket,
  XCircle,
} from 'lucide-react'
import type { Lesson } from '@/api/types'
import { StatusBadge, ToneBadge } from '@/components/status-badge'
import { lessonRules, type LessonDisplayStatus } from '@/lib/permissions'

const STATUS: Record<
  LessonDisplayStatus,
  { label: string; tone: 'info' | 'neutral' | 'success' | 'warning'; icon: typeof Clock }
> = {
  upcoming: { label: 'Upcoming', tone: 'info', icon: Clock },
  credit: { label: 'Not scheduled', tone: 'neutral', icon: Ticket },
  held: { label: 'Held', tone: 'success', icon: CheckCircle2 },
  canceled: { label: 'Canceled', tone: 'neutral', icon: XCircle },
  canceled_late: { label: 'Canceled late (charged)', tone: 'warning', icon: AlertTriangle },
}

/** API.md §9.1 display mapping; the raw status stays in the tooltip. */
export function LessonStatusBadge({
  lesson,
}: {
  lesson: Pick<Lesson, 'status' | 'scheduledAt' | 'studentPayment'>
}) {
  const display = lessonRules.displayStatus(lesson)
  const meta = STATUS[display]
  const label = display === 'credit' && lesson.studentPayment?.paid ? 'Prepaid credit' : meta.label
  return <StatusBadge value={lesson.status} label={label} tone={meta.tone} icon={meta.icon} />
}

/**
 * Paid / unpaid, separate from the lifecycle. Unpaid charged lessons read as "due". Renders
 * nothing when the payment is not shown to the caller (`studentPayment: null`): never "unpaid".
 */
export function PaidBadge({ lesson }: { lesson: Pick<Lesson, 'status' | 'studentPayment'> }) {
  if (!lesson.studentPayment) return null
  if (lesson.studentPayment.paid) {
    return (
      <ToneBadge tone="success" icon={BadgeCheck}>
        Paid
      </ToneBadge>
    )
  }
  const due = lesson.status === 'PRESENT' || lesson.status === 'CANCELED_LATE'
  return (
    <ToneBadge tone={due ? 'danger' : 'neutral'} icon={CircleDollarSign}>
      {due ? 'Unpaid · due' : 'Unpaid'}
    </ToneBadge>
  )
}
