import { screen, waitFor, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw/http'
import { describe, expect, it } from 'vitest'
import {
  orgAdmin,
  organization,
  page,
  student,
  studentUser,
  summary,
  superAdmin,
  userOrganization,
} from '@/test/fixtures'
import { api, renderApp, signedInAs } from '@/test/render'
import { server } from '@/test/server'

describe('student detail', () => {
  it('shows the student’s one organization and removes them from it by membership id', async () => {
    signedInAs(orgAdmin('org-1'))
    const removed: string[] = []
    server.use(
      http.get(api('/orgs/org-1'), () => HttpResponse.json(organization())),
      http.get(api('/orgs/org-1/members'), () => HttpResponse.json(page([]))),
      http.get(api('/students/s-1'), () => HttpResponse.json(student())),
      http.get(api('/users/s-1'), () => HttpResponse.json(studentUser())),
      http.get(api('/students/s-1/lessons/summary'), () => HttpResponse.json(summary)),
      http.get(api('/students/s-1/enrollments'), () => HttpResponse.json(page([]))),
      http.get(api('/students/s-1/profiles'), () =>
        HttpResponse.json([student({ id: 's-2', name: 'Ana Student' })]),
      ),
      http.get(api('/homework'), () => HttpResponse.json(page([]))),
      http.delete(api('/memberships/:id'), ({ params }) => {
        removed.push(String(params.id))
        return new HttpResponse(null, { status: 204 })
      }),
    )
    const { user, router } = renderApp('/org/org-1/students/s-1')

    expect(
      await screen.findByRole('heading', { level: 2, name: 'Kid Student' }),
    ).toBeInTheDocument()
    expect(await screen.findByText('Student of')).toBeInTheDocument()
    // The sibling on the same email inside this organization, linked to their own page (D-049).
    const sibling = await screen.findByRole('link', { name: 'Ana Student' })
    expect(sibling).toHaveAttribute('href', '/org/org-1/students/s-2')

    await user.click(screen.getByRole('button', { name: 'More actions' }))
    await user.click(
      await screen.findByRole('menuitem', { name: 'Remove from Riverside Music School' }),
    )
    const dialog = await screen.findByRole('alertdialog')
    expect(
      within(dialog).getByText(/roster entries and enrollments here \(completed ones included\)/),
    ).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Remove from organization' }))

    await waitFor(() => expect(removed).toEqual(['m-s-1']))
    await waitFor(() => expect(router.state.location.pathname).toBe('/org/org-1/students'))
  })

  it('says when no other profile of the email is in this organization', async () => {
    signedInAs(orgAdmin('org-1'))
    server.use(
      http.get(api('/orgs/org-1'), () => HttpResponse.json(organization())),
      http.get(api('/orgs/org-1/members'), () => HttpResponse.json(page([]))),
      http.get(api('/students/s-1'), () => HttpResponse.json(student())),
      http.get(api('/users/s-1'), () => HttpResponse.json(studentUser())),
      http.get(api('/students/s-1/lessons/summary'), () => HttpResponse.json(summary)),
      http.get(api('/students/s-1/enrollments'), () => HttpResponse.json(page([]))),
      http.get(api('/students/s-1/profiles'), () => HttpResponse.json([])),
      http.get(api('/homework'), () => HttpResponse.json(page([]))),
    )
    renderApp('/org/org-1/students/s-1')

    expect(await screen.findByText('No other profile in this organization.')).toBeInTheDocument()
  })

  it('shows the super-admin every sibling with its school, linked into that school (D-049)', async () => {
    signedInAs(superAdmin)
    server.use(
      http.get(api('/orgs/org-1'), () => HttpResponse.json(organization())),
      http.get(api('/orgs/org-1/members'), () => HttpResponse.json(page([]))),
      http.get(api('/students/s-1'), () => HttpResponse.json(student())),
      http.get(api('/users/s-1'), () => HttpResponse.json(studentUser())),
      http.get(api('/students/s-1/lessons/summary'), () => HttpResponse.json(summary)),
      http.get(api('/students/s-1/enrollments'), () => HttpResponse.json(page([]))),
      http.get(api('/students/s-1/profiles'), () =>
        HttpResponse.json([
          student({ id: 's-2', name: 'Ana Student' }),
          student({ id: 's-3', name: 'Dan Student' }),
          student({ id: 's-4', name: 'Eva Student' }),
        ]),
      ),
      http.get(api('/users/s-2'), () =>
        HttpResponse.json(studentUser({ id: 's-2', name: 'Ana Student' })),
      ),
      http.get(api('/users/s-3'), () =>
        HttpResponse.json(
          studentUser({
            id: 's-3',
            name: 'Dan Student',
            organization: userOrganization({
              id: 'org-2',
              name: 'Hill School',
              membershipId: 'm-3',
            }),
          }),
        ),
      ),
      http.get(api('/users/s-4'), () =>
        HttpResponse.json(studentUser({ id: 's-4', name: 'Eva Student', organization: null })),
      ),
      http.get(api('/homework'), () => HttpResponse.json(page([]))),
    )
    renderApp('/platform/orgs/org-1/students/s-1')

    expect(
      await screen.findByText(
        'Every other profile that signs in with this email, wherever it learns.',
      ),
    ).toBeInTheDocument()
    expect(await screen.findByRole('link', { name: 'Ana Student' })).toHaveAttribute(
      'href',
      '/platform/orgs/org-1/students/s-2',
    )
    expect(await screen.findByRole('link', { name: 'Dan Student' })).toHaveAttribute(
      'href',
      '/platform/orgs/org-2/students/s-3',
    )
    expect(screen.getByText('Hill School')).toBeInTheDocument()
    expect(await screen.findByText('Freelance or no school yet')).toBeInTheDocument()
    expect(screen.getByText('Eva Student')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Eva Student' })).not.toBeInTheDocument()
  })

  it('says that changing the email moves only this profile', async () => {
    signedInAs(orgAdmin('org-1'))
    server.use(
      http.get(api('/orgs/org-1'), () => HttpResponse.json(organization())),
      http.get(api('/orgs/org-1/members'), () => HttpResponse.json(page([]))),
      http.get(api('/students/s-1'), () => HttpResponse.json(student())),
      http.get(api('/users/s-1'), () => HttpResponse.json(studentUser())),
      http.get(api('/students/s-1/lessons/summary'), () => HttpResponse.json(summary)),
      http.get(api('/students/s-1/enrollments'), () => HttpResponse.json(page([]))),
      http.get(api('/students/s-1/profiles'), () => HttpResponse.json([])),
      http.get(api('/homework'), () => HttpResponse.json(page([]))),
    )
    const { user } = renderApp('/org/org-1/students/s-1')

    await user.click(await screen.findByRole('button', { name: 'Edit' }))

    expect(
      await screen.findByText(
        'Students sign in with this address. Changing it moves only this profile; siblings sharing the old email keep it.',
      ),
    ).toBeInTheDocument()
  })
})
