import { http } from './client'
import { pageQuery } from './paging'
import type {
  CreateFreelanceInviteRequest,
  CreateInviteRequest,
  Invite,
  InviteFilters,
  Page,
  PageParams,
} from './types'

/**
 * Invites (API.md §6). Invalidation: `createForOrg` / `resend` / `revoke` of an organization
 * invite → `org(orgId)`; `createFreelance` / `resend` / `revoke` of a freelance invite →
 * `freelance()`.
 */
export const inviteKeys = {
  all: ['invites'] as const,
  org: (orgId: string) => [...inviteKeys.all, 'org', orgId] as const,
  orgList: (orgId: string, filters: InviteFilters, params: PageParams) =>
    [...inviteKeys.org(orgId), filters, params] as const,
  freelance: () => [...inviteKeys.all, 'freelance'] as const,
  freelanceList: (filters: InviteFilters, params: PageParams) =>
    [...inviteKeys.freelance(), filters, params] as const,
}

export const invitesApi = {
  listForOrg: (orgId: string, filters: InviteFilters, params: PageParams, signal?: AbortSignal) =>
    http.get<Page<Invite>>(`/orgs/${orgId}/invites`, pageQuery(params, { ...filters }), signal),
  createForOrg: (orgId: string, body: CreateInviteRequest) =>
    http.post<Invite>(`/orgs/${orgId}/invites`, body),
  /** Org-less (freelance-teacher) invites; super-admin only. */
  listFreelance: (filters: InviteFilters, params: PageParams, signal?: AbortSignal) =>
    http.get<Page<Invite>>('/invites', pageQuery(params, { ...filters }), signal),
  createFreelance: (body: CreateFreelanceInviteRequest) => http.post<Invite>('/invites', body),
  /** Unused invites only: a new token (the old link stops working), a fresh expiry, the email again. */
  resend: (inviteId: string) => http.post<Invite>(`/invites/${inviteId}/resend`),
  revoke: (inviteId: string) => http.delete(`/invites/${inviteId}`),
}

/** An invite that can still be accepted. */
export function isPendingInvite(invite: Invite, now = Date.now()): boolean {
  return invite.usedAt === null && Date.parse(invite.expiresAt) > now
}
