import { screen, waitFor, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw/http'
import { beforeEach, describe, expect, it } from 'vitest'
import type { Invite, User } from '@/api/types'
import {
  course,
  freelanceTeacher,
  orgAdmin,
  organization,
  page,
  student,
  studentEnrollment,
  studentUser,
  summary,
  superAdmin,
} from '@/test/fixtures'
import { api, apiError, renderApp, signedInAs } from '@/test/render'
import { server } from '@/test/server'

const freelancer: User = freelanceTeacher()

function freelanceInvite(overrides: Partial<Invite> = {}): Invite {
  return {
    id: 'i-1',
    email: 'invited@test.local',
    role: 'TEACHER',
    organizationId: null,
    invitedById: 'root',
    expiresAt: '2099-01-01T00:00:00Z',
    usedAt: null,
    createdAt: '2026-10-15T10:00:00Z',
    ...overrides,
  }
}

/** The list page: freelance teachers and pending freelance invitations, recording every query. */
function listHandlers({
  teachers = [freelancer],
  invites = [],
  lists = [],
  inviteQueries = [],
}: {
  teachers?: User[] | (() => User[])
  invites?: Invite[]
  lists?: URLSearchParams[]
  inviteQueries?: URLSearchParams[]
} = {}) {
  server.use(
    http.get(api('/freelance-teachers'), ({ request }) => {
      lists.push(new URL(request.url).searchParams)
      return HttpResponse.json(page(typeof teachers === 'function' ? teachers() : teachers))
    }),
    http.get(api('/invites'), ({ request }) => {
      inviteQueries.push(new URL(request.url).searchParams)
      return HttpResponse.json(page(invites))
    }),
  )
}

/** The profile page of `f-1`, answering with the latest state of the account. */
function profileHandlers(current: () => User) {
  server.use(http.get(api('/freelance-teachers/f-1'), () => HttpResponse.json(current())))
}

describe('freelance teachers', () => {
  beforeEach(() => signedInAs(superAdmin))

  it('searches and filters by status on the server', async () => {
    const lists: URLSearchParams[] = []
    listHandlers({ lists })
    const { user: actor } = renderApp('/platform/freelance')

    expect((await screen.findAllByText('Free Lancer')).length).toBeGreaterThan(0)
    expect(lists[0]?.get('q')).toBeNull()
    expect(lists[0]?.get('status')).toBeNull()
    expect(lists[0]?.get('sort')).toBe('name,asc')

    await actor.type(screen.getByRole('searchbox', { name: 'Search name or email…' }), 'lancer')
    await waitFor(() => expect(lists.at(-1)?.get('q')).toBe('lancer'))

    await actor.click(screen.getByRole('combobox', { name: 'Status' }))
    await actor.click(await screen.findByRole('option', { name: 'Disabled' }))
    await waitFor(() => expect(lists.at(-1)?.get('status')).toBe('DISABLED'))
    expect(lists.at(-1)?.get('q')).toBe('lancer')
  })

  it('creates one with a password and explains the 409s', async () => {
    const posted: Record<string, unknown>[] = []
    let created: User | null = null
    const answers = [
      apiError(
        409,
        'ACCOUNT_WITHOUT_ROLE',
        'This email belongs to an account without a role; invite it instead',
      ),
      apiError(409, 'CONFLICT', 'That user is already a freelance teacher'),
      apiError(
        409,
        'ROLE_CONFLICT',
        'This email already belongs to an account with a role elsewhere',
      ),
    ]
    listHandlers({ teachers: () => (created ? [freelancer, created] : [freelancer]) })
    server.use(
      http.post(api('/freelance-teachers'), async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>
        posted.push(body)
        const answer = answers.shift()
        if (answer) return answer
        created = freelanceTeacher({
          id: 'f-new',
          name: String(body.name),
          email: String(body.email),
        })
        return HttpResponse.json(created, { status: 201 })
      }),
      http.get(api('/freelance-teachers/f-new'), () => HttpResponse.json(created)),
    )
    const { user: actor } = renderApp('/platform/freelance')

    await actor.click(await screen.findByRole('button', { name: 'Add freelance teacher' }))
    await actor.type(await screen.findByLabelText(/^Email/), 'new@test.local')
    await actor.type(screen.getByLabelText(/^Name/), 'New Teacher')
    await actor.type(screen.getByLabelText(/^Password/), 'Str0ngPassw0rd!')
    const create = screen.getByRole('button', { name: 'Create teacher' })

    await actor.click(create)
    expect(
      await screen.findByText(/account without a role. Invite it by email instead/),
    ).toBeInTheDocument()
    await actor.click(create)
    expect(
      await screen.findByText('This person is already a freelance teacher.'),
    ).toBeInTheDocument()
    expect(screen.queryByText(/Invite it by email instead/)).not.toBeInTheDocument()
    await actor.click(create)
    expect(
      await screen.findByText(
        'This email already belongs to an account with a role elsewhere in Novis.',
      ),
    ).toBeInTheDocument()
    await actor.click(create)

    expect(
      await screen.findByRole('heading', { level: 1, name: 'New Teacher' }),
    ).toBeInTheDocument()
    expect(posted).toHaveLength(4)
    expect(posted[3]).toEqual({
      email: 'new@test.local',
      name: 'New Teacher',
      password: 'Str0ngPassw0rd!',
    })
    const tabs = screen.getByRole('navigation', { name: 'Freelance teacher sections' })
    expect(within(tabs).getByRole('link', { name: 'Students' })).toBeInTheDocument()
  })

  it('invites by email and explains a role or an invitation elsewhere', async () => {
    const posted: Record<string, unknown>[] = []
    const answers = [
      apiError(
        409,
        'ROLE_CONFLICT',
        'This email already belongs to an account with a role elsewhere',
      ),
      apiError(409, 'INVITE_PENDING', 'This email has a pending invitation elsewhere'),
      apiError(409, 'CONFLICT', 'That user is already a freelance teacher'),
    ]
    let invites: Invite[] = []
    server.use(
      http.get(api('/freelance-teachers'), () => HttpResponse.json(page([freelancer]))),
      http.get(api('/invites'), () => HttpResponse.json(page(invites))),
      http.post(api('/invites'), async ({ request }) => {
        posted.push((await request.json()) as Record<string, unknown>)
        const answer = answers.shift()
        if (answer) return answer
        invites = [freelanceInvite({ email: 'invited@test.local' })]
        return HttpResponse.json(invites[0], { status: 201 })
      }),
    )
    const { user: actor } = renderApp('/platform/freelance')

    await actor.click(await screen.findByRole('button', { name: 'Invite by email' }))
    await actor.type(await screen.findByLabelText(/^Email/), 'invited@test.local')
    const send = screen.getByRole('button', { name: 'Send invitation' })

    await actor.click(send)
    expect(
      await screen.findByText(
        'This email already belongs to an account with a role elsewhere in Novis.',
      ),
    ).toBeInTheDocument()
    await actor.click(send)
    expect(
      await screen.findByText('This email already has a pending invitation elsewhere.'),
    ).toBeInTheDocument()
    await actor.click(send)
    expect(
      await screen.findByText('This person is already a freelance teacher.'),
    ).toBeInTheDocument()
    await actor.click(send)

    const pending = await screen.findByRole('region', { name: /Pending invitations/ })
    expect(await within(pending).findByText('invited@test.local')).toBeInTheDocument()
    expect(posted).toHaveLength(4)
    expect(posted[3]).toEqual({ email: 'invited@test.local' })
  })

  it('lists pending invitations page by page, resends and revokes them', async () => {
    const inviteQueries: URLSearchParams[] = []
    const resent: string[] = []
    const revoked: string[] = []
    const invites = [freelanceInvite(), freelanceInvite({ id: 'i-2', email: 'second@test.local' })]
    server.use(
      http.get(api('/freelance-teachers'), () => HttpResponse.json(page([freelancer]))),
      http.get(api('/invites'), ({ request }) => {
        const params = new URL(request.url).searchParams
        inviteQueries.push(params)
        return HttpResponse.json(page(invites, { size: 10, totalElements: 12, totalPages: 2 }))
      }),
      http.post(api('/invites/:id/resend'), ({ params }) => {
        resent.push(String(params.id))
        return HttpResponse.json(invites[0])
      }),
      http.delete(api('/invites/:id'), ({ params }) => {
        revoked.push(String(params.id))
        return new HttpResponse(null, { status: 204 })
      }),
    )
    const { user: actor } = renderApp('/platform/freelance')

    const pending = await screen.findByRole('region', { name: /Pending invitations/ })
    expect(await within(pending).findByText('invited@test.local')).toBeInTheDocument()
    expect(inviteQueries[0]?.get('status')).toBe('PENDING')
    expect(inviteQueries[0]?.get('page')).toBe('0')
    expect(inviteQueries[0]?.get('size')).toBe('10')

    await actor.click(
      within(pending).getByRole('button', { name: 'Actions for invitation to invited@test.local' }),
    )
    await actor.click(await screen.findByRole('menuitem', { name: /Resend invitation/ }))
    const resendDialog = await screen.findByRole('alertdialog')
    expect(within(resendDialog).getByText(/stops working/)).toBeInTheDocument()
    await actor.click(within(resendDialog).getByRole('button', { name: 'Send again' }))
    await waitFor(() => expect(resent).toEqual(['i-1']))

    await actor.click(
      within(pending).getByRole('button', { name: 'Actions for invitation to second@test.local' }),
    )
    await actor.click(await screen.findByRole('menuitem', { name: /Revoke invitation/ }))
    const revokeDialog = await screen.findByRole('alertdialog')
    await actor.click(within(revokeDialog).getByRole('button', { name: 'Revoke invitation' }))
    await waitFor(() => expect(revoked).toEqual(['i-2']))

    await actor.click(within(pending).getByRole('button', { name: 'Next page' }))
    await waitFor(() => expect(inviteQueries.at(-1)?.get('page')).toBe('1'))
    expect(inviteQueries.at(-1)?.get('status')).toBe('PENDING')
  })

  it('edits name and email through the freelance endpoint', async () => {
    const patches: Record<string, unknown>[] = []
    let current = freelancer
    profileHandlers(() => current)
    server.use(
      http.patch(api('/freelance-teachers/f-1'), async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>
        patches.push(body)
        if (body.email === 'taken@test.local') return apiError(409, 'CONFLICT', 'Email in use')
        current = { ...current, ...body }
        return HttpResponse.json(current)
      }),
    )
    const { user: actor } = renderApp('/platform/freelance/f-1')

    await actor.click(await screen.findByRole('button', { name: 'Edit' }))
    const email = await screen.findByLabelText(/^Email/)
    expect(screen.queryByRole('combobox', { name: /Status/ })).not.toBeInTheDocument()
    await actor.clear(email)
    await actor.type(email, 'taken@test.local')
    await actor.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(await screen.findByText('Another account already uses this email.')).toBeInTheDocument()

    await actor.clear(email)
    await actor.type(email, 'free@test.local')
    const name = screen.getByLabelText(/^Name/)
    await actor.clear(name)
    await actor.type(name, 'Free Lancer Jr')
    await actor.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Free Lancer Jr' }),
    ).toBeInTheDocument()
    expect(patches).toEqual([{ email: 'taken@test.local' }, { name: 'Free Lancer Jr' }])
  })

  it('disables and re-enables the account after a confirmation', async () => {
    const patches: Record<string, unknown>[] = []
    let current = freelancer
    profileHandlers(() => current)
    server.use(
      http.patch(api('/freelance-teachers/f-1'), async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>
        patches.push(body)
        current = { ...current, ...body }
        return HttpResponse.json(current)
      }),
    )
    const { user: actor } = renderApp('/platform/freelance/f-1')

    await actor.click(await screen.findByRole('button', { name: 'Disable account' }))
    const disableDialog = await screen.findByRole('alertdialog')
    expect(within(disableDialog).getByText(/every session they have open ends/)).toBeInTheDocument()
    await actor.click(within(disableDialog).getByRole('button', { name: 'Disable account' }))

    expect(await screen.findByText(/This account is disabled/)).toBeInTheDocument()
    await actor.click(screen.getByRole('button', { name: 'Re-enable account' }))
    const enableDialog = await screen.findByRole('alertdialog')
    await actor.click(within(enableDialog).getByRole('button', { name: 'Re-enable account' }))

    expect(await screen.findByRole('button', { name: 'Disable account' })).toBeInTheDocument()
    expect(patches).toEqual([{ status: 'DISABLED' }, { status: 'ACTIVE' }])
  })

  it('offers disable or re-enable per row of the list', async () => {
    const disabled = freelanceTeacher({ id: 'f-2', name: 'Off Duty', status: 'DISABLED' })
    listHandlers({ teachers: [freelancer, disabled] })
    const { user: actor } = renderApp('/platform/freelance')

    const [offActions] = await screen.findAllByRole('button', { name: 'Actions for Off Duty' })
    await actor.click(offActions!)
    expect(await screen.findByRole('menuitem', { name: /Re-enable account/ })).toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: /Disable account/ })).not.toBeInTheDocument()
  })

  it('deletes with a confirmation that explains the cascade', async () => {
    const deleted: string[] = []
    profileHandlers(() => freelancer)
    listHandlers({ teachers: [] })
    server.use(
      http.delete(api('/freelance-teachers/:id'), ({ params }) => {
        deleted.push(String(params.id))
        return new HttpResponse(null, { status: 204 })
      }),
    )
    const { user: actor, router } = renderApp('/platform/freelance/f-1')

    await actor.click(await screen.findByRole('button', { name: 'More actions' }))
    await actor.click(await screen.findByRole('menuitem', { name: /Delete freelance teacher/ }))
    const dialog = await screen.findByRole('alertdialog')
    expect(within(dialog).getByText(/every student on their roster/)).toBeInTheDocument()
    expect(within(dialog).getByText(/their courses are archived/)).toBeInTheDocument()
    expect(within(dialog).getByText(/kept as history/)).toBeInTheDocument()
    const confirm = within(dialog).getByRole('button', { name: 'Delete teacher and students' })
    expect(confirm).toBeDisabled()

    await actor.type(within(dialog).getByLabelText(/Type their email/), 'free@test.local')
    await actor.click(confirm)

    await waitFor(() => expect(router.state.location.pathname).toBe('/platform/freelance'))
    expect(deleted).toEqual(['f-1'])
    expect((await screen.findAllByText('No freelance teachers yet')).length).toBeGreaterThan(0)
  })

  it('shows a not-found page for an id that is not a freelance teacher', async () => {
    server.use(
      http.get(api('/freelance-teachers/u-1'), () =>
        apiError(404, 'NOT_FOUND', 'Freelance teacher not found'),
      ),
    )
    renderApp('/platform/freelance/u-1/students')

    expect(
      await screen.findByRole('heading', { level: 1, name: 'No freelance teacher here' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to freelance teachers' })).toHaveAttribute(
      'href',
      '/platform/freelance',
    )
    expect(
      screen.queryByRole('navigation', { name: 'Freelance teacher sections' }),
    ).not.toBeInTheDocument()
  })

  it('creates a freelance student by naming the teacher, without an organization', async () => {
    const posted: Record<string, unknown>[] = []
    server.use(
      http.get(api('/freelance-teachers/f-1'), () => HttpResponse.json(freelancer)),
      http.get(api('/students'), ({ request }) => {
        expect(new URL(request.url).searchParams.get('teacherId')).toBe('f-1')
        return HttpResponse.json(page([]))
      }),
      http.get(api('/courses'), () =>
        HttpResponse.json(
          page([course({ id: 'c-f', teacherId: 'f-1', organizationId: null, title: 'Guitar' })]),
        ),
      ),
      http.post(api('/students'), async ({ request }) => {
        posted.push((await request.json()) as Record<string, unknown>)
        return HttpResponse.json(student({ id: 's-f', name: 'Bo' }), { status: 201 })
      }),
      http.post(api('/courses/c-f/enrollments'), () => HttpResponse.json({}, { status: 201 })),
      http.get(api('/students/s-f'), () => HttpResponse.json(student({ id: 's-f', name: 'Bo' }))),
      http.get(api('/users/s-f'), () =>
        HttpResponse.json(studentUser({ id: 's-f', name: 'Bo', organization: null })),
      ),
      http.get(api('/students/s-f/lessons/summary'), () => HttpResponse.json(summary)),
      http.get(api('/homework'), ({ request }) => {
        // The freelance workspace shows this teacher's homework for the student.
        expect(new URL(request.url).searchParams.get('teacherId')).toBe('f-1')
        return HttpResponse.json(page([]))
      }),
      http.get(api('/students/s-f/enrollments'), () =>
        HttpResponse.json(
          page([
            studentEnrollment({ courseId: 'c-f', courseTitle: 'Guitar', organizationId: null }),
          ]),
        ),
      ),
    )
    const { user: actor } = renderApp('/platform/freelance/f-1/students?new=1')

    await actor.type(await screen.findByLabelText(/^Name/), 'Bo')
    await actor.type(screen.getByLabelText(/^Email/), 'bo@test.local')
    await actor.click(screen.getByRole('combobox', { name: /Course/ }))
    await actor.click(await screen.findByRole('option', { name: /Guitar/ }))
    await actor.click(screen.getByRole('button', { name: 'Create student' }))

    expect(await screen.findByRole('heading', { level: 2, name: 'Bo' })).toBeInTheDocument()
    expect(posted).toEqual([{ name: 'Bo', email: 'bo@test.local', teacherId: 'f-1' }])
    // The organization panel waits for GET /users/{id}, which can land after the heading.
    expect(await screen.findByText(/freelance teacher’s student/)).toBeInTheDocument()
  })
})

describe('freelance add student', () => {
  beforeEach(() => signedInAs(superAdmin))

  it('explains siblings on one email in a freelance teacher’s words', async () => {
    server.use(
      http.get(api('/freelance-teachers/f-1'), () => HttpResponse.json(freelancer)),
      http.get(api('/students'), () => HttpResponse.json(page([]))),
      http.get(api('/courses'), () => HttpResponse.json(page([]))),
    )
    renderApp('/platform/freelance/f-1/students?new=1')

    expect(
      await screen.findByText(
        /The same name links this teacher’s existing student; the same name at a school or another teacher cannot be added\./,
      ),
    ).toBeInTheDocument()
  })
})

describe('freelance teachers for an organization admin', () => {
  it('has no navigation entry and sends the routes back to the admin’s organization', async () => {
    signedInAs(orgAdmin('org-1'))
    let freelanceRequests = 0
    server.use(
      http.get(api('/orgs/org-1'), () => HttpResponse.json(organization())),
      http.get(api('/orgs/org-1/members'), () => HttpResponse.json(page([]))),
      http.get(api('/orgs/org-1/invites'), () => HttpResponse.json(page([]))),
      http.get(api('/courses'), () => HttpResponse.json(page([]))),
      http.get(api('/freelance-teachers'), () => {
        freelanceRequests += 1
        return HttpResponse.json(page([freelancer]))
      }),
      http.get(api('/freelance-teachers/f-1'), () => {
        freelanceRequests += 1
        return HttpResponse.json(freelancer)
      }),
    )

    const first = renderApp('/platform/freelance')
    await waitFor(() => expect(first.router.state.location.pathname).toBe('/org/org-1'))
    const sidebar = await screen.findByRole('complementary', { name: 'Primary' })
    expect(within(sidebar).getByRole('link', { name: /Teachers/ })).toBeInTheDocument()
    expect(within(sidebar).queryByRole('link', { name: /Freelance/ })).not.toBeInTheDocument()
    first.unmount()

    const second = renderApp('/platform/freelance/f-1')
    await waitFor(() => expect(second.router.state.location.pathname).toBe('/org/org-1'))
    expect(freelanceRequests).toBe(0)
  })
})
