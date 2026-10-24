import { screen } from '@testing-library/react'
import { http, HttpResponse } from 'msw/http'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  course,
  enrollment,
  member,
  organization,
  page,
  student,
  studentCreated,
  studentEnrollment,
  studentUser,
  summary,
  superAdmin,
} from '@/test/fixtures'
import { api, apiError, renderApp, signedInAs } from '@/test/render'
import { server } from '@/test/server'

describe('add student with a course', () => {
  beforeEach(() => signedInAs(superAdmin))

  it('creates the student under the course teacher and treats an existing enrollment as success', async () => {
    const studentBodies: Record<string, unknown>[] = []
    const piano = course({ id: 'c-1', teacherId: 'u-1', title: 'Piano' })
    server.use(
      http.get(api('/orgs/org-1'), () => HttpResponse.json(organization())),
      http.get(api('/orgs/org-1/members'), ({ request }) => {
        const role = new URL(request.url).searchParams.get('role')
        return HttpResponse.json(
          page(role === 'TEACHER' ? [member({ userId: 'u-1', name: 'Ana Pop' })] : []),
        )
      }),
      http.get(api('/courses'), () => HttpResponse.json(page([piano]))),
      http.post(api('/students'), async ({ request }) => {
        studentBodies.push((await request.json()) as Record<string, unknown>)
        return HttpResponse.json(
          studentCreated({ id: 's-new', name: 'Kid', email: 'kid@riverside.test' }),
          { status: 201 },
        )
      }),
      http.post(api('/courses/c-1/enrollments'), () =>
        apiError(409, 'CONFLICT', 'Student is already enrolled in this course'),
      ),
      http.get(api('/students/s-new'), () =>
        HttpResponse.json(student({ id: 's-new', name: 'Kid' })),
      ),
      http.get(api('/users/s-new'), () =>
        HttpResponse.json(studentUser({ id: 's-new', name: 'Kid' })),
      ),
      http.get(api('/students/s-new/lessons/summary'), () => HttpResponse.json(summary)),
      http.get(api('/students/s-new/enrollments'), () =>
        HttpResponse.json(page([studentEnrollment({ courseTitle: 'Piano' })])),
      ),
    )
    const { user: actor } = renderApp('/platform/orgs/org-1/students?new=1')

    await actor.type(await screen.findByLabelText(/^Name/), 'Kid')
    await actor.type(screen.getByLabelText(/^Email/), 'kid@riverside.test')
    await actor.click(screen.getByRole('combobox', { name: /Course/ }))
    await actor.click(await screen.findByRole('option', { name: /Piano — Ana Pop/ }))
    await actor.click(screen.getByRole('button', { name: 'Create student' }))

    expect(await screen.findByRole('heading', { level: 2, name: 'Kid' })).toBeInTheDocument()
    expect(studentBodies).toEqual([
      { name: 'Kid', email: 'kid@riverside.test', organizationId: 'org-1', teacherId: 'u-1' },
    ])
    expect((await screen.findAllByText('Piano')).length).toBeGreaterThan(0)
  })

  it('leaves the roster teacher out when the course’s teacher no longer teaches here', async () => {
    const studentBodies: Record<string, unknown>[] = []
    const enrolled: unknown[] = []
    server.use(
      http.get(api('/orgs/org-1'), () => HttpResponse.json(organization())),
      // u-gone owned the course but their TEACHER membership was removed; the course stays ACTIVE.
      http.get(api('/orgs/org-1/members'), ({ request }) => {
        const role = new URL(request.url).searchParams.get('role')
        return HttpResponse.json(
          page(role === 'TEACHER' ? [member({ userId: 'u-1', name: 'Ana Pop' })] : []),
        )
      }),
      http.get(api('/courses'), () =>
        HttpResponse.json(page([course({ id: 'c-1', teacherId: 'u-gone', title: 'Piano' })])),
      ),
      http.post(api('/students'), async ({ request }) => {
        studentBodies.push((await request.json()) as Record<string, unknown>)
        return HttpResponse.json(
          student({ id: 's-new', name: 'Kid', email: 'kid@riverside.test' }),
          { status: 201 },
        )
      }),
      http.post(api('/courses/c-1/enrollments'), async ({ request }) => {
        enrolled.push(await request.json())
        return HttpResponse.json(enrollment({ courseId: 'c-1', studentId: 's-new' }), {
          status: 201,
        })
      }),
      http.get(api('/students/s-new'), () =>
        HttpResponse.json(student({ id: 's-new', name: 'Kid' })),
      ),
      http.get(api('/users/s-new'), () =>
        HttpResponse.json(studentUser({ id: 's-new', name: 'Kid' })),
      ),
      http.get(api('/students/s-new/lessons/summary'), () => HttpResponse.json(summary)),
      http.get(api('/students/s-new/enrollments'), () =>
        HttpResponse.json(page([studentEnrollment({ courseTitle: 'Piano' })])),
      ),
    )
    const { user: actor } = renderApp('/platform/orgs/org-1/students?new=1')

    await actor.type(await screen.findByLabelText(/^Name/), 'Kid')
    await actor.type(screen.getByLabelText(/^Email/), 'kid@riverside.test')
    await actor.click(screen.getByRole('combobox', { name: /Course/ }))
    await actor.click(await screen.findByRole('option', { name: 'Piano' }))
    expect(screen.getByText(/This course’s teacher no longer teaches here/)).toBeInTheDocument()
    await actor.click(screen.getByRole('button', { name: 'Create student' }))

    expect(await screen.findByRole('heading', { level: 2, name: 'Kid' })).toBeInTheDocument()
    expect(studentBodies).toEqual([
      { name: 'Kid', email: 'kid@riverside.test', organizationId: 'org-1' },
    ])
    expect(enrolled).toEqual([{ studentId: 's-new' }])
  })

  it('keeps the created student when the enrollment fails and offers a retry', async () => {
    server.use(
      http.get(api('/orgs/org-1'), () => HttpResponse.json(organization())),
      http.get(api('/orgs/org-1/members'), ({ request }) => {
        const role = new URL(request.url).searchParams.get('role')
        return HttpResponse.json(
          page(role === 'TEACHER' ? [member({ userId: 'u-1', name: 'Ana Pop' })] : []),
        )
      }),
      http.get(api('/courses'), () =>
        HttpResponse.json(page([course({ id: 'c-1', title: 'Piano' })])),
      ),
      http.post(api('/students'), () =>
        HttpResponse.json(studentCreated({ id: 's-new', name: 'Kid' }), { status: 201 }),
      ),
      http.post(api('/courses/c-1/enrollments'), () =>
        apiError(404, 'NOT_FOUND', 'Student not found: s-new'),
      ),
    )
    const { user: actor } = renderApp('/platform/orgs/org-1/students?new=1')

    await actor.type(await screen.findByLabelText(/^Name/), 'Kid')
    await actor.type(screen.getByLabelText(/^Email/), 'kid@riverside.test')
    await actor.click(screen.getByRole('combobox', { name: /Course/ }))
    await actor.click(await screen.findByRole('option', { name: /Piano/ }))
    await actor.click(screen.getByRole('button', { name: 'Create student' }))

    expect(await screen.findByText(/Student created: kid@riverside.test/)).toBeInTheDocument()
    expect(await screen.findByText(/Student not found/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Retry enrollment' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Skip for now' })).toBeInTheDocument()
  })

  const sharedEmailHandlers = (profileCreated: boolean) => [
    http.get(api('/orgs/org-1'), () => HttpResponse.json(organization())),
    http.get(api('/orgs/org-1/members'), () => HttpResponse.json(page([]))),
    http.get(api('/courses'), () => HttpResponse.json(page([]))),
    http.post(api('/students'), () =>
      HttpResponse.json(
        studentCreated({ id: 's-new', name: 'Ana', email: 'parent@riverside.test', profileCreated }),
        { status: 201 },
      ),
    ),
    http.get(api('/students/s-new'), () =>
      HttpResponse.json(student({ id: 's-new', name: 'Ana', email: 'parent@riverside.test' })),
    ),
    http.get(api('/users/s-new'), () =>
      HttpResponse.json(studentUser({ id: 's-new', name: 'Ana', email: 'parent@riverside.test' })),
    ),
    http.get(api('/students/s-new/lessons/summary'), () => HttpResponse.json(summary)),
    http.get(api('/students/s-new/enrollments'), () => HttpResponse.json(page([]))),
    http.get(api('/students/s-new/profiles'), () => HttpResponse.json([])),
    http.get(api('/homework'), () => HttpResponse.json(page([]))),
  ]

  it('names the new profile when the API created one on a shared email', async () => {
    server.use(...sharedEmailHandlers(true))
    const { user: actor } = renderApp('/platform/orgs/org-1/students?new=1')

    await actor.type(await screen.findByLabelText(/^Name/), 'Ana')
    await actor.type(screen.getByLabelText(/^Email/), 'parent@riverside.test')
    await actor.click(screen.getByRole('button', { name: 'Create student' }))

    expect(await screen.findByText('New profile created for Ana')).toBeInTheDocument()
  })

  it('says the student was created when the API linked the existing profile of that name', async () => {
    server.use(...sharedEmailHandlers(false))
    const { user: actor } = renderApp('/platform/orgs/org-1/students?new=1')

    await actor.type(await screen.findByLabelText(/^Name/), 'Ana')
    await actor.type(screen.getByLabelText(/^Email/), 'parent@riverside.test')
    await actor.click(screen.getByRole('button', { name: 'Create student' }))

    // Toasts of earlier tests in this file stay mounted, so only the positive sentence is asserted.
    expect(await screen.findByText('Student created')).toBeInTheDocument()
  })

  it('refuses a student of another place and says why, instead of reusing the account', async () => {
    server.use(
      http.get(api('/orgs/org-1'), () => HttpResponse.json(organization())),
      http.get(api('/orgs/org-1/members'), () => HttpResponse.json(page([]))),
      http.get(api('/courses'), () => HttpResponse.json(page([]))),
      http.post(api('/students'), () =>
        apiError(
          409,
          'ROLE_CONFLICT',
          'This email already belongs to an account with a role elsewhere',
        ),
      ),
    )
    const { user: actor } = renderApp('/platform/orgs/org-1/students?new=1')

    expect(await screen.findByText(/Siblings can share one email/)).toBeInTheDocument()
    await actor.type(screen.getByLabelText(/^Name/), 'Kid')
    await actor.type(screen.getByLabelText(/^Email/), 'kid@elsewhere.test')
    await actor.click(screen.getByRole('button', { name: 'Create student' }))

    expect(
      await screen.findByText(
        'This email already belongs to an account with a role elsewhere in Novis.',
      ),
    ).toBeInTheDocument()
    expect(screen.queryByText(/Student created:/)).not.toBeInTheDocument()
  })
})
