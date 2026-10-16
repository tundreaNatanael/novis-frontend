import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ExternalLink, Trash2, UserMinus, Users } from 'lucide-react'
import { type ReactNode, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { memberKeys, membersApi } from '@/api/members'
import { studentKeys, studentsApi } from '@/api/students'
import type { Member, MembershipRole } from '@/api/types'
import { userKeys, usersApi } from '@/api/users'
import { useMe } from '@/auth/session'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { columnHelper, DataTable } from '@/components/data/data-table'
import { EmptyState } from '@/components/data/empty-state'
import { ListToolbar, matchesQuery } from '@/components/data/list-toolbar'
import { RowActions } from '@/components/row-actions'
import { formatDate } from '@/lib/format'
import { useListParams } from '@/lib/use-list-params'
import { useOrgWorkspace } from '../use-org-workspace'

const col = columnHelper<Member>()
const columns = [
  col.accessor('name', {
    header: 'Name',
    enableSorting: false,
    cell: (info) => <span className="font-medium text-foreground">{info.getValue()}</span>,
  }),
  col.accessor('email', {
    header: 'Email',
    enableSorting: false,
    cell: (info) => <span className="text-muted-foreground">{info.getValue()}</span>,
  }),
  col.accessor('createdAt', {
    header: 'Joined',
    cell: (info) => (
      <span className="text-muted-foreground tabular-nums">{formatDate(info.getValue())}</span>
    ),
    meta: { className: 'w-36' },
  }),
]

interface MembersTableProps {
  role: MembershipRole
  /** URL segment of the detail pages: `admins`, `teachers`, `students`. */
  segment: string
  singular: string
  plural: string
  /** The create button, rendered in the toolbar and the empty state. */
  createAction?: ReactNode
}

/**
 * People of one role in the organization (`GET /orgs/{orgId}/members?role=`). Lists sort by
 * join date only (gap G14); the status lives on the detail page.
 */
export function MembersTable({ role, segment, singular, plural, createAction }: MembersTableProps) {
  const { orgId, org, basePath, capabilities } = useOrgWorkspace()
  const me = useMe()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const params = useListParams({ sort: 'createdAt,asc' })
  const [removing, setRemoving] = useState<Member | null>(null)
  const [deleting, setDeleting] = useState<Member | null>(null)

  const query = useQuery({
    queryKey: memberKeys.list(orgId, role, params.pageParams),
    queryFn: ({ signal }) => membersApi.list(orgId, role, params.pageParams, signal),
    placeholderData: keepPreviousData,
  })
  const rows = useMemo(
    () =>
      (query.data?.content ?? []).filter((m) =>
        matchesQuery(m, params.q, [(r) => r.name, (r) => r.email]),
      ),
    [query.data, params.q],
  )

  const invalidatePeople = async (userId: string) => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: memberKeys.org(orgId) }),
      queryClient.invalidateQueries({ queryKey: userKeys.detail(userId) }),
      queryClient.invalidateQueries({ queryKey: studentKeys.all }),
    ])
  }

  const removeMembership = useMutation({
    mutationFn: (member: Member) => membersApi.remove(member.membershipId),
    onSuccess: (_result, member) => invalidatePeople(member.userId),
  })
  const deleteAccount = useMutation({
    mutationFn: (member: Member) =>
      role === 'STUDENT' ? studentsApi.remove(member.userId) : usersApi.remove(member.userId),
    onSuccess: (_result, member) => invalidatePeople(member.userId),
  })

  const isSelf = (member: Member) => member.userId === me.id
  const removeDisabledReason = (member: Member) =>
    capabilities.removeMembershipDisabledReason({
      userId: member.userId,
      organizationId: orgId,
      role,
    })
  const deleteDisabledReason = (member: Member) =>
    isSelf(member) ? 'You cannot delete your own account.' : null

  const roleLabel = singular.toLowerCase()

  return (
    <div className="flex flex-col gap-3">
      <ListToolbar
        query={params.q}
        onQueryChange={params.setQuery}
        searchPlaceholder={`Filter ${plural.toLowerCase()} by name or email…`}
        matched={rows.length}
        loaded={query.data?.content.length}
        actions={createAction}
      />
      <DataTable
        caption={`${plural} of ${org.name}`}
        columns={columns}
        data={rows}
        total={query.data?.totalElements ?? 0}
        page={params.page}
        size={params.size}
        onPageChange={params.setPage}
        onSizeChange={params.setSize}
        sort={params.sort}
        onSortChange={params.setSort}
        getRowId={(m) => m.membershipId}
        rowHref={(m) => `${basePath}/${segment}/${m.userId}`}
        isLoading={query.isPending}
        isFetching={query.isFetching}
        error={query.error}
        onRetry={() => void query.refetch()}
        renderMobileRow={(m) => (
          <div className="min-w-0">
            <p className="truncate font-medium text-foreground">{m.name}</p>
            <p className="truncate text-sm text-muted-foreground">{m.email}</p>
          </div>
        )}
        rowActions={(m) => (
          <RowActions
            label={`Actions for ${m.name}`}
            actions={[
              {
                label: 'Open',
                icon: ExternalLink,
                onSelect: () => navigate(`${basePath}/${segment}/${m.userId}`),
              },
              {
                label: 'Remove from this organization',
                icon: UserMinus,
                destructive: true,
                separatorBefore: true,
                onSelect: () => setRemoving(m),
                disabledReason: removeDisabledReason(m),
              },
              {
                label: role === 'STUDENT' ? 'Delete student account' : 'Delete account',
                icon: Trash2,
                destructive: true,
                onSelect: () => setDeleting(m),
                disabledReason: deleteDisabledReason(m),
              },
            ]}
          />
        )}
        emptyState={
          <EmptyState
            icon={Users}
            title={
              params.q
                ? `No ${plural.toLowerCase()} match this filter`
                : `No ${plural.toLowerCase()} yet`
            }
            description={
              params.q
                ? 'Clear the filter or load another page.'
                : `Add the first ${roleLabel} of ${org.name}.`
            }
            action={params.q ? null : createAction}
          />
        }
      />
      {removing ? (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && setRemoving(null)}
          title="Remove from this organization"
          destructive
          confirmLabel="Remove from organization"
          description={
            <>
              <p>
                Removes the <strong>{roleLabel}</strong> role of <strong>{removing.name}</strong> in{' '}
                <strong>{org.name}</strong>. Their account and their roles elsewhere are not
                affected.
              </p>
              {role === 'STUDENT' ? (
                <p>
                  Enrollments in this organization's courses and roster entries stay on record;
                  lessons are kept as history.
                </p>
              ) : (
                <p>
                  Courses they own here keep them as the owner; reassign them from the Courses tab
                  if needed.
                </p>
              )}
            </>
          }
          onConfirm={async () => {
            await removeMembership.mutateAsync(removing)
            setRemoving(null)
          }}
        />
      ) : null}
      {deleting ? (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && setDeleting(null)}
          title={role === 'STUDENT' ? 'Delete student account' : 'Delete account'}
          destructive
          confirmLabel={role === 'STUDENT' ? 'Delete student account' : 'Delete account'}
          description={
            role === 'STUDENT' ? (
              capabilities.isSuperAdmin ? (
                <>
                  <p>
                    Deletes the account of <strong>{deleting.name}</strong> everywhere and removes
                    every membership, roster entry and enrollment they have, in every organization.
                  </p>
                  <p>
                    Lessons and payments are kept as history. The student can no longer sign in.
                  </p>
                </>
              ) : (
                <>
                  <p>
                    Removes <strong>{deleting.name}</strong> from every organization you administer,
                    with their roster entries and enrollments there.
                  </p>
                  <p>
                    The account is deleted only if nothing else links to it; lessons and payments
                    are kept as history.
                  </p>
                </>
              )
            ) : (
              <>
                <p>
                  Soft-deletes the account of <strong>{deleting.name}</strong>: every membership,
                  roster entry and enrollment is removed and all their sessions end.
                </p>
                <p>
                  Lessons and payments are kept as history.
                  {capabilities.isSuperAdmin
                    ? ''
                    : ' If this person also belongs to an organization you do not administer, the API refuses and only the platform owner can delete the account.'}
                </p>
              </>
            )
          }
          onConfirm={async () => {
            await deleteAccount.mutateAsync(deleting)
            setDeleting(null)
          }}
        />
      ) : null}
    </div>
  )
}
