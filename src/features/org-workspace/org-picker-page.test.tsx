import { screen, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw/http'
import { beforeEach, describe, expect, it } from 'vitest'
import type { User } from '@/api/types'
import { member, orgAdmin, organization, page } from '@/test/fixtures'
import { api, renderApp, signedInAs } from '@/test/render'
import { server } from '@/test/server'

const twoOrgs: User = {
  ...orgAdmin('org-1'),
  memberships: [
    {
      organizationId: 'org-1',
      organizationName: 'Riverside Music School',
      organizationSlug: 'riverside',
      role: 'ADMIN',
    },
    {
      organizationId: 'org-2',
      organizationName: 'Hilltop Conservatory',
      organizationSlug: 'hilltop',
      role: 'ADMIN',
    },
    {
      organizationId: 'org-3',
      organizationName: 'Somewhere I only teach',
      organizationSlug: 'teach-only',
      role: 'TEACHER',
    },
  ],
}

describe('organization picker', () => {
  beforeEach(() => {
    server.use(
      http.get(api('/orgs/:orgId/members'), ({ params, request }) => {
        const role = new URL(request.url).searchParams.get('role')
        const total = params.orgId === 'org-1' ? (role === 'TEACHER' ? 3 : 40) : 1
        return HttpResponse.json(page([member()], { totalElements: total }))
      }),
      http.get(api('/orgs/org-2'), () =>
        HttpResponse.json(
          organization({ id: 'org-2', name: 'Hilltop Conservatory', slug: 'hilltop' }),
        ),
      ),
    )
  })

  it('lists only ADMIN organizations with their counts and opens the chosen workspace', async () => {
    signedInAs(twoOrgs)
    const { user: actor } = renderApp('/')

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Welcome, Riverside Admin' }),
    ).toBeInTheDocument()
    const list = screen.getByRole('list', { name: 'Your organizations' })
    const cards = within(list).getAllByRole('link')
    expect(cards.map((c) => c.getAttribute('href'))).toEqual(['/org/org-1', '/org/org-2'])
    expect(screen.queryByText('Somewhere I only teach')).not.toBeInTheDocument()
    expect(await within(cards[0]!).findByText('3')).toBeInTheDocument()
    expect(within(cards[0]!).getByText('40')).toBeInTheDocument()

    await actor.click(cards[1]!)
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Hilltop Conservatory' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Switch organization' })).toHaveTextContent(
      'Hilltop Conservatory',
    )
  })

  it('sends a single-organization admin straight to their workspace', async () => {
    signedInAs(orgAdmin('org-1'))
    server.use(http.get(api('/orgs/org-1'), () => HttpResponse.json(organization())))
    renderApp('/org')
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Riverside Music School' }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Switch organization' })).not.toBeInTheDocument()
  })
})
