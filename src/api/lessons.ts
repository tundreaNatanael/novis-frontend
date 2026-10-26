import { http } from './client'
import { pageQuery } from './paging'
import type {
  CloseLessonRequest,
  CreateLessonRequest,
  CreateLessonSeriesRequest,
  Lesson,
  LessonDetail,
  LessonFilters,
  LessonSeries,
  LessonSeriesPlan,
  Page,
  PageParams,
  ScheduleLessonRequest,
  UpdateJournalRequest,
  UpdatePaymentRequest,
} from './types'

/**
 * Lessons (API.md §9). Invalidation: every mutation → `detail(id)` + `lists()` +
 * `studentKeys.summary(studentId)`; `close` with a rollover also refetches `detail(rolledOverToLessonId)`.
 * `setPaid` is the only optimistic update in the console. The teacher workspace keeps its paged
 * lists under `infinite(filters)` and its `totalElements`-only reads under `count(filters)`, both
 * inside `lists()` / `all`, so the same invalidation reaches them.
 */
export const lessonKeys = {
  all: ['lessons'] as const,
  lists: () => [...lessonKeys.all, 'list'] as const,
  list: (filters: LessonFilters, params: PageParams) =>
    [...lessonKeys.lists(), filters, params] as const,
  /** A list loaded page after page (the teacher workspace). */
  infinite: (filters: LessonFilters, sort: string) =>
    [...lessonKeys.lists(), 'infinite', filters, sort] as const,
  /** `totalElements` of a filter, read with `size=1`. */
  count: (filters: LessonFilters, sort?: string) =>
    [...lessonKeys.all, 'count', filters, sort ?? ''] as const,
  detail: (id: string) => [...lessonKeys.all, 'detail', id] as const,
  /** The dry run of a weekly series (`POST /lessons/series` with `dryRun: true`). */
  seriesPlan: (body: CreateLessonSeriesRequest | null) =>
    [...lessonKeys.all, 'series-plan', body] as const,
}

export const lessonsApi = {
  list: (filters: LessonFilters, params: PageParams, signal?: AbortSignal) =>
    http.get<Page<Lesson>>('/lessons', pageQuery(params, { ...filters }), signal),
  get: (id: string, signal?: AbortSignal) =>
    http.get<LessonDetail>(`/lessons/${id}`, undefined, signal),
  create: (body: CreateLessonRequest) => http.post<LessonDetail>('/lessons', body),
  /** The dates a weekly series would book and which overlap other lessons; nothing is written. */
  planSeries: (body: CreateLessonSeriesRequest) =>
    http.post<LessonSeriesPlan>('/lessons/series', { ...body, dryRun: true }),
  /** Books every date or none (`409 SCHEDULE_CONFLICT` without `allowOverlap`). */
  bookSeries: (body: CreateLessonSeriesRequest) =>
    http.post<LessonSeries>('/lessons/series', { ...body, dryRun: false }),
  schedule: (id: string, body: ScheduleLessonRequest) =>
    http.patch<Lesson>(`/lessons/${id}/schedule`, body),
  close: (id: string, body: CloseLessonRequest) =>
    http.post<LessonDetail>(`/lessons/${id}/close`, body),
  updateJournal: (id: string, body: UpdateJournalRequest) =>
    http.patch<Lesson>(`/lessons/${id}/journal`, body),
  setPaid: (id: string, body: UpdatePaymentRequest) =>
    http.patch<Lesson>(`/lessons/${id}/payment`, body),
  /** Only while `PENDING` and unpaid (409 otherwise). */
  remove: (id: string) => http.delete(`/lessons/${id}`),
}
