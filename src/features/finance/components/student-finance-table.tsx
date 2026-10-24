import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { GraduationCap } from 'lucide-react'
import { useMemo } from 'react'
import { Link } from 'react-router'
import { reportKeys, reportsApi } from '@/api/reports'
import type { FinancePeriod, StudentFinanceRow } from '@/api/types'
import { columnHelper, DataTable } from '@/components/data/data-table'
import { EmptyState } from '@/components/data/empty-state'
import { LESSON_COUNTS } from '@/features/lessons/lesson-counts'
import { formatDate } from '@/lib/format'
import { useListParams } from '@/lib/use-list-params'
import { CountList, FormerStudentBadge } from './finance-counts'

const col = columnHelper<StudentFinanceRow>()

const count = (name: 'paidByStudent' | 'used' | 'prepaidRemaining' | 'unpaidDue') =>
  col.accessor(name, {
    header: LESSON_COUNTS[name].label,
    cell: (info) => <span className="tabular-nums">{info.getValue()}</span>,
  })

interface StudentFinanceTableProps {
  orgId: string
  period: FinancePeriod
  /** The workspace's base path, for links to the students' pages. */
  basePath: string
  /** The super-admin opens the page of a student who left; an org admin cannot. */
  canOpenFormerStudents: boolean
}

/**
 * Every student with lessons in the organization, those who left included
 * (`GET /orgs/{orgId}/reports/students`): paid and used in the period, prepaid left and unpaid due
 * now — the numbers of their Lesson balances. Sorted and paged by the API; the list state lives in
 * the URL as `students*`.
 */
export function StudentFinanceTable({
  orgId,
  period,
  basePath,
  canOpenFormerStudents,
}: StudentFinanceTableProps) {
  const params = useListParams({ prefix: 'students', sort: 'used,desc' })
  const query = useQuery({
    queryKey: reportKeys.students(orgId, period, params.pageParams),
    queryFn: ({ signal }) => reportsApi.students(orgId, period, params.pageParams, signal),
    placeholderData: keepPreviousData,
    staleTime: 0,
  })
  const linked = (row: StudentFinanceRow) => row.active || canOpenFormerStudents
  const studentPath = (row: StudentFinanceRow) =>
    linked(row) ? `${basePath}/students/${row.studentId}` : undefined

  const columns = useMemo(
    () => [
      col.accessor('name', {
        header: 'Student',
        enableSorting: false,
        cell: (info) => {
          const row = info.row.original
          return (
            <span className="flex flex-wrap items-center gap-2 py-1">
              {row.active || canOpenFormerStudents ? (
                <Link
                  to={`${basePath}/students/${row.studentId}`}
                  onClick={(event) => event.stopPropagation()}
                  className="font-medium text-foreground underline-offset-4 hover:underline"
                >
                  {info.getValue()}
                </Link>
              ) : (
                <span className="font-medium text-foreground">{info.getValue()}</span>
              )}
              {row.active ? null : <FormerStudentBadge />}
            </span>
          )
        },
      }),
      count('paidByStudent'),
      count('used'),
      count('prepaidRemaining'),
      count('unpaidDue'),
      col.accessor('lastPaymentAt', {
        header: 'Last payment',
        enableSorting: false,
        cell: (info) => (
          <span className="text-muted-foreground tabular-nums">{formatDate(info.getValue())}</span>
        ),
        meta: { className: 'hidden lg:table-cell', headerClassName: 'hidden lg:table-cell' },
      }),
    ],
    [basePath, canOpenFormerStudents],
  )

  return (
    <section aria-labelledby="finance-students" className="flex flex-col gap-3">
      <div>
        <h3 id="finance-students" className="text-base font-semibold text-foreground">
          Students
        </h3>
        <p className="text-sm text-muted-foreground">
          Paid and used in the period; prepaid left and unpaid due as they stand now, as on each
          student’s Lesson balances.
        </p>
      </div>
      <DataTable
        caption="Lessons paid for and used, per student"
        columns={columns}
        data={query.data?.content ?? []}
        total={query.data?.totalElements ?? 0}
        page={params.page}
        size={params.size}
        onPageChange={params.setPage}
        onSizeChange={params.setSize}
        sort={params.sort}
        onSortChange={params.setSort}
        getRowId={(row) => row.studentId}
        rowHref={studentPath}
        isLoading={query.isPending}
        isFetching={query.isFetching}
        error={query.error}
        onRetry={() => void query.refetch()}
        renderMobileRow={(row) => (
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-2">
              <span className="truncate font-medium text-foreground">{row.name}</span>
              {row.active ? null : <FormerStudentBadge />}
            </p>
            <CountList
              counts={[
                ['paidByStudent', row.paidByStudent],
                ['used', row.used],
                ['prepaidRemaining', row.prepaidRemaining],
                ['unpaidDue', row.unpaidDue],
              ]}
            />
          </div>
        )}
        emptyState={
          <EmptyState
            icon={GraduationCap}
            title="No students with lessons yet"
            description="A student shows here once they have a lesson in this organization."
          />
        }
      />
    </section>
  )
}
