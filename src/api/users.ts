import { http, request } from './client'
import { pageQuery } from './paging'
import type {
  DeleteOwnAccountRequest,
  Page,
  PageParams,
  UpdateUserRequest,
  User,
  UserFilters,
} from './types'

/**
 * Users (API.md §5). Invalidation: `update` → `detail(id)` + `me` (when self) + every list;
 * `remove` → every user key plus the member lists of the organizations involved; `deleteMe` → none
 * (the caller's session ends: `signOut({ revoked: true })` clears the cache). Freelance teachers have
 * their own module (`freelance-teachers.ts`).
 */
export const userKeys = {
  all: ['users'] as const,
  me: () => [...userKeys.all, 'me'] as const,
  lists: () => [...userKeys.all, 'list'] as const,
  list: (filters: UserFilters, params: PageParams) =>
    [...userKeys.lists(), filters, params] as const,
  detail: (id: string) => [...userKeys.all, 'detail', id] as const,
}

export const usersApi = {
  me: (signal?: AbortSignal) => http.get<User>('/users/me', undefined, signal),
  list: (filters: UserFilters, params: PageParams, signal?: AbortSignal) =>
    http.get<Page<User>>('/users', pageQuery(params, { ...filters }), signal),
  get: (id: string, signal?: AbortSignal) => http.get<User>(`/users/${id}`, undefined, signal),
  update: (id: string, body: UpdateUserRequest) => http.patch<User>(`/users/${id}`, body),
  remove: (id: string) => http.delete(`/users/${id}`),
  /** The caller's own account; `http.delete` sends no body, so it goes through `request`. */
  deleteMe: (body: DeleteOwnAccountRequest) =>
    request<void>('/users/me', { method: 'DELETE', body }),
}
