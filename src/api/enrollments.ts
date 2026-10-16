import { http } from './client'
import { pageQuery } from './paging'
import type { EnrollRequest, Enrollment, Page, PageParams } from './types'

/**
 * Enrollments (API.md §8). Invalidation: `enroll` / `unenroll` → `course(courseId)` +
 * `studentKeys.enrollments(studentId)`.
 */
export const enrollmentKeys = {
  all: ['enrollments'] as const,
  course: (courseId: string) => [...enrollmentKeys.all, courseId] as const,
  list: (courseId: string, params: PageParams) =>
    [...enrollmentKeys.course(courseId), params] as const,
}

export const enrollmentsApi = {
  list: (courseId: string, params: PageParams, signal?: AbortSignal) =>
    http.get<Page<Enrollment>>(`/courses/${courseId}/enrollments`, pageQuery(params), signal),
  enroll: (courseId: string, body: EnrollRequest) =>
    http.post<Enrollment>(`/courses/${courseId}/enrollments`, body),
  unenroll: (courseId: string, studentId: string) =>
    http.delete(`/courses/${courseId}/enrollments/${studentId}`),
}
