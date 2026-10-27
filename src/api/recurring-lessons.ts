import { http } from './client'
import { pageQuery } from './paging'
import type {
  CreateRecurringLessonRequest,
  EndRecurringLessonRequest,
  Lesson,
  Page,
  PageParams,
  RecurringLesson,
  RecurringLessonDetail,
  RecurringLessonFilters,
  RecurringLessonPlan,
  UpdateRecurringLessonRequest,
} from './types'

/**
 * Recurring lessons — permanent weekly lessons (API.md §9.8): a weekly setting of one teacher and
 * one student that a generator keeps 8 weeks of real lessons booked for. Invalidation: every write
 * (`create`, `change`, `end`, `bookOccurrence`, `skipOccurrence`) → everything under `all` +
 * `lessonKeys.all` (lessons are booked, moved or given back) + `studentKeys.all` (the balances'
 * `toSchedule` and `nextLesson` change). The dry runs (`plan`, `planChange`) are reads that write
 * nothing; their keys live under `plans` apart from `all`, so a write does not run them again.
 */
export const recurringLessonKeys = {
  all: ['recurring-lessons'] as const,
  lists: () => [...recurringLessonKeys.all, 'list'] as const,
  list: (filters: RecurringLessonFilters, params: PageParams) =>
    [...recurringLessonKeys.lists(), filters, params] as const,
  detail: (id: string) => [...recurringLessonKeys.all, 'detail', id] as const,
  plans: ['recurring-lesson-plans'] as const,
  /** The dry run of a new rule (`POST` with `dryRun: true`). */
  plan: (body: CreateRecurringLessonRequest | null) =>
    [...recurringLessonKeys.plans, 'create', body] as const,
  /** The dry run of a change from a date (`PATCH` with `dryRun: true`). */
  changePlan: (id: string, body: UpdateRecurringLessonRequest | null) =>
    [...recurringLessonKeys.plans, 'change', id, body] as const,
}

export const recurringLessonsApi = {
  list: (filters: RecurringLessonFilters, params: PageParams, signal?: AbortSignal) =>
    http.get<Page<RecurringLesson>>(
      '/recurring-lessons',
      pageQuery(params, { ...filters }),
      signal,
    ),
  get: (id: string, signal?: AbortSignal) =>
    http.get<RecurringLesson>(`/recurring-lessons/${id}`, undefined, signal),
  /** The dates a new rule would book up to the horizon and which overlap other lessons; nothing is written. */
  plan: (body: CreateRecurringLessonRequest) =>
    http.post<RecurringLessonPlan>('/recurring-lessons', { ...body, dryRun: true }),
  /** Sets the rule up and books its first lessons, all or nothing (`409 SCHEDULE_CONFLICT` without `allowOverlap`). */
  create: (body: CreateRecurringLessonRequest) =>
    http.post<RecurringLessonDetail>('/recurring-lessons', { ...body, dryRun: false }),
  /** The dates a change from `effectiveFrom` would book; nothing is written. */
  planChange: (id: string, body: UpdateRecurringLessonRequest) =>
    http.patch<RecurringLessonPlan>(`/recurring-lessons/${id}`, { ...body, dryRun: true }),
  /**
   * Applies the change from `effectiveFrom` and answers the rule that holds the new settings: a new
   * rule (another `id`) when the change starts after the rule did, the same one otherwise.
   */
  change: (id: string, body: UpdateRecurringLessonRequest) =>
    http.patch<RecurringLessonDetail>(`/recurring-lessons/${id}`, { ...body, dryRun: false }),
  /** Ends the rule after `endsOn` (today by default); the lessons after it are given back. */
  end: (id: string, body: EndRecurringLessonRequest = {}) =>
    http.post<RecurringLesson>(`/recurring-lessons/${id}/end`, body),
  /** Books one date the daily run left as a conflict (`allowOverlap`), or brings a skipped date back. */
  bookOccurrence: (id: string, occurrenceOn: string, allowOverlap: boolean) =>
    http.post<Lesson>(`/recurring-lessons/${id}/occurrences/${occurrenceOn}/book`, {
      allowOverlap,
    }),
  /** Drops one date of the rule for good. */
  skipOccurrence: (id: string, occurrenceOn: string) =>
    http.post<void>(`/recurring-lessons/${id}/occurrences/${occurrenceOn}/skip`, {}),
}
