import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { HandCoins, Users } from 'lucide-react'
import { useMemo } from 'react'
import { Link } from 'react-router'
import { reportKeys, reportsApi } from '@/api/reports'
import type { FinancePeriod, TeacherFinanceRow } from '@/api/types'
import { columnHelper, DataTable } from '@/components/data/data-table'
import { EmptyState } from '@/components/data/empty-state'
import { Button } from '@/components/ui/button'
import { LESSON_COUNTS } from '@/features/lessons/lesson-counts'
import { payoutsPath } from '@/features/teacher-payouts/payout-state'
import { formatDate } from '@/lib/format'
import { useListParams } from '@/lib/use-list-params'
import { CountList, FormerTeacherBadge, MismatchCount } from './finance-counts'

const col = columnHelper<TeacherFinanceRow>()

/** Some headers name a whole sentence; they wrap instead of widening the table. */
const WRAP = { headerClassName: 'h-auto min-w-28 py-2 whitespace-normal' }

const count = (name: 'taught' | 'paidOut' | 'owed') =>
  col.accessor(name, {
    header: LESSON_COUNTS[name].label,
    cell: (info) => <span className="tabular-nums">{info.getValue()}</span>,
  })

const mismatch = (name: 'usedPaidNotPaidOut' | 'paidOutNotPaidByStudent') =>
  col.accessor(name, {
    header: LESSON_COUNTS[name].label,
    cell: (info) => <MismatchCount kind={name} count={info.getValue()} />,
    meta: WRAP,
  })

interface TeacherFinanceTableProps {
  orgId: string
  period: FinancePeriod
  /** The workspace's base path, for links to the teachers' pages. */
  basePath: string
  /** The super-admin opens the page of a teacher who left; an org admin cannot (gap G21). */
  canOpenFormerTeachers: boolean
}

/**
 * Every teacher with lessons in the organization, those who left included
 * (`GET /orgs/{orgId}/reports/teachers`): taught and paid out in the period, what is still owed,
 * and where the student's payment and the teacher's payout disagree. Sorted and paged by the API;
 * the list state lives in the URL as `teachers*`.
 */
export function TeacherFinanceTable({
  orgId,
  period,
  basePath,
  canOpenFormerTeachers,
}: TeacherFinanceTableProps) {
  const params = useListParams({ prefix: 'teachers', sort: 'taught,desc' })
  const query = useQuery({
    queryKey: reportKeys.teachers(orgId, period, params.pageParams),
    queryFn: ({ signal }) => reportsApi.teachers(orgId, period, params.pageParams, signal),
    placeholderData: keepPreviousData,
    staleTime: 0,
  })
  const linked = (row: TeacherFinanceRow) => row.active || canOpenFormerTeachers
  const teacherPath = (row: TeacherFinanceRow) =>
    linked(row) ? `${basePath}/teachers/${row.teacherId}` : undefined

  const columns = useMemo(
    () => [
      col.accessor('name', {
        header: 'Teacher',
        enableSorting: false,
        cell: (info) => {
          const row = info.row.original
          return (
            <span className="flex flex-wrap items-center gap-2 py-1">
              {row.active || canOpenFormerTeachers ? (
                <Link
                  to={`${basePath}/teachers/${row.teacherId}`}
                  onClick={(event) => event.stopPropagation()}
                  className="font-medium text-foreground underline-offset-4 hover:underline"
                >
                  {info.getValue()}
                </Link>
              ) : (
                <span className="font-medium text-foreground">{info.getValue()}</span>
              )}
              {row.active ? null : <FormerTeacherBadge />}
            </span>
          )
        },
      }),
      count('taught'),
      count('paidOut'),
      count('owed'),
      col.accessor('owedAllTime', {
        header: LESSON_COUNTS.owedAllTime.label,
        cell: (info) => <span className="tabular-nums">{info.getValue()}</span>,
        meta: { className: 'hidden lg:table-cell', headerClassName: 'hidden lg:table-cell' },
      }),
      mismatch('usedPaidNotPaidOut'),
      mismatch('paidOutNotPaidByStudent'),
      col.accessor('lastPayoutOn', {
        header: 'Last payout',
        enableSorting: false,
        cell: (info) => (
          <span className="text-muted-foreground tabular-nums">{formatDate(info.getValue())}</span>
        ),
        meta: { className: 'hidden lg:table-cell', headerClassName: 'hidden lg:table-cell' },
      }),
    ],
    [basePath, canOpenFormerTeachers],
  )

  return (
    <section aria-labelledby="finance-teachers" className="flex flex-col gap-3">
      <div>
        <h3 id="finance-teachers" className="text-base font-semibold text-foreground">
          Teachers
        </h3>
        <p className="text-sm text-muted-foreground">
          Taught and paid out in the period, what is still owed, and lessons where the student’s
          payment and the teacher’s payout disagree.
        </p>
      </div>
      <DataTable
        caption="Lessons taught and paid out, per teacher"
        columns={columns}
        data={query.data?.content ?? []}
        total={query.data?.totalElements ?? 0}
        page={params.page}
        size={params.size}
        onPageChange={params.setPage}
        onSizeChange={params.setSize}
        sort={params.sort}
        onSortChange={params.setSort}
        getRowId={(row) => row.teacherId}
        rowHref={teacherPath}
        rowActions={(row) =>
          linked(row) ? (
            <Button asChild variant="ghost" size="sm" className="h-11 md:h-7">
              <Link to={payoutsPath(basePath, row.teacherId)} aria-label={`Payouts of ${row.name}`}>
                <HandCoins aria-hidden />
                Payouts
              </Link>
            </Button>
          ) : null
        }
        isLoading={query.isPending}
        isFetching={query.isFetching}
        error={query.error}
        onRetry={() => void query.refetch()}
        renderMobileRow={(row) => (
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-2">
              <span className="truncate font-medium text-foreground">{row.name}</span>
              {row.active ? null : <FormerTeacherBadge />}
            </p>
            <CountList
              counts={[
                ['taught', row.taught],
                ['paidOut', row.paidOut],
                ['owed', row.owed],
                ['owedAllTime', row.owedAllTime],
              ]}
            />
            <div className="mt-1 flex flex-wrap gap-1">
              <MismatchCount kind="usedPaidNotPaidOut" count={row.usedPaidNotPaidOut} long />
              <MismatchCount
                kind="paidOutNotPaidByStudent"
                count={row.paidOutNotPaidByStudent}
                long
              />
            </div>
          </div>
        )}
        emptyState={
          <EmptyState
            icon={Users}
            title="No teachers with lessons yet"
            description="A teacher shows here once they have a lesson in this organization."
          />
        }
      />
    </section>
  )
}
