import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Mail, Plus, Send, XCircle } from 'lucide-react'
import { useId, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { inviteKeys, invitesApi, isPendingInvite } from '@/api/invites'
import type { Invite, InviteFilters, InviteStatus, StaffRole } from '@/api/types'
import type { RouteHandle } from '@/app/route-handle'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { columnHelper, DataTable } from '@/components/data/data-table'
import { EmptyState } from '@/components/data/empty-state'
import { ListToolbar, matchesQuery } from '@/components/data/list-toolbar'
import { SelectField } from '@/components/form/select-field'
import { RowActions } from '@/components/row-actions'
import { SectionHeader } from '@/components/section-header'
import { StatusBadge, ToneBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { formatDate, formatRelative } from '@/lib/format'
import { useListParams } from '@/lib/use-list-params'
import { InviteSheet } from '../components/invite-sheet'
import { useOrgWorkspace } from '../use-org-workspace'

export const handle: RouteHandle = { crumb: () => 'Invites', title: 'Invites' }

type InviteState = 'pending' | 'used' | 'expired'
type Row = Invite & { state: InviteState }

/** `?status=` in the URL; absent means pending (the default view), `ALL` sends no filter. */
type StatusView = InviteStatus | 'ALL'
const STATUS_VIEWS: { value: StatusView; label: string; empty: string }[] = [
  { value: 'PENDING', label: 'Pending', empty: 'No pending invitations' },
  { value: 'EXPIRED', label: 'Expired', empty: 'No expired invitations' },
  { value: 'USED', label: 'Accepted', empty: 'No accepted invitations' },
  { value: 'ALL', label: 'All', empty: 'No invitations yet' },
]

function statusView(value: string | undefined): StatusView {
  return STATUS_VIEWS.find((view) => view.value === value)?.value ?? 'PENDING'
}

function stateOf(invite: Invite): InviteState {
  if (invite.usedAt) return 'used'
  return isPendingInvite(invite) ? 'pending' : 'expired'
}

function InviteStateBadge({ state }: { state: InviteState }) {
  if (state === 'pending') return <ToneBadge tone="info">Pending</ToneBadge>
  if (state === 'used') return <ToneBadge tone="success">Accepted</ToneBadge>
  return <ToneBadge tone="neutral">Expired</ToneBadge>
}

const col = columnHelper<Row>()
const columns = [
  col.accessor('email', {
    header: 'Email',
    cell: (info) => <span className="font-medium text-foreground">{info.getValue()}</span>,
  }),
  col.accessor('role', {
    header: 'Role',
    cell: (info) => <StatusBadge value={info.getValue()} tone="neutral" />,
  }),
  col.accessor('state', {
    header: 'State',
    enableSorting: false,
    cell: (info) => <InviteStateBadge state={info.getValue()} />,
  }),
  col.accessor('expiresAt', {
    header: 'Expires',
    cell: (info) => (
      <span className="text-muted-foreground tabular-nums">
        {info.row.original.usedAt ? '—' : formatRelative(info.getValue())}
      </span>
    ),
  }),
  col.accessor('createdAt', {
    header: 'Sent',
    cell: (info) => (
      <span className="text-muted-foreground tabular-nums">{formatDate(info.getValue())}</span>
    ),
    meta: { className: 'hidden w-36 lg:table-cell', headerClassName: 'hidden lg:table-cell' },
  }),
]

/**
 * `GET /orgs/{orgId}/invites?status=` (pending by default), resend (`POST /invites/{id}/resend`:
 * new link, new expiry) and revoke (`DELETE /invites/{id}`). Admin invitations are listed for
 * admins but only the super-admin acts on them.
 */
export function Component() {
  const { orgId, org, capabilities } = useOrgWorkspace()
  const queryClient = useQueryClient()
  const params = useListParams({ sort: 'createdAt,desc' })
  const statusId = useId()
  const [revoking, setRevoking] = useState<Invite | null>(null)
  const [resending, setResending] = useState<Invite | null>(null)
  const initialRole = params.filter('role') as StaffRole | undefined
  const view = statusView(params.filter('status'))
  const filters = useMemo<InviteFilters>(() => (view === 'ALL' ? {} : { status: view }), [view])

  const query = useQuery({
    queryKey: inviteKeys.orgList(orgId, filters, params.pageParams),
    queryFn: ({ signal }) => invitesApi.listForOrg(orgId, filters, params.pageParams, signal),
    placeholderData: keepPreviousData,
  })
  const rows = useMemo<Row[]>(
    () =>
      (query.data?.content ?? [])
        .map((i) => ({ ...i, state: stateOf(i) }))
        .filter((r) => matchesQuery(r, params.q, [(x) => x.email, (x) => x.role])),
    [query.data, params.q],
  )

  const revoke = useMutation({
    mutationFn: (invite: Invite) => invitesApi.revoke(invite.id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: inviteKeys.org(orgId) })
      toast.success('Invitation revoked')
    },
  })
  const resend = useMutation({
    mutationFn: (invite: Invite) => invitesApi.resend(invite.id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: inviteKeys.org(orgId) })
      toast.success('Invitation sent again', {
        description: 'In development the API logs the link instead of emailing it.',
      })
    },
  })
  const actionReason = (invite: Row, accepted: string) =>
    invite.state === 'used' ? accepted : capabilities.inviteActionDisabledReason(invite)

  const create = capabilities.canManageInvites ? (
    <Button onClick={() => params.setFlag('new', 1)}>
      <Plus aria-hidden />
      Invite by email
    </Button>
  ) : null

  return (
    <div className="flex flex-col gap-4">
      <SectionHeader
        title="Invites"
        description="Invitations let people choose their own name and password. Resending sends a new link (the old one stops working) valid for 7 more days; revoking deletes the invitation. Accounts created directly do not appear here."
      />
      <ListToolbar
        query={params.q}
        onQueryChange={params.setQuery}
        searchPlaceholder="Filter by email…"
        matched={rows.length}
        loaded={query.data?.content.length}
        filters={
          <div className="flex items-center gap-2 sm:w-52">
            <Label htmlFor={statusId} className="shrink-0 text-muted-foreground">
              Status
            </Label>
            <SelectField
              id={statusId}
              value={view}
              onChange={(value) => params.set({ status: value === 'PENDING' ? null : value })}
              options={STATUS_VIEWS.map(({ value, label }) => ({ value, label }))}
            />
          </div>
        }
        actions={create}
      />
      <DataTable
        caption={`Invitations of ${org.name}`}
        columns={columns}
        data={rows}
        total={query.data?.totalElements ?? 0}
        page={params.page}
        size={params.size}
        onPageChange={params.setPage}
        onSizeChange={params.setSize}
        sort={params.sort}
        onSortChange={params.setSort}
        getRowId={(i) => i.id}
        isLoading={query.isPending}
        isFetching={query.isFetching}
        error={query.error}
        onRetry={() => void query.refetch()}
        renderMobileRow={(i) => (
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate font-medium text-foreground">{i.email}</p>
              <p className="truncate text-sm text-muted-foreground">
                {i.role === 'ADMIN' ? 'Admin' : 'Teacher'} ·{' '}
                {i.usedAt ? 'accepted' : `expires ${formatRelative(i.expiresAt)}`}
              </p>
            </div>
            <InviteStateBadge state={i.state} />
          </div>
        )}
        rowActions={(i) => (
          <RowActions
            label={`Actions for ${i.email}`}
            actions={[
              {
                label: 'Resend invitation',
                icon: Send,
                onSelect: () => setResending(i),
                disabledReason: actionReason(i, 'This invitation was already accepted.'),
              },
              {
                label: 'Revoke invitation',
                icon: XCircle,
                destructive: true,
                onSelect: () => setRevoking(i),
                disabledReason: actionReason(i, 'Accepted invitations cannot be revoked.'),
              },
            ]}
          />
        )}
        emptyState={
          <EmptyState
            icon={Mail}
            title={
              params.q
                ? 'No invitations match this filter'
                : (STATUS_VIEWS.find((v) => v.value === view)?.empty ?? 'No invitations yet')
            }
            description={
              params.q
                ? 'Clear the filter or load another page.'
                : capabilities.canManageAdmins
                  ? 'Invite a teacher or admin by email, or add them directly from their tab.'
                  : 'Invite a teacher by email, or add them directly from the Teachers tab.'
            }
            action={params.q ? null : create}
          />
        }
      />
      <InviteSheet
        open={params.filter('new') === '1'}
        onOpenChange={(open) =>
          params.set({
            new: open ? 1 : null,
            role: open ? initialRole : null,
            page: params.page || null,
          })
        }
        initialRole={initialRole}
      />
      {resending ? (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && setResending(null)}
          title="Resend invitation"
          confirmLabel="Send again"
          description={
            <p>
              Sends a new link to <strong>{resending.email}</strong>, valid for 7 days. The link
              sent before stops working.
            </p>
          }
          onConfirm={async () => {
            await resend.mutateAsync(resending)
            setResending(null)
          }}
        />
      ) : null}
      {revoking ? (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && setRevoking(null)}
          title="Revoke invitation"
          destructive
          confirmLabel="Revoke invitation"
          description={
            <p>
              Deletes the invitation of <strong>{revoking.email}</strong>; its link stops working.
              You can send a new invitation at any time.
            </p>
          }
          onConfirm={async () => {
            await revoke.mutateAsync(revoking)
            setRevoking(null)
          }}
        />
      ) : null}
    </div>
  )
}
