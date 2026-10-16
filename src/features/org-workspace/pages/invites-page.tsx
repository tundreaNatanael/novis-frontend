import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Mail, Plus, Send, XCircle } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { inviteKeys, invitesApi, isPendingInvite } from '@/api/invites'
import type { Invite, StaffRole } from '@/api/types'
import type { RouteHandle } from '@/app/route-handle'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { columnHelper, DataTable } from '@/components/data/data-table'
import { EmptyState } from '@/components/data/empty-state'
import { ListToolbar, matchesQuery } from '@/components/data/list-toolbar'
import { RowActions } from '@/components/row-actions'
import { SectionHeader } from '@/components/section-header'
import { StatusBadge, ToneBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import { formatDate, formatRelative } from '@/lib/format'
import { useListParams } from '@/lib/use-list-params'
import { InviteSheet } from '../components/invite-sheet'
import { useOrgWorkspace } from '../use-org-workspace'

export const handle: RouteHandle = { crumb: () => 'Invites', title: 'Invites' }

type InviteState = 'pending' | 'used' | 'expired'
type Row = Invite & { state: InviteState }

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
    meta: { className: 'w-36' },
  }),
]

export function Component() {
  const { orgId, org, capabilities } = useOrgWorkspace()
  const queryClient = useQueryClient()
  const params = useListParams({ sort: 'createdAt,desc' })
  const [revoking, setRevoking] = useState<Invite | null>(null)
  const [resending, setResending] = useState<Invite | null>(null)
  const initialRole = params.filter('role') as StaffRole | undefined

  const query = useQuery({
    queryKey: inviteKeys.orgList(orgId, params.pageParams),
    queryFn: ({ signal }) => invitesApi.listForOrg(orgId, params.pageParams, signal),
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
        description="Invitations let people choose their own name and password. Pending ones can be revoked; expired ones re-sent. Accounts created directly do not appear here."
      />
      <ListToolbar
        query={params.q}
        onQueryChange={params.setQuery}
        searchPlaceholder="Filter by email…"
        matched={rows.length}
        loaded={query.data?.content.length}
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
                disabledReason: i.state === 'used' ? 'This invitation was already accepted.' : null,
              },
              {
                label: 'Revoke invitation',
                icon: XCircle,
                destructive: true,
                onSelect: () => setRevoking(i),
                disabledReason:
                  i.state === 'pending'
                    ? null
                    : i.state === 'used'
                      ? 'Accepted invitations cannot be revoked.'
                      : 'This invitation has already expired.',
              },
            ]}
          />
        )}
        emptyState={
          <EmptyState
            icon={Mail}
            title={params.q ? 'No invitations match this filter' : 'No invitations yet'}
            description={
              params.q
                ? 'Clear the filter or load another page.'
                : 'Invite a teacher or admin by email, or add them directly from their tab.'
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
        <InviteSheet
          open
          onOpenChange={(open) => !open && setResending(null)}
          email={resending.email}
          initialRole={resending.role as StaffRole}
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
              The link sent to <strong>{revoking.email}</strong> stops working. You can send a new
              invitation at any time.
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
