import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Archive, ArchiveRestore, Building2, ExternalLink, Pencil, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { orgKeys, orgsApi } from '@/api/orgs'
import type { Organization } from '@/api/types'
import type { RouteHandle } from '@/app/route-handle'
import { columnHelper, DataTable } from '@/components/data/data-table'
import { EmptyState } from '@/components/data/empty-state'
import { ListToolbar, matchesQuery } from '@/components/data/list-toolbar'
import { PageHeader } from '@/components/page-header'
import { RowActions } from '@/components/row-actions'
import { StatusBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import {
  ArchiveOrgDialog,
  RestoreOrgDialog,
} from '@/features/org-workspace/components/org-status-dialogs'
import { OrgFormSheet } from '@/features/org-workspace/components/org-form-sheet'
import { formatDate } from '@/lib/format'
import { useListParams } from '@/lib/use-list-params'
import { usePageTitle } from '@/lib/use-page-title'

export const handle: RouteHandle = { title: 'Organizations' }

const col = columnHelper<Organization>()
const columns = [
  col.accessor('name', {
    header: 'Name',
    cell: (info) => <span className="font-medium text-foreground">{info.getValue()}</span>,
  }),
  col.accessor('slug', {
    header: 'Slug',
    cell: (info) => (
      <code className="font-mono text-xs text-muted-foreground">{info.getValue()}</code>
    ),
  }),
  col.accessor('status', {
    header: 'Status',
    cell: (info) => <StatusBadge value={info.getValue()} />,
  }),
  col.accessor('createdAt', {
    header: 'Created',
    cell: (info) => (
      <span className="text-muted-foreground tabular-nums">{formatDate(info.getValue())}</span>
    ),
    meta: { className: 'w-36' },
  }),
]

export function Component() {
  usePageTitle('Organizations')
  const navigate = useNavigate()
  const params = useListParams({ sort: 'name,asc' })
  const [editing, setEditing] = useState<Organization | null>(null)
  const [archiving, setArchiving] = useState<Organization | null>(null)
  const [restoring, setRestoring] = useState<Organization | null>(null)
  const creating = params.filter('new') === '1'

  const query = useQuery({
    queryKey: orgKeys.list(params.pageParams),
    queryFn: ({ signal }) => orgsApi.list(params.pageParams, signal),
    placeholderData: keepPreviousData,
  })

  const rows = useMemo(
    () =>
      (query.data?.content ?? []).filter((org) =>
        matchesQuery(org, params.q, [(o) => o.name, (o) => o.slug]),
      ),
    [query.data, params.q],
  )

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Organizations"
        description="Schools on the platform. Open one to manage its admins, teachers, students, courses and invites."
        actions={
          <Button onClick={() => params.setFlag('new', 1)}>
            <Plus aria-hidden />
            New organization
          </Button>
        }
      />
      <ListToolbar
        query={params.q}
        onQueryChange={params.setQuery}
        searchPlaceholder="Filter by name or slug…"
        matched={rows.length}
        loaded={query.data?.content.length}
      />
      <DataTable
        caption="Organizations"
        columns={columns}
        data={rows}
        total={query.data?.totalElements ?? 0}
        page={params.page}
        size={params.size}
        onPageChange={params.setPage}
        onSizeChange={params.setSize}
        sort={params.sort}
        onSortChange={params.setSort}
        getRowId={(org) => org.id}
        rowHref={(org) => `/platform/orgs/${org.id}`}
        isLoading={query.isPending}
        isFetching={query.isFetching}
        error={query.error}
        onRetry={() => void query.refetch()}
        renderMobileRow={(org) => (
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate font-medium text-foreground">{org.name}</p>
              <p className="truncate font-mono text-xs text-muted-foreground">{org.slug}</p>
            </div>
            <StatusBadge value={org.status} />
          </div>
        )}
        rowActions={(org) => (
          <RowActions
            label={`Actions for ${org.name}`}
            actions={[
              {
                label: 'Open',
                icon: ExternalLink,
                onSelect: () => navigate(`/platform/orgs/${org.id}`),
              },
              {
                label: 'Edit',
                icon: Pencil,
                onSelect: () => setEditing(org),
                disabledReason:
                  org.status === 'ARCHIVED' ? 'Restore the organization before editing it.' : null,
              },
              org.status === 'ACTIVE'
                ? {
                    label: 'Archive organization',
                    icon: Archive,
                    destructive: true,
                    separatorBefore: true,
                    onSelect: () => setArchiving(org),
                  }
                : {
                    label: 'Restore organization',
                    icon: ArchiveRestore,
                    separatorBefore: true,
                    onSelect: () => setRestoring(org),
                  },
            ]}
          />
        )}
        emptyState={
          <EmptyState
            icon={Building2}
            title={params.q ? 'No organizations match this filter' : 'No organizations yet'}
            description={
              params.q
                ? 'Clear the filter or load another page.'
                : 'Create the first school; you can add its admins and teachers right after.'
            }
            action={
              params.q ? null : (
                <Button onClick={() => params.setFlag('new', 1)}>
                  <Plus aria-hidden />
                  New organization
                </Button>
              )
            }
          />
        }
      />
      <OrgFormSheet
        open={creating}
        onOpenChange={(open) => params.setFlag('new', open ? 1 : null)}
        onSaved={(org) => navigate(`/platform/orgs/${org.id}`)}
      />
      <OrgFormSheet
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        org={editing ?? undefined}
      />
      {archiving ? (
        <ArchiveOrgDialog
          org={archiving}
          open
          onOpenChange={(open) => !open && setArchiving(null)}
        />
      ) : null}
      {restoring ? (
        <RestoreOrgDialog
          org={restoring}
          open
          onOpenChange={(open) => !open && setRestoring(null)}
        />
      ) : null}
    </div>
  )
}
