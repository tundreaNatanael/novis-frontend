import { http } from './client'
import { pageQuery } from './paging'
import type {
  AddMembershipRequest,
  CreateStaffRequest,
  Member,
  MembershipRole,
  Page,
  PageParams,
} from './types'

/**
 * Memberships and staff (API.md §6). Invalidation: `createStaff` / `add` → `list(orgId, role)` for
 * the role (and `null` role); `remove` → every member list of the organization + `userKeys.detail`.
 */
export const memberKeys = {
  all: ['members'] as const,
  org: (orgId: string) => [...memberKeys.all, orgId] as const,
  list: (orgId: string, role: MembershipRole | null, params: PageParams) =>
    [...memberKeys.org(orgId), role ?? 'any', params] as const,
}

export const membersApi = {
  list: (orgId: string, role: MembershipRole | null, params: PageParams, signal?: AbortSignal) =>
    http.get<Page<Member>>(`/orgs/${orgId}/members`, pageQuery(params, { role }), signal),
  /** Creates the password account and the membership in one step (gap G1, option B). */
  createStaff: (orgId: string, body: CreateStaffRequest) =>
    http.post<Member>(`/orgs/${orgId}/staff`, body),
  /** Grants a role to an existing account. */
  add: (orgId: string, body: AddMembershipRequest) =>
    http.post<Member>(`/orgs/${orgId}/memberships`, body),
  remove: (membershipId: string) => http.delete(`/memberships/${membershipId}`),
}
