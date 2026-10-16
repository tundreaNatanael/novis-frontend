import { http } from './client'
import { pageQuery } from './paging'
import type {
  CreateOrganizationRequest,
  Organization,
  Page,
  PageParams,
  UpdateOrganizationRequest,
} from './types'

/**
 * Organizations (API.md §6). Invalidation: `create` → `lists()`; `update` / `archive` →
 * `detail(id)` + `lists()`; archiving also invalidates `userKeys.me()` for admins of that org.
 */
export const orgKeys = {
  all: ['orgs'] as const,
  lists: () => [...orgKeys.all, 'list'] as const,
  list: (params: PageParams) => [...orgKeys.lists(), params] as const,
  detail: (id: string) => [...orgKeys.all, 'detail', id] as const,
}

export const orgsApi = {
  list: (params: PageParams, signal?: AbortSignal) =>
    http.get<Page<Organization>>('/orgs', pageQuery(params), signal),
  get: (id: string, signal?: AbortSignal) =>
    http.get<Organization>(`/orgs/${id}`, undefined, signal),
  create: (body: CreateOrganizationRequest) => http.post<Organization>('/orgs', body),
  update: (id: string, body: UpdateOrganizationRequest) =>
    http.patch<Organization>(`/orgs/${id}`, body),
  /** Archives (there is no hard delete); restore with `update(id, { status: 'ACTIVE' })`. */
  archive: (id: string) => http.delete(`/orgs/${id}`),
}
