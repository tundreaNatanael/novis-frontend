import { screen, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw/http'
import { beforeEach, describe, expect, it } from 'vitest'
import type { User } from '@/api/types'
import {
  course,
  page,
  student,
  studentEnrollment,
  summary,
  superAdmin,
  user,
} from '@/test/fixtures'
import { api, renderApp, signedInAs } from '@/test/render'
import { server } from '@/test/server'

const freelancer: User = user({
  id: 'f-1',
  name: 'Free Lancer',
  email: 'free@test.local',
  freelanceTeacher: true,
  memberships: [],
})

describe('freelance teachers', () => {
  beforeEach(() => signedInAs(superAdmin))

  it('lists freelance teachers and creates one with a password', async () => {
    const posted: Record<string, unknown>[] = []
    let created: User | null = null
    server.use(
      http.get(api('/users'), ({ request }) => {
        expect(new URL(request.url).searchParams.get('freelance')).toBe('true')
        return HttpResponse.json(page(created ? [freelancer, created] : [freelancer]))
      }),
      http.get(api('/invites'), () => HttpResponse.json(page([]))),
      http.post(api('/freelance-teachers'), async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>
        posted.push(body)
        created = user({
          id: 'f-new',
          name: String(body.name),
          email: String(body.email),
          freelanceTeacher: true,
          memberships: [],
        })
        return HttpResponse.json(created, { status: 201 })
      }),
      http.get(api('/users/f-new'), () => HttpResponse.json(created)),
    )
    const { user: actor } = renderApp('/platform/freelance')

    expect((await screen.findAllByText('Free Lancer')).length).toBeGreaterThan(0)
    await actor.click(screen.getByRole('button', { name: 'Add freelance teacher' }))
    await actor.type(await screen.findByLabelText(/^Email/), 'new@test.local')
    await actor.type(screen.getByLabelText(/^Name/), 'New Teacher')
    await actor.type(screen.getByLabelText(/^Password/), 'Str0ngPassw0rd!')
    await actor.click(screen.getByRole('button', { name: 'Create teacher' }))

    expect(
      await screen.findByRole('heading', { level: 1, name: 'New Teacher' }),
    ).toBeInTheDocument()
    expect(posted).toEqual([
      { email: 'new@test.local', name: 'New Teacher', password: 'Str0ngPassw0rd!' },
    ])
    const tabs = screen.getByRole('navigation', { name: 'Freelance teacher sections' })
    expect(within(tabs).getByRole('link', { name: 'Students' })).toBeInTheDocument()
  })

  it('creates a freelance student by naming the teacher, without an organization', async () => {
    const posted: Record<string, unknown>[] = []
    server.use(
      http.get(api('/users/f-1'), () => HttpResponse.json(freelancer)),
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
        HttpResponse.json(user({ id: 's-f', name: 'Bo', hasPassword: false, memberships: [] })),
      ),
      http.get(api('/students/s-f/lessons/summary'), () => HttpResponse.json(summary)),
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
    expect(screen.getByText(/freelance teacher’s student/)).toBeInTheDocument()
  })
})
