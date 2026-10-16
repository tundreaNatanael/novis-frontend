import { screen } from '@testing-library/react'
import { http, HttpResponse } from 'msw/http'
import { beforeEach, describe, expect, it } from 'vitest'
import { course, member, organization, page, superAdmin, user } from '@/test/fixtures'
import { api, apiError, renderApp, signedInAs } from '@/test/render'
import { server } from '@/test/server'

describe('add teacher with a course', () => {
  beforeEach(() => signedInAs(superAdmin))

  it('creates the account, reports a failed course step, retries without recreating the account', async () => {
    const staffBodies: Record<string, unknown>[] = []
    let courseAttempts = 0
    const created = member({
      membershipId: 'm-new',
      userId: 'u-new',
      email: 'ana@riverside.test',
      name: 'Ana Pop',
    })
    server.use(
      http.get(api('/orgs/org-1'), () => HttpResponse.json(organization())),
      http.get(api('/orgs/org-1/members'), () => HttpResponse.json(page([]))),
      http.get(api('/orgs/org-1/invites'), () => HttpResponse.json(page([]))),
      http.get(api('/courses'), () => HttpResponse.json(page([]))),
      http.post(api('/orgs/org-1/staff'), async ({ request }) => {
        staffBodies.push((await request.json()) as Record<string, unknown>)
        return HttpResponse.json(created, { status: 201 })
      }),
      http.post(api('/courses'), () => {
        courseAttempts += 1
        return courseAttempts === 1
          ? apiError(400, 'BAD_REQUEST', 'The teacher is not a TEACHER in this organization')
          : HttpResponse.json(course({ teacherId: 'u-new', title: 'Piano' }), { status: 201 })
      }),
      http.get(api('/users/u-new'), () => HttpResponse.json(user({ id: 'u-new' }))),
    )
    const { user: actor } = renderApp('/platform/orgs/org-1/teachers?new=1')

    await actor.type(await screen.findByLabelText(/^Email/), 'ana@riverside.test')
    await actor.type(screen.getByLabelText(/^Name/), 'Ana Pop')
    await actor.type(screen.getByLabelText(/^Password/), 'Str0ngPassw0rd!')
    await actor.type(screen.getByLabelText(/^Course title/), 'Piano')
    await actor.click(screen.getByRole('button', { name: 'Create teacher' }))

    expect(await screen.findByText(/Account created for ana@riverside.test/)).toBeInTheDocument()
    expect(await screen.findByText(/not a TEACHER/)).toBeInTheDocument()
    expect(staffBodies).toEqual([
      {
        email: 'ana@riverside.test',
        name: 'Ana Pop',
        password: 'Str0ngPassw0rd!',
        role: 'TEACHER',
      },
    ])

    await actor.click(screen.getByRole('button', { name: 'Retry course step' }))

    expect(await screen.findByRole('heading', { level: 2, name: 'Ana Pop' })).toBeInTheDocument()
    expect(courseAttempts).toBe(2)
    expect(staffBodies).toHaveLength(1)
  })

  it('maps server field errors onto the form', async () => {
    server.use(
      http.get(api('/orgs/org-1'), () => HttpResponse.json(organization())),
      http.get(api('/orgs/org-1/members'), () => HttpResponse.json(page([]))),
      http.get(api('/courses'), () => HttpResponse.json(page([]))),
      http.post(api('/orgs/org-1/staff'), () =>
        apiError(
          409,
          'CONFLICT',
          'Email already in use; add the existing account with POST /orgs/{orgId}/memberships or invite it',
        ),
      ),
    )
    const { user: actor } = renderApp('/platform/orgs/org-1/admins?new=1')

    await actor.type(await screen.findByLabelText(/^Email/), 'taken@riverside.test')
    await actor.type(screen.getByLabelText(/^Name/), 'Taken')
    await actor.type(screen.getByLabelText(/^Password/), 'Str0ngPassw0rd!')
    await actor.click(screen.getByRole('button', { name: 'Create admin' }))

    expect(await screen.findByText(/Email already in use/)).toBeInTheDocument()
  })
})
