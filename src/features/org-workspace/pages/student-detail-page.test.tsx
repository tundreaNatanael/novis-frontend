import { screen, waitFor, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw/http'
import { describe, expect, it } from 'vitest'
import { orgAdmin, organization, page, student, studentUser, summary } from '@/test/fixtures'
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
})
