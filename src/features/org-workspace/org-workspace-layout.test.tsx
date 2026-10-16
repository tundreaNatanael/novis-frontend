import { screen, waitFor, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw/http'
import { describe, expect, it } from 'vitest'
import { orgAdmin, organization, page, superAdmin } from '@/test/fixtures'
import { api, renderApp, signedInAs } from '@/test/render'
import { server } from '@/test/server'

function orgHandlers() {
  server.use(
    http.get(api('/orgs/org-1'), () => HttpResponse.json(organization())),
    http.get(api('/orgs/org-1/members'), () => HttpResponse.json(page([]))),
    http.get(api('/orgs/org-1/invites'), () => HttpResponse.json(page([]))),
    http.get(api('/courses'), () => HttpResponse.json(page([]))),
  )
}

describe('organization workspace', () => {
  it('shows every tab to the super-admin under /platform', async () => {
    signedInAs(superAdmin)
    orgHandlers()
    renderApp('/platform/orgs/org-1')

    const tabs = await screen.findByRole('navigation', { name: 'Organization sections' })
    for (const label of [
      'Overview',
      'Admins',
      'Teachers',
      'Students',
      'Courses',
      'Invites',
      'Lessons',
    ]) {
      expect(within(tabs).getByRole('link', { name: label })).toBeInTheDocument()
    }
    expect(await screen.findByRole('button', { name: 'Archive organization' })).toBeInTheDocument()
  })

  it('hides admins, lessons and the danger zone from an organization admin under /org', async () => {
    signedInAs(orgAdmin('org-1'))
    orgHandlers()
    renderApp('/org/org-1')

    const tabs = await screen.findByRole('navigation', { name: 'Organization sections' })
    expect(within(tabs).getByRole('link', { name: 'Teachers' })).toBeInTheDocument()
    expect(within(tabs).queryByRole('link', { name: 'Admins' })).not.toBeInTheDocument()
    expect(within(tabs).queryByRole('link', { name: 'Lessons' })).not.toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'Edit' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Archive organization' })).not.toBeInTheDocument()
  })

  it('sends an admin of another organization back home', async () => {
    signedInAs(orgAdmin('org-1'))
    orgHandlers()
    const { router } = renderApp('/org/org-2/teachers')

    await waitFor(() => expect(router.state.location.pathname).toBe('/org/org-1'))
  })
})
