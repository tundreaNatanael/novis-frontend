import { http } from './client'
import { pageQuery } from './paging'
import type {
  AddPrepaidLessonsRequest,
  CreateStudentRequest,
  LessonSummary,
  Page,
  PageParams,
  PrepaidLessons,
  Student,
  StudentCreated,
  StudentEnrollment,
  StudentFilters,
  UpdateStudentRequest,
} from './types'

/**
 * Students (API.md §7, §9.4). Invalidation: `create` → `lists()` + `profiles()` + the org's member
 * lists; `update` → `detail(id)` + `lists()` + `profiles()` (a new name or email changes the
 * siblings too); `remove` → everything under `all` + member lists + `enrollmentKeys.all`;
 * `addPrepaid` → `summary(id)` + `lessonKeys.lists()`.
 */
export const studentKeys = {
  all: ['students'] as const,
  lists: () => [...studentKeys.all, 'list'] as const,
  list: (filters: StudentFilters, params: PageParams) =>
    [...studentKeys.lists(), filters, params] as const,
  detail: (id: string) => [...studentKeys.all, 'detail', id] as const,
  summary: (id: string, teacherId: string | null) =>
    [...studentKeys.all, 'summary', id, teacherId ?? 'all'] as const,
  enrollmentsOf: (id: string) => [...studentKeys.all, 'enrollments', id] as const,
  enrollments: (id: string, params: PageParams) =>
    [...studentKeys.enrollmentsOf(id), params] as const,
  profiles: (id?: string) =>
    id
      ? ([...studentKeys.all, 'profiles', id] as const)
      : ([...studentKeys.all, 'profiles'] as const),
}

export const studentsApi = {
  list: (filters: StudentFilters, params: PageParams, signal?: AbortSignal) =>
    http.get<Page<Student>>('/students', pageQuery(params, { ...filters }), signal),
  get: (id: string, signal?: AbortSignal) =>
    http.get<Student>(`/students/${id}`, undefined, signal),
  /** `profileCreated` says whether a new profile was made or the email's profile of that name linked (D-049). */
  create: (body: CreateStudentRequest) => http.post<StudentCreated>('/students', body),
  update: (id: string, body: UpdateStudentRequest) => http.patch<Student>(`/students/${id}`, body),
  /** Detaches from everything the caller controls; the super-admin always deletes the account (gap G8). */
  remove: (id: string) => http.delete(`/students/${id}`),
  summary: (id: string, teacherId: string | null, signal?: AbortSignal) =>
    http.get<LessonSummary>(`/students/${id}/lessons/summary`, { teacherId }, signal),
  addPrepaid: (id: string, body: AddPrepaidLessonsRequest) =>
    http.post<PrepaidLessons>(`/students/${id}/lessons/prepaid`, body),
  enrollments: (id: string, params: PageParams, signal?: AbortSignal) =>
    http.get<Page<StudentEnrollment>>(`/students/${id}/enrollments`, pageQuery(params), signal),
  /** The other profiles of the student's email the caller may see (siblings in this organization). */
  profiles: (id: string, signal?: AbortSignal) =>
    http.get<Student[]>(`/students/${id}/profiles`, undefined, signal),
}
