import { useQuery } from '@tanstack/react-query'
import { Archive } from 'lucide-react'
import { useMemo } from 'react'
import { Outlet, useMatch, useParams } from 'react-router'
import { orgKeys, orgsApi } from '@/api/orgs'
import type { RouteHandle } from '@/app/route-handle'
import { PageSkeleton } from '@/app/shell/app-shell'
import { useMe } from '@/auth/session'
import { ErrorState } from '@/components/data/error-state'
import { IdValue } from '@/components/detail/detail-panel'
import { NavTabs, type NavTab } from '@/components/nav-tabs'
import { PageHeader } from '@/components/page-header'
import { StatusBadge } from '@/components/status-badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { deriveCapabilities } from '@/lib/permissions'
import { usePageTitle } from '@/lib/use-page-title'
import { OrgCrumb } from './org-crumb'
import type { OrgWorkspaceContext } from './use-org-workspace'

export const handle: RouteHandle = { crumb: (params) => <OrgCrumb orgId={params.orgId} /> }

/**
 * The organization workspace, built once and mounted at `/platform/orgs/:orgId/*` (super-admin)
 * and `/org/:orgId/*` (admins). Tabs a role cannot use are not rendered.
 */
export function Component() {
  const { orgId = '' } = useParams<{ orgId: string }>()
  const me = useMe()
  const platformMatch = useMatch('/platform/orgs/:orgId/*')
  const mount: OrgWorkspaceContext['mount'] = platformMatch ? 'platform' : 'org'
  const basePath = mount === 'platform' ? `/platform/orgs/${orgId}` : `/org/${orgId}`
  const capabilities = useMemo(() => deriveCapabilities(me, orgId), [me, orgId])

  const orgQuery = useQuery({
    queryKey: orgKeys.detail(orgId),
    queryFn: ({ signal }) => orgsApi.get(orgId, signal),
  })
  usePageTitle(orgQuery.data?.name)

  if (orgQuery.isPending) return <PageSkeleton />
  if (orgQuery.isError)
    return <ErrorState error={orgQuery.error} onRetry={() => void orgQuery.refetch()} />
  const org = orgQuery.data

  const tabs: NavTab[] = [{ label: 'Overview', to: basePath, end: true }]
  if (capabilities.canManageAdmins) tabs.push({ label: 'Admins', to: `${basePath}/admins` })
  tabs.push(
    { label: 'Teachers', to: `${basePath}/teachers` },
    { label: 'Students', to: `${basePath}/students` },
    { label: 'Courses', to: `${basePath}/courses` },
    { label: 'Invites', to: `${basePath}/invites` },
  )
  if (capabilities.canManageLessons) tabs.push({ label: 'Lessons', to: `${basePath}/lessons` })
  if (capabilities.canViewFinance) tabs.push({ label: 'Finance', to: `${basePath}/finance` })

  const context: OrgWorkspaceContext = { kind: 'org', org, orgId, basePath, mount, capabilities }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={org.name}
        badge={<StatusBadge value={org.status} />}
        meta={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <code className="font-mono text-xs">{org.slug}</code>
            <IdValue value={org.id} />
          </span>
        }
      />
      {org.status === 'ARCHIVED' ? (
        <Alert>
          <Archive aria-hidden />
          <AlertTitle>This organization is archived</AlertTitle>
          <AlertDescription>
            Memberships in it grant no access and nothing new can be added to it. Courses, lessons
            and payments are kept.
            {capabilities.canChangeOrgStatus
              ? ' Restore it from the Overview tab.'
              : ' The platform owner can restore it.'}
          </AlertDescription>
        </Alert>
      ) : null}
      <NavTabs items={tabs} label="Organization sections" />
      <Outlet context={context} />
    </div>
  )
}
