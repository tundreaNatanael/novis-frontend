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

  it('words the 409s by code: an account without a role, a role or an invitation elsewhere', async () => {
    const answers = [
      apiError(
        409,
        'ACCOUNT_WITHOUT_ROLE',
        'This email belongs to an account without a role; invite it instead',
      ),
      apiError(
        409,
        'ROLE_CONFLICT',
        'This email already belongs to an account with a role elsewhere',
      ),
      apiError(409, 'INVITE_PENDING', 'This email has a pending invitation elsewhere'),
      // A plain CONFLICT is not mistaken for the role-less case, whatever its wording.
      apiError(409, 'CONFLICT', 'Email already in use by an account without a role'),
    ]
    server.use(
      http.get(api('/orgs/org-1'), () => HttpResponse.json(organization())),
      http.get(api('/orgs/org-1/members'), () => HttpResponse.json(page([]))),
      http.get(api('/courses'), () => HttpResponse.json(page([]))),
      http.post(api('/orgs/org-1/staff'), () => answers.shift()),
    )
    const { user: actor } = renderApp('/platform/orgs/org-1/admins?new=1')

    await actor.type(await screen.findByLabelText(/^Email/), 'taken@riverside.test')
    await actor.type(screen.getByLabelText(/^Name/), 'Taken')
    await actor.type(screen.getByLabelText(/^Password/), 'Str0ngPassw0rd!')
    const create = screen.getByRole('button', { name: 'Create admin' })
    await actor.click(create)
    expect(
      await screen.findByText(
        'This email already belongs to an account without a role. Invite it by email instead; the person accepts with their current password and keeps their name.',
      ),
    ).toBeInTheDocument()

    await actor.click(create)
    expect(
      await screen.findByText(
        'This email already belongs to an account with a role elsewhere in Novis.',
      ),
    ).toBeInTheDocument()

    await actor.click(create)
    expect(
      await screen.findByText('This email already has a pending invitation elsewhere.'),
    ).toBeInTheDocument()

    await actor.click(create)
    expect(
      await screen.findByText('Email already in use by an account without a role'),
    ).toBeInTheDocument()
    expect(screen.queryByText(/Invite it by email instead/)).not.toBeInTheDocument()
  })

  it('maps server field errors onto the form', async () => {
    server.use(
      http.get(api('/orgs/org-1'), () => HttpResponse.json(organization())),
      http.get(api('/orgs/org-1/members'), () => HttpResponse.json(page([]))),
      http.get(api('/courses'), () => HttpResponse.json(page([]))),
      http.post(api('/orgs/org-1/staff'), () =>
        apiError(400, 'VALIDATION_FAILED', 'Validation failed', [
          { field: 'email', message: 'must be a well-formed email address' },
        ]),
      ),
    )
    const { user: actor } = renderApp('/platform/orgs/org-1/admins?new=1')

    await actor.type(await screen.findByLabelText(/^Email/), 'odd@riverside.test')
    await actor.type(screen.getByLabelText(/^Name/), 'Odd')
    await actor.type(screen.getByLabelText(/^Password/), 'Str0ngPassw0rd!')
    await actor.click(screen.getByRole('button', { name: 'Create admin' }))

    expect(await screen.findByText('must be a well-formed email address')).toBeInTheDocument()
  })
})
