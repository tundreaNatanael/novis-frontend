import { screen, waitFor, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw/http'
import { describe, expect, it } from 'vitest'
import { enrollmentKeys } from '@/api/enrollments'
import { enrollment, member, orgAdmin, organization, page } from '@/test/fixtures'
import { api, renderApp, signedInAs } from '@/test/render'
import { server } from '@/test/server'

const courseEnrollments = enrollmentKeys.list('c-1', { page: 0, size: 20 })

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
    const { user, queryClient } = renderApp('/org/org-1/teachers')
    queryClient.setQueryData(courseEnrollments, page([enrollment()]))

    const [actions] = await screen.findAllByRole('button', { name: 'Actions for Ana Pop' })
    await user.click(actions!)
    await user.click(await screen.findByRole('menuitem', { name: /Remove from this organization/ }))
    const dialog = await screen.findByRole('alertdialog')
    expect(
      within(dialog).getByText(/Courses they own here keep them as the owner/),
    ).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Remove from organization' }))

    expect(deleted).toEqual(['m-ana'])
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    // A teacher's removal leaves enrollments alone.
    expect(queryClient.getQueryState(courseEnrollments)?.isInvalidated).toBe(false)
  })

  it('removes a student and refreshes course enrollments, which the removal drops', async () => {
    signedInAs(orgAdmin('org-1'))
    const deleted: string[] = []
    server.use(
      http.get(api('/orgs/org-1'), () => HttpResponse.json(organization())),
      http.get(api('/orgs/org-1/members'), ({ request }) => {
        const role = new URL(request.url).searchParams.get('role')
        return HttpResponse.json(
          page(
            role === 'STUDENT'
              ? [
                  member({
                    membershipId: 'm-kid',
                    userId: 's-1',
                    name: 'Kid Student',
                    role: 'STUDENT',
                  }),
                ]
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
    const { user, queryClient } = renderApp('/org/org-1/students')
    queryClient.setQueryData(courseEnrollments, page([enrollment()]))

    const [actions] = await screen.findAllByRole('button', { name: 'Actions for Kid Student' })
    await user.click(actions!)
    await user.click(await screen.findByRole('menuitem', { name: /Remove from this organization/ }))
    const dialog = await screen.findByRole('alertdialog')
    expect(
      within(dialog).getByText(/roster entries and enrollments here \(completed ones included\)/),
    ).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Remove from organization' }))

    await waitFor(() => expect(deleted).toEqual(['m-kid']))
    await waitFor(() =>
      expect(queryClient.getQueryState(courseEnrollments)?.isInvalidated).toBe(true),
    )
  })
})
