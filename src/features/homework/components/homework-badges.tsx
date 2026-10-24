import { AlertTriangle, CheckCircle2, Clock } from 'lucide-react'
import type { Homework } from '@/api/types'
import { StatusBadge } from '@/components/status-badge'
import { homeworkState, type HomeworkState } from '../homework-state'

const STATE: Record<
  HomeworkState,
  { label: string; tone: 'info' | 'success' | 'warning'; icon: typeof Clock }
> = {
  open: { label: 'Open', tone: 'info', icon: Clock },
  overdue: { label: 'Overdue', tone: 'warning', icon: AlertTriangle },
  done: { label: 'Done', tone: 'success', icon: CheckCircle2 },
}

/** Open / overdue / done with an icon; the API's status is in the tooltip. */
export function HomeworkStateBadge({
  homework,
}: {
  homework: Pick<Homework, 'completedAt' | 'dueAt'>
}) {
  const meta = STATE[homeworkState(homework)]
  return (
    <StatusBadge
      value={homework.completedAt ? 'DONE' : 'OPEN'}
      label={meta.label}
      tone={meta.tone}
      icon={meta.icon}
    />
  )
}
