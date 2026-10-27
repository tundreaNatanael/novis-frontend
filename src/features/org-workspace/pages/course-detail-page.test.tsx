import { screen, waitFor, within } from '@testing-library/react'
import type { UserEvent } from '@testing-library/user-event'
import { http, HttpResponse } from 'msw/http'
import { beforeEach, describe, expect, it } from 'vitest'
import type { Course, UpdateCourseRequest } from '@/api/types'
import { course, member, organization, page, superAdmin, user } from '@/test/fixtures'
import { api, renderApp, signedInAs } from '@/test/render'
import { server } from '@/test/server'

// The edit form checks the teacher id as a UUID.
const TEACHER_ID = '6f0c2a8e-1b7d-4c3e-9a5f-2d8b7e4c1a90'

/** The value next to a label of the Details panel. */
const detail = (label: string) => screen.getByText(label, { selector: 'dt' }).nextElementSibling

async function openEdit(actor: UserEvent) {
  await actor.click(await screen.findByRole('button', { name: 'Edit' }))
  return screen.findByRole('dialog', { name: 'Edit course' })
}

describe('editing a course', () => {
  let current: Course
  let patched: UpdateCourseRequest[]

  beforeEach(() => {
    signedInAs(superAdmin)
    patched = []
    current = course({ teacherId: TEACHER_ID, description: 'Weekly lessons' })
    server.use(
      http.get(api('/orgs/org-1'), () => HttpResponse.json(organization())),
      http.get(api('/orgs/org-1/members'), () =>
        HttpResponse.json(page([member({ userId: TEACHER_ID })])),
      ),
      http.get(api(`/users/${TEACHER_ID}`), () => HttpResponse.json(user({ id: TEACHER_ID }))),
      http.get(api('/courses/c-1'), () => HttpResponse.json(current)),
      http.get(api('/courses/c-1/enrollments'), () => HttpResponse.json(page([]))),
      http.patch(api('/courses/c-1'), async ({ request }) => {
        const body = (await request.json()) as UpdateCourseRequest
        patched.push(body)
        current = { ...current, ...body }
        return HttpResponse.json(current)
      }),
    )
  })

  it('removes an emptied description with null and has no meeting link (V16)', async () => {
    const { user: actor } = renderApp('/platform/orgs/org-1/courses/c-1')
    expect(await screen.findByText('Weekly lessons', { selector: 'span' })).toBeInTheDocument()
    expect(screen.queryByText('Default meeting link')).not.toBeInTheDocument()

    const dialog = await openEdit(actor)
    expect(within(dialog).queryByLabelText('Default meeting link')).not.toBeInTheDocument()
    await actor.clear(within(dialog).getByLabelText('Description'))
    await actor.click(within(dialog).getByRole('button', { name: 'Save changes' }))

    expect(await screen.findByText('Course updated')).toBeInTheDocument()
    expect(patched).toEqual([{ title: 'Piano — beginners', description: null, status: 'ACTIVE' }])
    await waitFor(() => expect(detail('Description')).toHaveTextContent(/^—$/))
  })

  it('leaves out a field that was and stays empty, and sends a typed one', async () => {
    current = course({ teacherId: TEACHER_ID })
    const { user: actor } = renderApp('/platform/orgs/org-1/courses/c-1')

    const dialog = await openEdit(actor)
    await actor.type(within(dialog).getByLabelText('Description'), 'Scales first')
    await actor.click(within(dialog).getByRole('button', { name: 'Save changes' }))

    expect(await screen.findByText('Course updated')).toBeInTheDocument()
    expect(patched).toEqual([
      { title: 'Piano — beginners', description: 'Scales first', status: 'ACTIVE' },
    ])
    expect(await screen.findByText('Scales first', { selector: 'span' })).toBeInTheDocument()
  })

  it('sets the default lesson length, keeps it when untouched and removes it with null', async () => {
    current = course({ teacherId: TEACHER_ID, defaultDurationMinutes: 45 })
    const { user: actor } = renderApp('/platform/orgs/org-1/courses/c-1')
    expect(await screen.findByText('45 min')).toBeInTheDocument()

    // Out of range, nothing goes out.
    let dialog = await openEdit(actor)
    const length = within(dialog).getByLabelText(/^Default lesson length/)
    expect(length).toHaveValue(45)
    await actor.clear(length)
    await actor.type(length, '10')
    await actor.click(within(dialog).getByRole('button', { name: 'Save changes' }))
    expect(await within(dialog).findByText('Between 15 and 240 minutes')).toBeInTheDocument()
    expect(patched).toEqual([])

    // Emptied, it goes out as null and new lessons last 60 minutes again.
    await actor.clear(length)
    await actor.click(within(dialog).getByRole('button', { name: 'Save changes' }))
    expect(await screen.findByText('Course updated')).toBeInTheDocument()
    expect(patched).toEqual([
      { title: 'Piano — beginners', defaultDurationMinutes: null, status: 'ACTIVE' },
    ])
    expect(await screen.findByText('None (lessons last 60 min)')).toBeInTheDocument()

    dialog = await openEdit(actor)
    await actor.type(within(dialog).getByLabelText(/^Default lesson length/), '90')
    await actor.click(within(dialog).getByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(patched).toHaveLength(2))
    expect(patched[1]).toMatchObject({ defaultDurationMinutes: 90 })
    expect(await screen.findByText('1 h 30 min')).toBeInTheDocument()
  })
})
