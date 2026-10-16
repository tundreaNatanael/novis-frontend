import { useOutletContext } from 'react-router'
import type { Organization, User } from '@/api/types'
import type { Capabilities } from '@/lib/permissions'

/** What every tab of the organization workspace receives from its layout. */
export interface OrgWorkspaceContext {
  kind: 'org'
  org: Organization
  orgId: string
  /** `/platform/orgs/:orgId` or `/org/:orgId`, for links inside the workspace. */
  basePath: string
  mount: 'platform' | 'org'
  capabilities: Capabilities
}

/** What the freelance-teacher workspace provides to the shared detail pages (phase 3). */
export interface FreelanceWorkspaceContext {
  kind: 'freelance'
  teacher: User
  teacherId: string
  basePath: string
  capabilities: Capabilities
}

export type WorkspaceScope = OrgWorkspaceContext | FreelanceWorkspaceContext

export function useOrgWorkspace(): OrgWorkspaceContext {
  const context = useOutletContext<WorkspaceScope | undefined>()
  if (!context || context.kind !== 'org')
    throw new Error('useOrgWorkspace used outside the organization workspace')
  return context
}

/** Detail pages shared by the organization and freelance workspaces read the scope they are in. */
export function useWorkspaceScope(): WorkspaceScope {
  const context = useOutletContext<WorkspaceScope | undefined>()
  if (!context) throw new Error('useWorkspaceScope used outside a workspace')
  return context
}
