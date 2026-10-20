import { http } from './client'
import { pageQuery } from './paging'
import type {
  CreateFreelanceTeacherRequest,
  FreelanceTeacherFilters,
  Page,
  PageParams,
  UpdateFreelanceTeacherRequest,
  User,
} from './types'

/**
 * Freelance teachers (API.md §5, super-admin only; anyone else gets `403`). Invalidation:
 * `create` → `lists()` + `userKeys.lists()` (the lesson pickers list freelance teachers through
 * `GET /users?freelance=true`); `update` → `detail(id)` + `lists()` + `userKeys.detail(id)`, plus
 * `userKeys.lists()` when the name or email changed; `remove` → `lists()` + `userKeys.all` +
 * `studentKeys.all` + `courseKeys.all` (the cascade deletes their students and archives their
 * courses), then `detail(id)` is removed once the page showing it has left.
 */
export const freelanceTeacherKeys = {
  all: ['freelance-teachers'] as const,
  lists: () => [...freelanceTeacherKeys.all, 'list'] as const,
  list: (filters: FreelanceTeacherFilters, params: PageParams) =>
    [...freelanceTeacherKeys.lists(), filters, params] as const,
  detail: (id: string) => [...freelanceTeacherKeys.all, 'detail', id] as const,
}

export const freelanceTeachersApi = {
  list: (filters: FreelanceTeacherFilters, params: PageParams, signal?: AbortSignal) =>
    http.get<Page<User>>('/freelance-teachers', pageQuery(params, { ...filters }), signal),
  /** `404` for anything but a live freelance teacher. */
  get: (id: string, signal?: AbortSignal) =>
    http.get<User>(`/freelance-teachers/${id}`, undefined, signal),
  /** A freelance teacher with a password, usable at once (no invite). */
  create: (body: CreateFreelanceTeacherRequest) => http.post<User>('/freelance-teachers', body),
  /** Name, email, status; `DISABLED` also revokes every session. */
  update: (id: string, body: UpdateFreelanceTeacherRequest) =>
    http.patch<User>(`/freelance-teachers/${id}`, body),
  /** Cascade: their students deleted, their courses archived, the account soft-deleted. */
  remove: (id: string) => http.delete(`/freelance-teachers/${id}`),
}
