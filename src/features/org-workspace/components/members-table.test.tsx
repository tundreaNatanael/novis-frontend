import { screen, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw/http'
import { describe, expect, it } from 'vitest'
import { member, orgAdmin, organization, page } from '@/test/fixtures'
import { api, renderApp, signedInAs } from '@/test/render'
import { server } from '@/test/server'

describe('members table', () => {
  it('removes a teacher from the organization and keeps the caller’s own admin role protected', async () => {
    const admin = orgAdmin('org-1')
    signedInAs(admin)
    const deleted: string[] = []
    server.use(
      http.get(api('/orgs/org-1'), () => HttpResponse.json(organization())),
      http.get(api('/orgs/org-1/members'), ({ request }) => {
        const role = new URL(request.url).searchParams.get('role')
        return HttpResponse.json(
          page(
            role === 'TEACHER'
              ? [member({ membershipId: 'm-ana', userId: 'u-ana', name: 'Ana Pop' })]
              : [],
          ),
        )
      }),
      http.get(api('/courses'), () => HttpResponse.json(page([]))),
      http.delete(api('/memberships/:id'), ({ params }) => {
        deleted.push(String(params.id))
        return new HttpResponse(null, { status: 204 })
      }),
    )
    const { user } = renderApp('/org/org-1/teachers')

    const [actions] = await screen.findAllByRole('button', { name: 'Actions for Ana Pop' })
    await user.click(actions!)
    await user.click(await screen.findByRole('menuitem', { name: /Remove from this organization/ }))
    const dialog = await screen.findByRole('alertdialog')
    expect(
      within(dialog).getByText(/Courses they own here keep them as the owner/),
    ).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Remove from organization' }))

    expect(deleted).toEqual(['m-ana'])
  })
})
