import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Send, XCircle } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { inviteKeys, invitesApi } from '@/api/invites'
import type { Invite, InviteFilters, PageParams } from '@/api/types'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { ErrorState } from '@/components/data/error-state'
import { Pagination } from '@/components/data/pagination'
import { RowActions } from '@/components/row-actions'
import { ToneBadge } from '@/components/status-badge'
import { formatDate, formatRelative } from '@/lib/format'

const PENDING: InviteFilters = { status: 'PENDING' }
const SIZE = 10

/**
 * Freelance-teacher invitations not accepted and not expired yet (`GET /invites?status=PENDING`,
 * newest first, paged), with Resend (`POST /invites/{id}/resend`: a new link, 7 more days) and
 * Revoke (`DELETE /invites/{id}`).
 */
export function PendingFreelanceInvites({
  page,
  onPageChange,
}: {
  page: number
  onPageChange: (page: number) => void
}) {
  const queryClient = useQueryClient()
  const [resending, setResending] = useState<Invite | null>(null)
  const [revoking, setRevoking] = useState<Invite | null>(null)
  const params: PageParams = { page, size: SIZE, sort: 'createdAt,desc' }

  const query = useQuery({
    queryKey: inviteKeys.freelanceList(PENDING, params),
    queryFn: ({ signal }) => invitesApi.listFreelance(PENDING, params, signal),
    placeholderData: keepPreviousData,
  })
  const resend = useMutation({
    mutationFn: (invite: Invite) => invitesApi.resend(invite.id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: inviteKeys.freelance() })
      toast.success('Invitation sent again', {
        description: 'In development the API logs the link instead of emailing it.',
      })
    },
  })
  const revoke = useMutation({
    mutationFn: (invite: Invite) => invitesApi.revoke(invite.id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: inviteKeys.freelance() })
      toast.success('Invitation revoked')
    },
  })

  const invites = query.data?.content ?? []
  const total = query.data?.totalElements ?? 0

  return (
    <section
      className="rounded-lg border border-border bg-card"
      aria-labelledby="freelance-invites"
    >
      <header className="border-b border-border px-4 py-3">
        <h2 id="freelance-invites" className="text-sm font-semibold text-card-foreground">
          Pending invitations{' '}
          {query.data ? (
            <span className="text-muted-foreground tabular-nums">({total})</span>
          ) : null}
        </h2>
        <p className="text-xs text-muted-foreground">
          Freelance-teacher invitations not accepted yet and still valid. Resending sends a new link
          (the old one stops working) valid for 7 more days.
        </p>
      </header>
      {query.isPending ? (
        <p className="p-4 text-sm text-muted-foreground">Loading…</p>
      ) : query.isError ? (
        <ErrorState
          error={query.error}
          onRetry={() => void query.refetch()}
          className="m-4 border-0 py-6"
        />
      ) : invites.length === 0 ? (
        <p className="p-4 text-sm text-muted-foreground">No pending invitations.</p>
      ) : (
        <ul className="divide-y divide-border">
          {invites.map((invite) => (
            <li
              key={invite.id}
              className="flex min-h-12 items-center justify-between gap-3 px-4 py-2 text-sm"
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-card-foreground">{invite.email}</p>
                <p className="truncate text-xs text-muted-foreground">
                  Sent {formatDate(invite.createdAt)} · expires {formatRelative(invite.expiresAt)}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <ToneBadge tone="info">Pending</ToneBadge>
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
                    },
                  ]}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
      {total > SIZE ? (
        <div className="border-t border-border px-4 py-2">
          <Pagination page={page} size={SIZE} total={total} onPageChange={onPageChange} />
        </div>
      ) : null}
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
    </section>
  )
}
