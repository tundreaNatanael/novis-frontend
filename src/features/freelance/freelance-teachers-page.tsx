import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Ban, CircleCheck, ExternalLink, Mail, Plus, Trash2, UserRound } from 'lucide-react'
import { useId, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { freelanceTeacherKeys, freelanceTeachersApi } from '@/api/freelance-teachers'
import type { FreelanceTeacherFilters, User, UserStatus } from '@/api/types'
import type { RouteHandle } from '@/app/route-handle'
import { columnHelper, DataTable } from '@/components/data/data-table'
import { EmptyState } from '@/components/data/empty-state'
import { ListToolbar } from '@/components/data/list-toolbar'
import { SelectField } from '@/components/form/select-field'
import { PageHeader } from '@/components/page-header'
import { RowActions } from '@/components/row-actions'
import { StatusBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { formatDate } from '@/lib/format'
import { useDebouncedValue } from '@/lib/use-debounced-value'
import { useListParams } from '@/lib/use-list-params'
import { usePageTitle } from '@/lib/use-page-title'
import { AddFreelanceTeacherSheet } from './components/add-freelance-teacher-sheet'
import { DeleteFreelanceTeacherDialog } from './components/delete-freelance-teacher-dialog'
import { FreelanceInviteSheet } from './components/freelance-invite-sheet'
import { FreelanceStatusDialog } from './components/freelance-status-dialog'
import { PendingFreelanceInvites } from './components/pending-freelance-invites'

export const handle: RouteHandle = { title: 'Freelance teachers' }

/** `?status=` in the URL; absent means every status. */
type StatusView = UserStatus | 'ALL'
const STATUS_VIEWS: { value: StatusView; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'DISABLED', label: 'Disabled' },
]

function statusView(value: string | undefined): StatusView {
  return STATUS_VIEWS.find((view) => view.value === value)?.value ?? 'ALL'
}

const col = columnHelper<User>()
const columns = [
  col.accessor('name', {
    header: 'Name',
    cell: (info) => <span className="font-medium text-foreground">{info.getValue()}</span>,
  }),
  col.accessor('email', {
    header: 'Email',
    cell: (info) => <span className="text-muted-foreground">{info.getValue()}</span>,
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
    meta: { className: 'hidden w-36 lg:table-cell', headerClassName: 'hidden lg:table-cell' },
  }),
]

/**
 * `GET /freelance-teachers?q=&status=` (super-admin only): the server searches name and email
 * and filters by status. Add with a password, invite by email, disable / re-enable and delete
 * (with its cascade) from here; the pending invitations sit below the list.
 */
export function Component() {
  usePageTitle('Freelance teachers')
  const navigate = useNavigate()
  const params = useListParams({ sort: 'name,asc' })
  const statusId = useId()
  const [statusChange, setStatusChange] = useState<User | null>(null)
  const [deleting, setDeleting] = useState<User | null>(null)
  const view = statusView(params.filter('status'))
  const q = useDebouncedValue(params.q.trim())
  const filters = useMemo<FreelanceTeacherFilters>(
    () => ({ ...(q ? { q } : {}), ...(view === 'ALL' ? {} : { status: view }) }),
    [q, view],
  )
  const filtered = !!q || view !== 'ALL'
  const invitesPage = Math.max(0, Number.parseInt(params.filter('invitesPage') ?? '0', 10) || 0)

  const query = useQuery({
    queryKey: freelanceTeacherKeys.list(filters, params.pageParams),
    queryFn: ({ signal }) => freelanceTeachersApi.list(filters, params.pageParams, signal),
    placeholderData: keepPreviousData,
  })

  const actions = (
    <>
      <Button variant="outline" onClick={() => params.setFlag('invite', 1)}>
        <Mail aria-hidden />
        Invite by email
      </Button>
      <Button onClick={() => params.setFlag('new', 1)}>
        <Plus aria-hidden />
        Add freelance teacher
      </Button>
    </>
  )

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Freelance teachers"
        description="Teachers without an organization, managed by the platform owner only. They run their own students, courses and lessons in the Novis app; you see and manage everything here."
        actions={actions}
      />
      <ListToolbar
        query={params.q}
        onQueryChange={params.setQuery}
        searchPlaceholder="Search name or email…"
        filters={
          <div className="flex items-center gap-2 sm:w-48">
            <Label htmlFor={statusId} className="shrink-0 text-muted-foreground">
              Status
            </Label>
            <SelectField
              id={statusId}
              value={view}
              onChange={(value) => params.set({ status: value === 'ALL' ? null : value })}
              options={STATUS_VIEWS}
            />
          </div>
        }
      />
      <DataTable
        caption="Freelance teachers"
        columns={columns}
        data={query.data?.content ?? []}
        total={query.data?.totalElements ?? 0}
        page={params.page}
        size={params.size}
        onPageChange={params.setPage}
        onSizeChange={params.setSize}
        sort={params.sort}
        onSortChange={params.setSort}
        getRowId={(u) => u.id}
        rowHref={(u) => `/platform/freelance/${u.id}`}
        isLoading={query.isPending}
        isFetching={query.isFetching}
        error={query.error}
        onRetry={() => void query.refetch()}
        renderMobileRow={(u) => (
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate font-medium text-foreground">{u.name}</p>
              <p className="truncate text-sm text-muted-foreground">{u.email}</p>
            </div>
            <StatusBadge value={u.status} />
          </div>
        )}
        rowActions={(u) => (
          <RowActions
            label={`Actions for ${u.name}`}
            actions={[
              {
                label: 'Open',
                icon: ExternalLink,
                onSelect: () => navigate(`/platform/freelance/${u.id}`),
              },
              u.status === 'ACTIVE'
                ? { label: 'Disable account', icon: Ban, onSelect: () => setStatusChange(u) }
                : {
                    label: 'Re-enable account',
                    icon: CircleCheck,
                    onSelect: () => setStatusChange(u),
                  },
              {
                label: 'Delete freelance teacher',
                icon: Trash2,
                destructive: true,
                separatorBefore: true,
                onSelect: () => setDeleting(u),
              },
            ]}
          />
        )}
        emptyState={
          <EmptyState
            icon={UserRound}
            title={filtered ? 'No freelance teachers match' : 'No freelance teachers yet'}
            description={
              filtered
                ? 'Change the search or the status filter.'
                : 'Add one with a password, or invite them by email.'
            }
            action={filtered ? null : actions}
          />
        }
      />
      <PendingFreelanceInvites
        page={invitesPage}
        onPageChange={(next) =>
          params.set({ invitesPage: next > 0 ? next : null, page: params.page || null })
        }
      />
      <AddFreelanceTeacherSheet
        open={params.filter('new') === '1'}
        onOpenChange={(open) => params.setFlag('new', open ? 1 : null)}
        onCreated={(t) => navigate(`/platform/freelance/${t.id}`)}
      />
      <FreelanceInviteSheet
        open={params.filter('invite') === '1'}
        onOpenChange={(open) => params.setFlag('invite', open ? 1 : null)}
      />
      {statusChange ? (
        <FreelanceStatusDialog
          teacher={statusChange}
          open
          onOpenChange={(open) => !open && setStatusChange(null)}
        />
      ) : null}
      {deleting ? (
        <DeleteFreelanceTeacherDialog
          teacher={deleting}
          open
          onOpenChange={(open) => !open && setDeleting(null)}
        />
      ) : null}
    </div>
  )
}
