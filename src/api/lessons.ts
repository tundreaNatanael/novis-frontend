import { http } from './client'
import { pageQuery } from './paging'
import type {
  CloseLessonRequest,
  CreateLessonRequest,
  Lesson,
  LessonDetail,
  LessonFilters,
  Page,
  PageParams,
  ScheduleLessonRequest,
  UpdateJournalRequest,
  UpdatePaymentRequest,
} from './types'

/**
 * Lessons (API.md §9). Invalidation: every mutation → `detail(id)` + `lists()` +
 * `studentKeys.summary(studentId)`; `close` with a rollover also refetches `detail(rolledOverToLessonId)`.
 * `setPaid` is the only optimistic update in the console.
 */
export const lessonKeys = {
  all: ['lessons'] as const,
  lists: () => [...lessonKeys.all, 'list'] as const,
  list: (filters: LessonFilters, params: PageParams) =>
    [...lessonKeys.lists(), filters, params] as const,
  detail: (id: string) => [...lessonKeys.all, 'detail', id] as const,
}

export const lessonsApi = {
  list: (filters: LessonFilters, params: PageParams, signal?: AbortSignal) =>
    http.get<Page<Lesson>>('/lessons', pageQuery(params, { ...filters }), signal),
  get: (id: string, signal?: AbortSignal) =>
    http.get<LessonDetail>(`/lessons/${id}`, undefined, signal),
  create: (body: CreateLessonRequest) => http.post<LessonDetail>('/lessons', body),
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
