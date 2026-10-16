import { screen } from '@testing-library/react'
import { http, HttpResponse } from 'msw/http'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  course,
  member,
  organization,
  page,
  student,
  studentEnrollment,
  summary,
  superAdmin,
  user,
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
          student({ id: 's-new', name: 'Kid', email: 'kid@riverside.test' }),
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
        HttpResponse.json(user({ id: 's-new', name: 'Kid', hasPassword: false, memberships: [] })),
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
        HttpResponse.json(student({ id: 's-new', name: 'Kid' }), { status: 201 }),
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
})
