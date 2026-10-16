import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ExternalLink, Mail, Plus, Send, Trash2, UserRound, XCircle } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { inviteKeys, invitesApi, isPendingInvite } from '@/api/invites'
import type { Invite, User } from '@/api/types'
import { userKeys, usersApi } from '@/api/users'
import type { RouteHandle } from '@/app/route-handle'
import { useMe } from '@/auth/session'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { columnHelper, DataTable } from '@/components/data/data-table'
import { EmptyState } from '@/components/data/empty-state'
import { ListToolbar, matchesQuery } from '@/components/data/list-toolbar'
import { PageHeader } from '@/components/page-header'
import { RowActions } from '@/components/row-actions'
import { StatusBadge, ToneBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import { formatDate, formatRelative } from '@/lib/format'
import { useListParams } from '@/lib/use-list-params'
import { usePageTitle } from '@/lib/use-page-title'
import { AddFreelanceTeacherSheet } from './components/add-freelance-teacher-sheet'
import { FreelanceInviteSheet } from './components/freelance-invite-sheet'

export const handle: RouteHandle = { title: 'Freelance teachers' }

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

const INVITES = { page: 0, size: 50, sort: 'createdAt,desc' }

/** `GET /users?freelance=true` (gap G5-B) plus the pending freelance invitations (`GET /invites`). */
export function Component() {
  usePageTitle('Freelance teachers')
  const me = useMe()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const params = useListParams({ sort: 'name,asc' })
  const [deleting, setDeleting] = useState<User | null>(null)
  const [revoking, setRevoking] = useState<Invite | null>(null)
  const [resending, setResending] = useState<Invite | null>(null)

  const query = useQuery({
    queryKey: userKeys.list({ freelance: true }, params.pageParams),
    queryFn: ({ signal }) => usersApi.list({ freelance: true }, params.pageParams, signal),
    placeholderData: keepPreviousData,
  })
  const invites = useQuery({
    queryKey: inviteKeys.freelanceList(INVITES),
    queryFn: ({ signal }) => invitesApi.listFreelance(INVITES, signal),
  })
  const rows = useMemo(
    () =>
      (query.data?.content ?? []).filter((u) =>
        matchesQuery(u, params.q, [(r) => r.name, (r) => r.email]),
      ),
    [query.data, params.q],
  )
  const openInvites = (invites.data?.content ?? []).filter((i) => i.usedAt === null)

  const remove = useMutation({
    mutationFn: (teacher: User) => usersApi.remove(teacher.id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: userKeys.all })
      toast.success('Account deleted')
    },
  })
  const revoke = useMutation({
    mutationFn: (invite: Invite) => invitesApi.revoke(invite.id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: inviteKeys.freelance() })
      toast.success('Invitation revoked')
    },
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
        description="Teachers without an organization. They manage their own students, courses and lessons; you see and manage everything here."
        actions={actions}
      />
      <ListToolbar
        query={params.q}
        onQueryChange={params.setQuery}
        searchPlaceholder="Filter by name or email…"
        matched={rows.length}
        loaded={query.data?.content.length}
      />
      <DataTable
        caption="Freelance teachers"
        columns={columns}
        data={rows}
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
              {
                label: 'Delete account',
                icon: Trash2,
                destructive: true,
                separatorBefore: true,
                onSelect: () => setDeleting(u),
                disabledReason: u.id === me.id ? 'You cannot delete your own account.' : null,
              },
            ]}
          />
        )}
        emptyState={
          <EmptyState
            icon={UserRound}
            title={
              params.q ? 'No freelance teachers match this filter' : 'No freelance teachers yet'
            }
            description={
              params.q
                ? 'Clear the filter or load another page.'
                : 'Add one with a password, or invite them by email.'
            }
            action={params.q ? null : actions}
          />
        }
      />
      <section
        className="rounded-lg border border-border bg-card"
        aria-labelledby="freelance-invites"
      >
        <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div>
            <h2 id="freelance-invites" className="text-sm font-semibold text-card-foreground">
              Open invitations{' '}
              {invites.data ? (
                <span className="text-muted-foreground tabular-nums">({openInvites.length})</span>
              ) : null}
            </h2>
            <p className="text-xs text-muted-foreground">
              Freelance-teacher invitations not accepted yet.
            </p>
          </div>
        </header>
        {invites.isPending ? (
          <p className="p-4 text-sm text-muted-foreground">Loading…</p>
        ) : invites.isError ? (
          <p className="p-4 text-sm text-destructive">Could not load invitations.</p>
        ) : openInvites.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">No open invitations.</p>
        ) : (
          <ul className="divide-y divide-border">
            {openInvites.map((invite) => {
              const pending = isPendingInvite(invite)
              return (
                <li
                  key={invite.id}
                  className="flex min-h-12 items-center justify-between gap-3 px-4 py-2 text-sm"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-card-foreground">{invite.email}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      Sent {formatDate(invite.createdAt)} ·{' '}
                      {pending ? `expires ${formatRelative(invite.expiresAt)}` : 'expired'}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {pending ? (
                      <ToneBadge tone="info">Pending</ToneBadge>
                    ) : (
                      <ToneBadge tone="neutral">Expired</ToneBadge>
                    )}
                    <RowActions
                      label={`Actions for invitation to ${invite.email}`}
                      actions={[
                        {
                          label: 'Resend invitation',
                          icon: Send,
                          onSelect: () => setResending(invite),
                        },
                        {
                          label: 'Revoke invitation',
                          icon: XCircle,
                          destructive: true,
                          onSelect: () => setRevoking(invite),
                          disabledReason: pending ? null : 'This invitation has already expired.',
                        },
                      ]}
                    />
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>
      <AddFreelanceTeacherSheet
        open={params.filter('new') === '1'}
        onOpenChange={(open) => params.setFlag('new', open ? 1 : null)}
        onCreated={(t) => navigate(`/platform/freelance/${t.id}`)}
      />
      <FreelanceInviteSheet
        open={params.filter('invite') === '1'}
        onOpenChange={(open) => params.setFlag('invite', open ? 1 : null)}
      />
      {resending ? (
        <FreelanceInviteSheet
          open
          onOpenChange={(open) => !open && setResending(null)}
          email={resending.email}
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
              one at any time.
            </p>
          }
          onConfirm={async () => {
            await revoke.mutateAsync(revoking)
            setRevoking(null)
          }}
        />
      ) : null}
      {deleting ? (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && setDeleting(null)}
          title="Delete account"
          destructive
          confirmLabel="Delete account"
          description={
            <>
              <p>
                Soft-deletes <strong>{deleting.name}</strong>'s account: roster entries and any
                memberships are removed and all their sessions end. Their students keep their own
                accounts.
              </p>
              <p>Lessons and payments are kept as history.</p>
            </>
          }
          onConfirm={async () => {
            await remove.mutateAsync(deleting)
            setDeleting(null)
          }}
        />
      ) : null}
    </div>
  )
}
