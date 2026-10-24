import { AlertCircle, AlertTriangle, UserMinus } from 'lucide-react'
import { ToneBadge } from '@/components/status-badge'
import { LESSON_COUNTS, type LessonCountName } from '@/features/lessons/lesson-counts'
import { pluralize } from '@/lib/format'

const MISMATCHES = {
  usedPaidNotPaidOut: { tone: 'warning', icon: AlertCircle },
  paidOutNotPaidByStudent: { tone: 'danger', icon: AlertTriangle },
} as const

/**
 * A mismatch between what the student paid and what the teacher was paid out, as an icon and words,
 * never colour alone. `long` adds what the count is, for rows that have no column header (phones).
 * Nothing to flag reads "None" in a table and nothing at all in a long row.
 */
export function MismatchCount({
  kind,
  count,
  long = false,
}: {
  kind: keyof typeof MISMATCHES
  count: number
  long?: boolean
}) {
  if (count === 0) return long ? null : <span className="text-muted-foreground">None</span>
  const { tone, icon } = MISMATCHES[kind]
  return (
    <ToneBadge tone={tone} icon={icon}>
      {pluralize(count, 'lesson')}
      {long ? ` ${LESSON_COUNTS[kind].label.toLowerCase()}` : null}
    </ToneBadge>
  )
}

/** A teacher who left the organization and still has lessons there. */
export function FormerTeacherBadge() {
  return (
    <ToneBadge tone="neutral" icon={UserMinus}>
      Former teacher
    </ToneBadge>
  )
}

/** Counts as label–value pairs, for a phone row. */
export function CountList({ counts }: { counts: [LessonCountName, number][] }) {
  return (
    <dl className="mt-1 grid grid-cols-2 gap-x-4 gap-y-0.5 text-sm">
      {counts.map(([name, value]) => (
        <div key={name} className="flex justify-between gap-2">
          <dt className="text-muted-foreground">{LESSON_COUNTS[name].label}</dt>
          <dd className="font-medium text-foreground tabular-nums">{value}</dd>
        </div>
      ))}
    </dl>
  )
}
