import { useSearchParams } from 'react-router'
import type { RouteHandle } from '@/app/route-handle'
import { SectionHeader } from '@/components/section-header'
import { FinanceSummaryCards } from '@/features/finance/components/finance-summary-cards'
import { PeriodPicker } from '@/features/finance/components/period-picker'
import { StudentFinanceTable } from '@/features/finance/components/student-finance-table'
import { TeacherFinanceTable } from '@/features/finance/components/teacher-finance-table'
import {
  periodFromParams,
  periodParams,
  periodRange,
  type PeriodChoice,
} from '@/features/finance/finance-period'
import { useOrgWorkspace } from '../use-org-workspace'

export const handle: RouteHandle = { crumb: () => 'Finance', title: 'Finance' }

/**
 * The organization's finance overview (API.md §9.7), on both workspace mounts: lessons its students
 * paid for and used against lessons paid out to its teachers, for a period in the admin's time
 * zone. Counted in lessons, never money. The period lives in the URL (`?period=`, `from`, `to`).
 */
export function Component() {
  const { orgId, org, basePath, capabilities } = useOrgWorkspace()
  const [searchParams, setSearchParams] = useSearchParams()
  const choice = periodFromParams(searchParams)
  const period = periodRange(choice)

  const changePeriod = (next: PeriodChoice) =>
    setSearchParams(
      (previous) => {
        const params = new URLSearchParams(previous)
        for (const [key, value] of Object.entries(periodParams(next))) {
          if (value === null) params.delete(key)
          else params.set(key, value)
        }
        // Another period starts both tables on their first page.
        params.delete('studentsPage')
        params.delete('teachersPage')
        return params
      },
      { replace: true },
    )

  return (
    <div className="flex flex-col gap-5">
      <SectionHeader
        title="Finance"
        description={`Lessons the students of ${org.name} paid for and used, against lessons paid out to its teachers. Counted in lessons, not money.`}
      />
      <PeriodPicker value={choice} onChange={changePeriod} />
      {period ? (
        <>
          <FinanceSummaryCards orgId={orgId} period={period} />
          <StudentFinanceTable orgId={orgId} period={period} basePath={basePath} />
          <TeacherFinanceTable
            orgId={orgId}
            period={period}
            basePath={basePath}
            canOpenFormerTeachers={capabilities.canOpenFormerTeachers}
          />
        </>
      ) : null}
    </div>
  )
}
