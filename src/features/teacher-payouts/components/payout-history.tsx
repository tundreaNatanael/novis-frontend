import { useQuery } from '@tanstack/react-query'
import { Ban, ListChecks } from 'lucide-react'
import { useId, useState } from 'react'
import { teacherPayoutKeys, teacherPayoutsApi } from '@/api/teacher-payouts'
import type { TeacherPayout, TeacherPayoutFilters } from '@/api/types'
import { Pagination } from '@/components/data/pagination'
import { RowActions } from '@/components/row-actions'
import { ToneBadge } from '@/components/status-badge'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { enumLabel, formatDate, formatDateTimeRange, pluralize } from '@/lib/format'
import { HISTORY_PAGE_SIZE, lessonLabel } from '../payout-state'
import { VoidPayoutDialog } from './void-payout-dialog'

interface Props {
  orgId: string
  teacherId: string
}

/**
 * `GET /orgs/{orgId}/teacher-payouts?teacherId=`: the teacher's payouts, latest first, voided ones
 * on request. Each row opens its lessons (`GET /teacher-payouts/{id}`) and can be voided.
 */
export function PayoutHistory({ orgId, teacherId }: Props) {
  const switchId = useId()
  const [includeVoided, setIncludeVoided] = useState(false)
  const [page, setPage] = useState(0)
  const [opened, setOpened] = useState<string | null>(null)
  const [voiding, setVoiding] = useState<TeacherPayout | null>(null)
  const filters: TeacherPayoutFilters = { teacherId, includeVoided }
  const params = { page, size: HISTORY_PAGE_SIZE, sort: ['paidOn,desc', 'createdAt,desc'] }
  const query = useQuery({
    queryKey: teacherPayoutKeys.list(orgId, filters, params),
    queryFn: ({ signal }) => teacherPayoutsApi.list(orgId, filters, params, signal),
  })

  return (
    <div className="flex flex-col gap-3 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-card-foreground">History</h3>
        <div className="flex items-center gap-2">
          <Switch
            id={switchId}
            checked={includeVoided}
            onCheckedChange={(checked) => {
              setIncludeVoided(checked)
              setPage(0)
            }}
          />
          <Label htmlFor={switchId} className="text-sm font-normal">
            Show voided
          </Label>
        </div>
      </div>
      {query.isPending ? (
        <p className="text-sm text-muted-foreground">Loading payouts…</p>
      ) : query.isError ? (
        <p role="alert" className="text-sm text-destructive">
          Could not load the payouts.
        </p>
      ) : query.data.content.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {includeVoided ? 'No payouts recorded yet.' : 'No live payouts.'}
        </p>
      ) : (
        <>
          <ul className="flex flex-col divide-y divide-border rounded-md border border-border">
            {query.data.content.map((payout) => (
              <PayoutRow
                key={payout.id}
                payout={payout}
                opened={opened === payout.id}
                onToggle={() => setOpened((current) => (current === payout.id ? null : payout.id))}
                onVoid={() => setVoiding(payout)}
              />
            ))}
          </ul>
          {query.data.totalPages > 1 ? (
            <Pagination
              page={page}
              size={HISTORY_PAGE_SIZE}
              total={query.data.totalElements}
              onPageChange={setPage}
            />
          ) : null}
        </>
      )}
      {voiding ? (
        <VoidPayoutDialog
          payout={voiding}
          open
          onOpenChange={(open) => {
            if (!open) setVoiding(null)
          }}
        />
      ) : null}
    </div>
  )
}

function PayoutRow({
  payout,
  opened,
  onToggle,
  onVoid,
}: {
  payout: TeacherPayout
  opened: boolean
  onToggle: () => void
  onVoid: () => void
}) {
  const title = `${formatDate(payout.paidOn)} · ${pluralize(payout.lessonCount, 'lesson')}`
  return (
    <li className="flex flex-col gap-1.5 px-3 py-2.5 text-sm">
      <div className="flex items-start gap-2">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <p className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-card-foreground tabular-nums">{title}</span>
            {payout.voidedAt ? (
              <ToneBadge tone="neutral" icon={Ban}>
                Voided
              </ToneBadge>
            ) : null}
          </p>
          {payout.note ? <p className="whitespace-pre-wrap break-words">{payout.note}</p> : null}
          <p className="text-xs text-muted-foreground">
            Recorded by {payout.recordedByName} on {formatDate(payout.createdAt)}
            {payout.voidedAt
              ? ` · voided by ${payout.voidedByName ?? 'an admin'} on ${formatDate(payout.voidedAt)}: ${payout.voidReason ?? ''}`
              : ''}
          </p>
        </div>
        <RowActions
          label={`Actions for the payout of ${title}`}
          actions={[
            {
              label: opened ? 'Hide lessons' : 'View lessons',
              icon: ListChecks,
              onSelect: onToggle,
              disabledReason: payout.voidedAt
                ? 'A voided payout no longer lists its lessons; they were freed.'
                : null,
            },
            {
              label: 'Void payout',
              icon: Ban,
              destructive: true,
              separatorBefore: true,
              onSelect: onVoid,
              disabledReason: payout.voidedAt ? 'This payout is already voided.' : null,
            },
          ]}
        />
      </div>
      {opened && !payout.voidedAt ? <PayoutLessons payoutId={payout.id} /> : null}
    </li>
  )
}

/** The lessons a live payout covers, by date. */
function PayoutLessons({ payoutId }: { payoutId: string }) {
  const query = useQuery({
    queryKey: teacherPayoutKeys.detail(payoutId),
    queryFn: ({ signal }) => teacherPayoutsApi.get(payoutId, signal),
  })
  if (query.isPending) return <p className="text-xs text-muted-foreground">Loading lessons…</p>
  if (query.isError) {
    return (
      <p role="alert" className="text-xs text-destructive">
        Could not load the lessons of this payout.
      </p>
    )
  }
  return (
    <ul className="flex flex-col gap-1 rounded-md bg-muted/40 px-3 py-2 text-xs">
      {query.data.lessons.map((lesson) => (
        <li key={lesson.id} className="flex flex-wrap justify-between gap-x-3">
          <span className="tabular-nums">
            {formatDateTimeRange(lesson.scheduledAt, lesson.durationMinutes)}
          </span>
          <span className="text-muted-foreground">
            {lessonLabel(lesson)} · {enumLabel(lesson.status)}
          </span>
        </li>
      ))}
    </ul>
  )
}
