import { useQuery } from '@tanstack/react-query'
import { Archive, ArchiveRestore, Pencil } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { courseKeys, coursesApi } from '@/api/courses'
import { inviteKeys, invitesApi } from '@/api/invites'
import { memberKeys, membersApi } from '@/api/members'
import type { MembershipRole } from '@/api/types'
import type { RouteHandle } from '@/app/route-handle'
import {
  DetailField,
  DetailPanel,
  EnumValue,
  IdValue,
  TimeValue,
} from '@/components/detail/detail-panel'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ArchiveOrgDialog, RestoreOrgDialog } from '../components/org-status-dialogs'
import { OrgFormSheet } from '../components/org-form-sheet'
import { useOrgWorkspace } from '../use-org-workspace'

export const handle: RouteHandle = { title: 'Overview' }

const ONE = { page: 0, size: 1 }

function useCount(
  key: readonly unknown[],
  fetcher: (signal: AbortSignal) => Promise<{ totalElements: number }>,
) {
  return useQuery({
    queryKey: key,
    queryFn: ({ signal }) => fetcher(signal),
    select: (page) => page.totalElements,
  })
}

function useMemberCount(orgId: string, role: MembershipRole) {
  return useCount(memberKeys.list(orgId, role, ONE), (signal) =>
    membersApi.list(orgId, role, ONE, signal),
  )
}

export function Component() {
  const { org, orgId, basePath, capabilities } = useOrgWorkspace()
  const [editing, setEditing] = useState(false)
  const [archiving, setArchiving] = useState(false)
  const [restoring, setRestoring] = useState(false)

  const admins = useMemberCount(orgId, 'ADMIN')
  const teachers = useMemberCount(orgId, 'TEACHER')
  const students = useMemberCount(orgId, 'STUDENT')
  const courses = useCount(courseKeys.list({ organizationId: orgId }, ONE), (signal) =>
    coursesApi.list({ organizationId: orgId }, ONE, signal),
  )
  const invites = useCount(inviteKeys.orgList(orgId, ONE), (signal) =>
    invitesApi.listForOrg(orgId, ONE, signal),
  )

  const counts = [
    capabilities.canManageAdmins
      ? { label: 'Admins', value: admins.data, to: `${basePath}/admins` }
      : null,
    { label: 'Teachers', value: teachers.data, to: `${basePath}/teachers` },
    { label: 'Students', value: students.data, to: `${basePath}/students` },
    { label: 'Courses', value: courses.data, to: `${basePath}/courses` },
    { label: 'Invites', value: invites.data, to: `${basePath}/invites` },
  ].filter((c): c is NonNullable<typeof c> => c !== null)

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <div className="flex flex-col gap-5">
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5" aria-label="Counts">
          {counts.map((count) => (
            <li key={count.label}>
              <Link
                to={count.to}
                className="flex h-full flex-col gap-1 rounded-lg border border-border bg-card p-3 hover:border-primary/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                <span className="text-xs text-muted-foreground">{count.label}</span>
                {count.value === undefined ? (
                  <Skeleton className="h-7 w-10" />
                ) : (
                  <span className="text-2xl font-semibold text-card-foreground tabular-nums">
                    {count.value}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
        <DetailPanel
          title="Details"
          description="Every field the API returns for this organization."
          actions={
            capabilities.canEditOrganization && org.status === 'ACTIVE' ? (
              <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                <Pencil aria-hidden />
                Edit
              </Button>
            ) : null
          }
        >
          <DetailField label="Id">
            <IdValue value={org.id} />
          </DetailField>
          <DetailField label="Name">{org.name}</DetailField>
          <DetailField label="Slug">
            <code className="font-mono text-xs">{org.slug}</code>
          </DetailField>
          <DetailField label="Status">
            <EnumValue value={org.status} />
          </DetailField>
          <DetailField label="Created">
            <TimeValue value={org.createdAt} />
          </DetailField>
          <DetailField label="Updated">
            <TimeValue value={org.updatedAt} />
          </DetailField>
        </DetailPanel>
      </div>
      {capabilities.canChangeOrgStatus ? (
        <section
          className="h-fit rounded-lg border border-destructive/40 bg-card"
          aria-labelledby="danger-zone"
        >
          <header className="border-b border-destructive/30 px-4 py-3">
            <h2 id="danger-zone" className="text-sm font-semibold text-card-foreground">
              Danger zone
            </h2>
          </header>
          <div className="flex flex-col gap-3 px-4 py-3 text-sm">
            {org.status === 'ACTIVE' ? (
              <>
                <p className="text-muted-foreground">
                  Archiving stops every membership from granting access. Nothing is deleted; you can
                  restore later.
                </p>
                <div>
                  <Button variant="destructive" size="sm" onClick={() => setArchiving(true)}>
                    <Archive aria-hidden />
                    Archive organization
                  </Button>
                </div>
              </>
            ) : (
              <>
                <p className="text-muted-foreground">
                  Restoring makes existing memberships grant access again.
                </p>
                <div>
                  <Button variant="outline" size="sm" onClick={() => setRestoring(true)}>
                    <ArchiveRestore aria-hidden />
                    Restore organization
                  </Button>
                </div>
              </>
            )}
          </div>
        </section>
      ) : null}
      <OrgFormSheet open={editing} onOpenChange={setEditing} org={org} />
      <ArchiveOrgDialog org={org} open={archiving} onOpenChange={setArchiving} />
      <RestoreOrgDialog org={org} open={restoring} onOpenChange={setRestoring} />
    </div>
  )
}
