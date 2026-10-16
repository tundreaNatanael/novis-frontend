import { http } from './client'
import { pageQuery } from './paging'
import type {
  Course,
  CourseFilters,
  CreateCourseRequest,
  Page,
  PageParams,
  UpdateCourseRequest,
} from './types'

/**
 * Courses (API.md §8). Invalidation: `create` → `lists()`; `update` → `detail(id)` + `lists()`;
 * `remove` → `all`. Reassigning a teacher also invalidates `studentKeys.enrollments`.
 */
export const courseKeys = {
  all: ['courses'] as const,
  lists: () => [...courseKeys.all, 'list'] as const,
  list: (filters: CourseFilters, params: PageParams) =>
    [...courseKeys.lists(), filters, params] as const,
  detail: (id: string) => [...courseKeys.all, 'detail', id] as const,
}

export const coursesApi = {
  list: (filters: CourseFilters, params: PageParams, signal?: AbortSignal) =>
    http.get<Page<Course>>('/courses', pageQuery(params, { ...filters }), signal),
  get: (id: string, signal?: AbortSignal) => http.get<Course>(`/courses/${id}`, undefined, signal),
  create: (body: CreateCourseRequest) => http.post<Course>('/courses', body),
  update: (id: string, body: UpdateCourseRequest) => http.patch<Course>(`/courses/${id}`, body),
  /** Soft delete; lessons and payments stay. */
  remove: (id: string) => http.delete(`/courses/${id}`),
}
