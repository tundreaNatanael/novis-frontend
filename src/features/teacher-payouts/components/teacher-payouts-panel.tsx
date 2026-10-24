import { useQuery } from '@tanstack/react-query'
import { CalendarCheck2, HandCoins } from 'lucide-react'
import { useState } from 'react'
import { teacherPayoutKeys, teacherPayoutsApi } from '@/api/teacher-payouts'
import type { PayoutLesson } from '@/api/types'
import { Pagination } from '@/components/data/pagination'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { enumLabel, formatDateTimeRange, pluralize } from '@/lib/format'
import {
  PAYABLE_PAGE_SIZE,
  PAYOUT_MAX_LESSONS,
  lessonLabel,
  pageSelectionState,
  toggled,
  toggledAll,
} from '../payout-state'
import { PayoutHistory } from './payout-history'
import { RecordPayoutSheet, type PayoutSelection } from './record-payout-sheet'

interface Props {
  orgId: string
  teacher: { id: string; name: string }
}

/**
 * Teacher payouts on a teacher's page (API.md §9.6): what the organization owes them (charged
 * lessons no payout covers), a table to tick lessons or "Pay everything up to…", the Record payout
 * sheet and the history with Void. For `canManageTeacherPayouts` only. Never the students' payments.
 */
export function TeacherPayoutsPanel({ orgId, teacher }: Props) {
  const [page, setPage] = useState(0)
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set())
  const [sheet, setSheet] = useState<{ open: boolean; selection: PayoutSelection }>({
    open: false,
    selection: { kind: 'upTo' },
  })
  const params = { page, size: PAYABLE_PAGE_SIZE, sort: 'scheduledAt,asc' }
  const payable = useQuery({
    queryKey: teacherPayoutKeys.payable(orgId, teacher.id, {}, params),
    queryFn: ({ signal }) =>
      teacherPayoutsApi.payableLessons(orgId, teacher.id, {}, params, signal),
  })
  const lessons = payable.data?.content ?? []
  const pageIds = lessons.map((lesson) => lesson.id)
  const owed = payable.data?.totalElements
  const tooMany = selected.size > PAYOUT_MAX_LESSONS

  return (
    <section aria-label="Payouts" className="rounded-lg border border-border bg-card">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-card-foreground">Payouts</h2>
          <p className="text-xs text-muted-foreground">
            What the organization paid {teacher.name} for their held and late-canceled lessons. Not
            the students’ payments.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={owed === 0}
            onClick={() => setSheet({ open: true, selection: { kind: 'upTo' } })}
          >
            <CalendarCheck2 aria-hidden />
            Pay everything up to…
          </Button>
          <Button
            size="sm"
            disabled={selected.size === 0 || tooMany}
            title={tooMany ? `At most ${PAYOUT_MAX_LESSONS} lessons per payout` : undefined}
            onClick={() =>
              setSheet({ open: true, selection: { kind: 'lessons', lessonIds: [...selected] } })
            }
          >
            <HandCoins aria-hidden />
            {selected.size === 0
              ? 'Record payout'
              : `Record payout (${pluralize(selected.size, 'lesson')})`}
          </Button>
        </div>
      </header>

      <div className="flex flex-col gap-3 border-b border-border px-4 py-3">
        <p className="text-sm">
          <span className="text-muted-foreground">Owed: </span>
          <strong className="tabular-nums">
            {owed === undefined ? '…' : pluralize(owed, 'lesson')}
          </strong>
          <span className="text-muted-foreground">
            {' '}
            — held or canceled late, not paid out yet, whatever the student paid.
          </span>
        </p>
        {payable.isPending ? (
          <p className="text-sm text-muted-foreground">Loading lessons…</p>
        ) : payable.isError ? (
          <p role="alert" className="text-sm text-destructive">
            Could not load the lessons to pay out.
          </p>
        ) : lessons.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nothing to pay out: every held or late-canceled lesson is in a payout.
          </p>
        ) : (
          <>
            <PayableTable
              lessons={lessons}
              selected={selected}
              headerState={pageSelectionState(selected, pageIds)}
              onToggle={(id, on) => setSelected((current) => toggled(current, id, on))}
              onTogglePage={(on) => setSelected((current) => toggledAll(current, pageIds, on))}
            />
            {selected.size > 0 ? (
              <p className="text-xs text-muted-foreground" aria-live="polite">
                {pluralize(selected.size, 'lesson')} selected
                {tooMany ? ` — at most ${PAYOUT_MAX_LESSONS} per payout` : ''}.{' '}
                <button
                  type="button"
                  className="font-medium text-primary underline-offset-4 hover:underline"
                  onClick={() => setSelected(new Set())}
                >
                  Clear selection
                </button>
              </p>
            ) : null}
            {payable.data.totalPages > 1 ? (
              <Pagination
                page={page}
                size={PAYABLE_PAGE_SIZE}
                total={payable.data.totalElements}
                onPageChange={setPage}
              />
            ) : null}
          </>
        )}
      </div>

      <PayoutHistory orgId={orgId} teacherId={teacher.id} />

      <RecordPayoutSheet
        orgId={orgId}
        teacher={teacher}
        selection={sheet.selection}
        open={sheet.open}
        onOpenChange={(open) => setSheet((current) => ({ ...current, open }))}
        onSettled={() => {
          setSelected(new Set())
          setPage(0)
        }}
      />
    </section>
  )
}

function PayableTable({
  lessons,
  selected,
  headerState,
  onToggle,
  onTogglePage,
}: {
  lessons: PayoutLesson[]
  selected: ReadonlySet<string>
  headerState: boolean | 'indeterminate'
  onToggle: (id: string, on: boolean) => void
  onTogglePage: (on: boolean) => void
}) {
  return (
    <>
      <Table className="hidden md:table">
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">
              <Checkbox
                aria-label="Select every lesson on this page"
                checked={headerState}
                onCheckedChange={(checked) => onTogglePage(checked === true)}
              />
            </TableHead>
            <TableHead>When</TableHead>
            <TableHead>Student</TableHead>
            <TableHead>Course</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {lessons.map((lesson) => {
            const when = formatDateTimeRange(lesson.scheduledAt, lesson.durationMinutes)
            return (
              <TableRow
                key={lesson.id}
                data-state={selected.has(lesson.id) ? 'selected' : undefined}
              >
                <TableCell>
                  <Checkbox
                    aria-label={`Select the lesson of ${when} with ${lesson.studentName}`}
                    checked={selected.has(lesson.id)}
                    onCheckedChange={(checked) => onToggle(lesson.id, checked === true)}
                  />
                </TableCell>
                <TableCell className="tabular-nums">{when}</TableCell>
                <TableCell>{lesson.studentName}</TableCell>
                <TableCell>{lesson.courseTitle ?? '—'}</TableCell>
                <TableCell>{enumLabel(lesson.status)}</TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
      <ul className="flex flex-col divide-y divide-border rounded-md border border-border md:hidden">
        {lessons.map((lesson) => {
          const when = formatDateTimeRange(lesson.scheduledAt, lesson.durationMinutes)
          return (
            <li key={lesson.id}>
              <label className="flex min-h-11 items-start gap-3 px-3 py-2.5 text-sm">
                <Checkbox
                  className="mt-0.5"
                  checked={selected.has(lesson.id)}
                  onCheckedChange={(checked) => onToggle(lesson.id, checked === true)}
                />
                <span className="flex flex-col">
                  <span className="tabular-nums">{when}</span>
                  <span className="text-xs text-muted-foreground">
                    {lessonLabel(lesson)} · {enumLabel(lesson.status)}
                  </span>
                </span>
              </label>
            </li>
          )
        })}
      </ul>
    </>
  )
}
