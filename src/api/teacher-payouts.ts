import { http } from './client'
import { pageQuery } from './paging'
import type {
  CreateTeacherPayoutRequest,
  Page,
  PageParams,
  PayableLessonFilters,
  PayoutLesson,
  TeacherPayout,
  TeacherPayoutDetail,
  TeacherPayoutFilters,
  VoidTeacherPayoutRequest,
} from './types'

/**
 * Teacher payouts (API.md §9.6): what the organization paid its teachers for their lessons — never
 * the students' payments. Recorded and voided by the organization's admin and the super-admin.
 * Invalidation: `create` and `void` → `teacherPayoutKeys.all` (payable lessons, payouts and their
 * details) + `lessonKeys.all` (`Lesson.teacherPayout` changed on those lessons).
 */
export const teacherPayoutKeys = {
  all: ['teacher-payouts'] as const,
  payable: (orgId: string, teacherId: string, filters: PayableLessonFilters, params: PageParams) =>
    [...teacherPayoutKeys.all, 'payable', orgId, teacherId, filters, params] as const,
  lists: () => [...teacherPayoutKeys.all, 'list'] as const,
  list: (orgId: string, filters: TeacherPayoutFilters, params: PageParams) =>
    [...teacherPayoutKeys.lists(), orgId, filters, params] as const,
  detail: (id: string) => [...teacherPayoutKeys.all, 'detail', id] as const,
}

export const teacherPayoutsApi = {
  payableLessons: (
    orgId: string,
    teacherId: string,
    filters: PayableLessonFilters,
    params: PageParams,
    signal?: AbortSignal,
  ) =>
    http.get<Page<PayoutLesson>>(
      `/orgs/${orgId}/teachers/${teacherId}/payable-lessons`,
      pageQuery(params, { ...filters }),
      signal,
    ),
  list: (orgId: string, filters: TeacherPayoutFilters, params: PageParams, signal?: AbortSignal) =>
    http.get<Page<TeacherPayout>>(
      `/orgs/${orgId}/teacher-payouts`,
      pageQuery(params, { ...filters }),
      signal,
    ),
  get: (id: string, signal?: AbortSignal) =>
    http.get<TeacherPayoutDetail>(`/teacher-payouts/${id}`, undefined, signal),
  /** All or nothing: `409` when a lesson was paid out meanwhile, `400` when one is not payable. */
  create: (orgId: string, body: CreateTeacherPayoutRequest) =>
    http.post<TeacherPayoutDetail>(`/orgs/${orgId}/teacher-payouts`, body),
  /** Keeps the payout as history and frees its lessons; `409` when it is already voided. */
  void: (id: string, body: VoidTeacherPayoutRequest) =>
    http.post<TeacherPayoutDetail>(`/teacher-payouts/${id}/void`, body),
}
