import { http } from './client'
import { pageQuery } from './paging'
import type {
  CreateFreelanceInviteRequest,
  CreateInviteRequest,
  Invite,
  Page,
  PageParams,
} from './types'

/**
 * Invites (API.md §6). Invalidation: `createForOrg` / `revoke` → `org(orgId)`;
 * `createFreelance` / `revoke` of a freelance invite → `freelance()`.
 */
export const inviteKeys = {
  all: ['invites'] as const,
  org: (orgId: string) => [...inviteKeys.all, 'org', orgId] as const,
  orgList: (orgId: string, params: PageParams) => [...inviteKeys.org(orgId), params] as const,
  freelance: () => [...inviteKeys.all, 'freelance'] as const,
  freelanceList: (params: PageParams) => [...inviteKeys.freelance(), params] as const,
}

export const invitesApi = {
  listForOrg: (orgId: string, params: PageParams, signal?: AbortSignal) =>
    http.get<Page<Invite>>(`/orgs/${orgId}/invites`, pageQuery(params), signal),
  createForOrg: (orgId: string, body: CreateInviteRequest) =>
    http.post<Invite>(`/orgs/${orgId}/invites`, body),
  listFreelance: (params: PageParams, signal?: AbortSignal) =>
    http.get<Page<Invite>>('/invites', pageQuery(params), signal),
  createFreelance: (body: CreateFreelanceInviteRequest) => http.post<Invite>('/invites', body),
  revoke: (inviteId: string) => http.delete(`/invites/${inviteId}`),
}

/** An invite that can still be accepted. */
export function isPendingInvite(invite: Invite, now = Date.now()): boolean {
  return invite.usedAt === null && Date.parse(invite.expiresAt) > now
}
