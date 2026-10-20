import { screen, waitFor, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw/http'
import { describe, expect, it } from 'vitest'
import type { Invite } from '@/api/types'
import { orgAdmin, organization, page, superAdmin } from '@/test/fixtures'
import { api, apiError, renderApp, signedInAs } from '@/test/render'
import { server } from '@/test/server'

function invite(overrides: Partial<Invite> = {}): Invite {
  return {
    id: 'i-1',
    email: 'new.teacher@riverside.test',
    role: 'TEACHER',
    organizationId: 'org-1',
    invitedById: 'admin-1',
    expiresAt: '2099-01-01T00:00:00Z',
    usedAt: null,
    createdAt: '2026-10-15T10:00:00Z',
    ...overrides,
  }
}

const teacherInvite = invite()
const adminInvite = invite({ id: 'i-2', email: 'new.admin@riverside.test', role: 'ADMIN' })

/** Answers the invites list and records the `status` filter of every request. */
function inviteHandlers(statuses: (string | null)[]) {
  server.use(
    http.get(api('/orgs/org-1'), () => HttpResponse.json(organization())),
    http.get(api('/orgs/org-1/invites'), ({ request }) => {
      statuses.push(new URL(request.url).searchParams.get('status'))
      return HttpResponse.json(page([teacherInvite, adminInvite]))
    }),
  )
}

describe('organization invites', () => {
  it('lists pending invitations by default, filters by status, resends and revokes', async () => {
    signedInAs(orgAdmin('org-1'))
    const statuses: (string | null)[] = []
    const resent: string[] = []
    const revoked: string[] = []
    inviteHandlers(statuses)
    server.use(
      http.post(api('/invites/:id/resend'), ({ params }) => {
        resent.push(String(params.id))
        return HttpResponse.json(teacherInvite)
      }),
      http.delete(api('/invites/:id'), ({ params }) => {
        revoked.push(String(params.id))
        return new HttpResponse(null, { status: 204 })
      }),
    )
    const { user } = renderApp('/org/org-1/invites')

    const [actions] = await screen.findAllByRole('button', {
      name: 'Actions for new.teacher@riverside.test',
    })
    expect(statuses[0]).toBe('PENDING')

    await user.click(actions!)
    await user.click(await screen.findByRole('menuitem', { name: /Resend invitation/ }))
    const resendDialog = await screen.findByRole('alertdialog')
    expect(within(resendDialog).getByText(/stops working/)).toBeInTheDocument()
    await user.click(within(resendDialog).getByRole('button', { name: 'Send again' }))
    await waitFor(() => expect(resent).toEqual(['i-1']))

    const [again] = await screen.findAllByRole('button', {
      name: 'Actions for new.teacher@riverside.test',
    })
    await user.click(again!)
    await user.click(await screen.findByRole('menuitem', { name: /Revoke invitation/ }))
    const revokeDialog = await screen.findByRole('alertdialog')
    await user.click(within(revokeDialog).getByRole('button', { name: 'Revoke invitation' }))
    await waitFor(() => expect(revoked).toEqual(['i-1']))

    await user.click(screen.getByRole('combobox', { name: 'Status' }))
    await user.click(await screen.findByRole('option', { name: 'Expired' }))
    await waitFor(() => expect(statuses).toContain('EXPIRED'))
    await user.click(screen.getByRole('combobox', { name: 'Status' }))
    await user.click(await screen.findByRole('option', { name: 'All' }))
    await waitFor(() => expect(statuses.at(-1)).toBeNull())
  })

  it('leaves admin invitations to the platform owner', async () => {
    signedInAs(orgAdmin('org-1'))
    inviteHandlers([])
    const { user } = renderApp('/org/org-1/invites')

    const [actions] = await screen.findAllByRole('button', {
      name: 'Actions for new.admin@riverside.test',
    })
    await user.click(actions!)
    const resend = await screen.findByRole('menuitem', { name: /Resend invitation/ })
    expect(resend).toHaveAttribute('aria-disabled', 'true')
    expect(resend).toHaveTextContent(/platform owner/)
    expect(screen.getByRole('menuitem', { name: /Revoke invitation/ })).toHaveAttribute(
      'aria-disabled',
      'true',
    )
  })

  it('offers the admin role to the super-admin only', async () => {
    signedInAs(orgAdmin('org-1'))
    inviteHandlers([])
    const first = renderApp('/org/org-1/invites?new=1')
    expect(await screen.findByRole('combobox', { name: /Role/ })).toBeDisabled()
    first.unmount()

    signedInAs(superAdmin)
    inviteHandlers([])
    const { user } = renderApp('/platform/orgs/org-1/invites?new=1')
    await user.click(await screen.findByRole('combobox', { name: /Role/ }))
    expect(await screen.findByRole('option', { name: /Admin/ })).toBeInTheDocument()
  })

  it('explains a role elsewhere, a pending invitation elsewhere and a same-place duplicate', async () => {
    signedInAs(orgAdmin('org-1'))
    inviteHandlers([])
    const answers = [
      apiError(
        409,
        'ROLE_CONFLICT',
        'This email already belongs to an account with a role elsewhere',
      ),
      apiError(409, 'INVITE_PENDING', 'This email has a pending invitation elsewhere'),
      apiError(409, 'CONFLICT', 'That user already holds this role in the organization'),
    ]
    server.use(http.post(api('/orgs/org-1/invites'), () => answers.shift()))
    const { user } = renderApp('/org/org-1/invites?new=1')

    const email = await screen.findByLabelText(/^Email/)
    await user.type(email, 'taken@riverside.test')
    const send = screen.getByRole('button', { name: 'Send invitation' })

    await user.click(send)
    expect(
      await screen.findByText(
        'This email already belongs to an account with a role elsewhere in Novis.',
      ),
    ).toBeInTheDocument()
    await user.click(send)
    expect(
      await screen.findByText('This email already has a pending invitation elsewhere.'),
    ).toBeInTheDocument()
    await user.click(send)
    expect(await screen.findByText('This person already holds that role here.')).toBeInTheDocument()
  })
})
