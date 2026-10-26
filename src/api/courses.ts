import { http } from './client'
import { pageQuery } from './paging'
import type {
  Course,
  CourseFilters,
  CreateCourseRequest,
  Homework,
  Material,
  Page,
  PageParams,
  UpdateCourseRequest,
} from './types'

/**
 * Courses (API.md §8). Invalidation: `create` → `lists()`; `update` → `detail(id)` + `lists()`;
 * `remove` → `all`. Reassigning a teacher also invalidates `studentKeys.enrollments`. A course's
 * materials (`materials(courseId)`) follow every material write; its homework (`homework(courseId)`)
 * every homework write.
 */
export const courseKeys = {
  all: ['courses'] as const,
  lists: () => [...courseKeys.all, 'list'] as const,
  list: (filters: CourseFilters, params: PageParams) =>
    [...courseKeys.lists(), filters, params] as const,
  /** A list loaded page after page (the teacher workspace). */
  infinite: (filters: CourseFilters) => [...courseKeys.lists(), 'infinite', filters] as const,
  detail: (id: string) => [...courseKeys.all, 'detail', id] as const,
  materialsAll: () => [...courseKeys.all, 'materials'] as const,
  materials: (courseId: string) => [...courseKeys.materialsAll(), courseId] as const,
  homeworkAll: () => [...courseKeys.all, 'homework'] as const,
  homework: (courseId: string) => [...courseKeys.homeworkAll(), courseId] as const,
}

export const coursesApi = {
  list: (filters: CourseFilters, params: PageParams, signal?: AbortSignal) =>
    http.get<Page<Course>>('/courses', pageQuery(params, { ...filters }), signal),
  get: (id: string, signal?: AbortSignal) => http.get<Course>(`/courses/${id}`, undefined, signal),
  create: (body: CreateCourseRequest) => http.post<Course>('/courses', body),
  update: (id: string, body: UpdateCourseRequest) => http.patch<Course>(`/courses/${id}`, body),
  /** Soft delete; lessons and payments stay. */
  remove: (id: string) => http.delete(`/courses/${id}`),
  /** The course's ready materials, newest first. */
  materials: (courseId: string, params: PageParams, signal?: AbortSignal) =>
    http.get<Page<Material>>(`/courses/${courseId}/materials`, pageQuery(params), signal),
  /** The course's homework, newest first. */
  homework: (courseId: string, params: PageParams, signal?: AbortSignal) =>
    http.get<Page<Homework>>(`/courses/${courseId}/homework`, pageQuery(params), signal),
}
