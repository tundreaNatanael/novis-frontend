import { http } from './client'
import { pageQuery } from './paging'
import type {
  FinancePeriod,
  FinanceSummary,
  Page,
  PageParams,
  StudentFinanceRow,
  TeacherFinanceRow,
} from './types'

/**
 * Finance reports (API.md §9.7): what the organization's students paid for and used against what
 * it paid out to its teachers, counted in lessons, for a period of two instants. Read-only, for the
 * organization's admin and the super-admin. Invalidation: none. Almost every lesson, payment and
 * payout write changes these numbers, so the Finance tab reads them with `staleTime: 0` and
 * refetches on every visit instead.
 */
export const reportKeys = {
  all: ['reports'] as const,
  summary: (orgId: string, period: FinancePeriod) =>
    [...reportKeys.all, 'summary', orgId, period] as const,
  students: (orgId: string, period: FinancePeriod, params: PageParams) =>
    [...reportKeys.all, 'students', orgId, period, params] as const,
  teachers: (orgId: string, period: FinancePeriod, params: PageParams) =>
    [...reportKeys.all, 'teachers', orgId, period, params] as const,
}

export const reportsApi = {
  summary: (orgId: string, period: FinancePeriod, signal?: AbortSignal) =>
    http.get<FinanceSummary>(`/orgs/${orgId}/reports/summary`, { ...period }, signal),
  students: (orgId: string, period: FinancePeriod, params: PageParams, signal?: AbortSignal) =>
    http.get<Page<StudentFinanceRow>>(
      `/orgs/${orgId}/reports/students`,
      pageQuery(params, { ...period }),
      signal,
    ),
  teachers: (orgId: string, period: FinancePeriod, params: PageParams, signal?: AbortSignal) =>
    http.get<Page<TeacherFinanceRow>>(
      `/orgs/${orgId}/reports/teachers`,
      pageQuery(params, { ...period }),
      signal,
    ),
}
