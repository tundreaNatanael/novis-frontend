import { http } from './client'
import { pageQuery } from './paging'
import type {
  CreateHomeworkRequest,
  Homework,
  HomeworkFilters,
  Page,
  PageParams,
  UpdateHomeworkRequest,
} from './types'

/**
 * Homework (API.md §11): one teacher, one student; course and lesson are optional references.
 * Invalidation: `create`, `update`, `remove` → `lists()`. `get` is read right before an update
 * that rewrites the checklist and is not cached.
 */
export const homeworkKeys = {
  all: ['homework'] as const,
  lists: () => [...homeworkKeys.all, 'list'] as const,
  list: (filters: HomeworkFilters, params: PageParams) =>
    [...homeworkKeys.lists(), filters, params] as const,
}

export const homeworkApi = {
  list: (filters: HomeworkFilters, params: PageParams, signal?: AbortSignal) =>
    http.get<Page<Homework>>('/homework', pageQuery(params, { ...filters }), signal),
  get: (id: string) => http.get<Homework>(`/homework/${id}`),
  create: (body: CreateHomeworkRequest) => http.post<Homework>('/homework', body),
  update: (id: string, body: UpdateHomeworkRequest) =>
    http.patch<Homework>(`/homework/${id}`, body),
  remove: (id: string) => http.delete(`/homework/${id}`),
}
