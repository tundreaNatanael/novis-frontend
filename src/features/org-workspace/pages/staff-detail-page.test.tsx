import { screen, waitFor, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw/http'
import { describe, expect, it } from 'vitest'
import { orgAdmin, organization, page, user, userOrganization } from '@/test/fixtures'
import { api, renderApp, signedInAs } from '@/test/render'
import { server } from '@/test/server'

describe('staff detail', () => {
  it('removes the one membership by its id and shows nothing freelance', async () => {
    signedInAs(orgAdmin('org-1'))
    const removed: string[] = []
    server.use(
      http.get(api('/orgs/org-1'), () => HttpResponse.json(organization())),
      http.get(api('/orgs/org-1/members'), () => HttpResponse.json(page([]))),
      http.get(api('/courses'), () => HttpResponse.json(page([]))),
      http.get(api('/users/u-1'), () =>
        HttpResponse.json(user({ organization: userOrganization({ membershipId: 'm-ana' }) })),
      ),
      http.delete(api('/memberships/:id'), ({ params }) => {
        removed.push(String(params.id))
        return new HttpResponse(null, { status: 204 })
      }),
    )
    const { user: actor, router } = renderApp('/org/org-1/teachers/u-1')

    expect(await screen.findByRole('heading', { level: 2, name: 'Ana Pop' })).toBeInTheDocument()
    expect(screen.getByText('(this organization)')).toBeInTheDocument()
    expect(screen.queryByText(/Freelance/)).not.toBeInTheDocument()
    expect(screen.queryByText('Memberships')).not.toBeInTheDocument()

    await actor.click(screen.getByRole('button', { name: 'More actions' }))
    const items = await screen.findAllByRole('menuitem', { name: /Remove/ })
    expect(items).toHaveLength(1)
    await actor.click(items[0]!)
    const dialog = await screen.findByRole('alertdialog')
    expect(within(dialog).getByText(/stays without a role/)).toBeInTheDocument()
    await actor.click(within(dialog).getByRole('button', { name: 'Remove from organization' }))

    await waitFor(() => expect(removed).toEqual(['m-ana']))
    await waitFor(() => expect(router.state.location.pathname).toBe('/org/org-1/teachers'))
  })
})
