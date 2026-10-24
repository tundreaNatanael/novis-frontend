import { screen, waitFor, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw/http'
import { describe, expect, it } from 'vitest'
import { orgAdmin, organization, page, superAdmin, userOrganization } from '@/test/fixtures'
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
      'Finance',
    ]) {
      expect(within(tabs).getByRole('link', { name: label })).toBeInTheDocument()
    }
    expect(await screen.findByRole('button', { name: 'Archive organization' })).toBeInTheDocument()
  })

  it('gives an organization admin the lessons and finance but hides admins and the danger zone under /org', async () => {
    signedInAs(orgAdmin('org-1'))
    orgHandlers()
    renderApp('/org/org-1')

    const tabs = await screen.findByRole('navigation', { name: 'Organization sections' })
    expect(within(tabs).getByRole('link', { name: 'Teachers' })).toBeInTheDocument()
    expect(within(tabs).getByRole('link', { name: 'Lessons' })).toHaveAttribute(
      'href',
      '/org/org-1/lessons',
    )
    expect(within(tabs).getByRole('link', { name: 'Finance' })).toHaveAttribute(
      'href',
      '/org/org-1/finance',
    )
    expect(within(tabs).queryByRole('link', { name: 'Admins' })).not.toBeInTheDocument()
    const sidebar = await screen.findByRole('complementary', { name: 'Primary' })
    expect(within(sidebar).getByRole('link', { name: 'Lessons' })).toHaveAttribute(
      'href',
      '/org/org-1/lessons',
    )
    expect(await screen.findByRole('button', { name: 'Edit' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Archive organization' })).not.toBeInTheDocument()
  })

  it('sends an admin of another organization back home', async () => {
    signedInAs(orgAdmin('org-1'))
    orgHandlers()
    const { router } = renderApp('/org/org-2/teachers')

    await waitFor(() => expect(router.state.location.pathname).toBe('/org/org-1'))
  })

  it('sends the old /org picker URL to the admin’s one organization, with no switcher', async () => {
    signedInAs(orgAdmin('org-1'))
    orgHandlers()
    const { router } = renderApp('/org')

    await waitFor(() => expect(router.state.location.pathname).toBe('/org/org-1'))
    const sidebar = await screen.findByRole('complementary', { name: 'Primary' })
    expect(within(sidebar).getByText('Riverside Music School')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Switch organization' })).not.toBeInTheDocument()
  })

  it('refuses the console to the admin of an archived organization', async () => {
    signedInAs({
      ...orgAdmin('org-1'),
      organization: userOrganization({ status: 'ARCHIVED', membershipId: 'm-admin-1' }),
    })
    const { router } = renderApp('/')

    await waitFor(() => expect(router.state.location.pathname).toBe('/no-access'))
    expect(await screen.findByText(/administrator of an archived organization/)).toBeInTheDocument()
  })
})
