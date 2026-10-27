import { screen, waitFor, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw/http'
import { describe, expect, it } from 'vitest'
import type { MeetingLink, User } from '@/api/types'
import {
  course,
  freelanceTeacher,
  lessonDetail,
  orgAdmin,
  organization,
  page,
  student,
  studentUser,
  summary,
  superAdmin,
  user,
  userOrganization,
} from '@/test/fixtures'
import { api, apiError, renderApp, signedInAs } from '@/test/render'
import { server } from '@/test/server'

const NUMBER = '+40712345678'

describe('WhatsApp in the console (D-056, D-057, D-058)', () => {
  it("offers a chat with the lesson's teacher and says when the link is a WhatsApp call", async () => {
    signedInAs(orgAdmin('org-1'))
    server.use(
      http.get(api('/users/u-1'), () => HttpResponse.json(user({ whatsappNumber: NUMBER }))),
      http.get(api('/students/s-1'), () => HttpResponse.json(student())),
      http.get(api('/courses/c-1'), () => HttpResponse.json(course())),
      http.get(api('/orgs/org-1'), () => HttpResponse.json(organization())),
      http.get(api('/homework'), () => HttpResponse.json(page([]))),
      http.get(api('/lessons/l-1'), () =>
        HttpResponse.json(lessonDetail({ meetingUrl: 'https://call.whatsapp.com/video/AbC' })),
      ),
    )
    renderApp('/org/org-1/lessons/l-1')

    const chat = await screen.findByRole('link', { name: 'Message Ana Pop on WhatsApp' })
    expect(chat).toHaveAttribute('href', 'https://wa.me/40712345678')
    expect(screen.getByRole('link', { name: 'Join on WhatsApp' })).toHaveAttribute(
      'href',
      'https://call.whatsapp.com/video/AbC',
    )
  })

  it('shows no separate chat button when Join already opens the chat with the teacher (D-058)', async () => {
    signedInAs(orgAdmin('org-1'))
    server.use(
      http.get(api('/users/u-1'), () => HttpResponse.json(user({ whatsappNumber: NUMBER }))),
      http.get(api('/students/s-1'), () => HttpResponse.json(student())),
      http.get(api('/courses/c-1'), () => HttpResponse.json(course())),
      http.get(api('/orgs/org-1'), () => HttpResponse.json(organization())),
      http.get(api('/homework'), () => HttpResponse.json(page([]))),
      http.get(api('/lessons/l-1'), () =>
        HttpResponse.json(lessonDetail({ meetingUrl: 'https://wa.me/40712345678' })),
      ),
    )
    renderApp('/org/org-1/lessons/l-1')

    expect(await screen.findByRole('link', { name: 'Join on WhatsApp' })).toHaveAttribute(
      'href',
      'https://wa.me/40712345678',
    )
    expect(
      screen.queryByRole('link', { name: 'Message Ana Pop on WhatsApp' }),
    ).not.toBeInTheDocument()
  })

  it('shows no chat button for a teacher without a number', async () => {
    signedInAs(orgAdmin('org-1'))
    server.use(
      http.get(api('/users/u-1'), () => HttpResponse.json(user())),
      http.get(api('/students/s-1'), () => HttpResponse.json(student())),
      http.get(api('/courses/c-1'), () => HttpResponse.json(course())),
      http.get(api('/orgs/org-1'), () => HttpResponse.json(organization())),
      http.get(api('/homework'), () => HttpResponse.json(page([]))),
      http.get(api('/lessons/l-1'), () =>
        HttpResponse.json(lessonDetail({ meetingUrl: 'https://meet.example.com/room' })),
      ),
    )
    renderApp('/org/org-1/lessons/l-1')

    expect(await screen.findByRole('link', { name: 'Join lesson' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /on WhatsApp/ })).not.toBeInTheDocument()
  })

  it("lets an org admin set and remove a teacher's number, international only", async () => {
    signedInAs(orgAdmin('org-1'))
    let current: User = user({ organization: userOrganization() })
    const patches: Record<string, unknown>[] = []
    server.use(
      http.get(api('/orgs/org-1'), () => HttpResponse.json(organization())),
      http.get(api('/orgs/org-1/members'), () => HttpResponse.json(page([]))),
      http.get(api('/courses'), () => HttpResponse.json(page([]))),
      http.get(api('/users/u-1'), () => HttpResponse.json(current)),
      http.patch(api('/users/u-1'), async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>
        patches.push(body)
        current = { ...current, whatsappNumber: body.whatsappNumber === null ? null : NUMBER }
        return HttpResponse.json(current)
      }),
    )
    const { user: actor } = renderApp('/org/org-1/teachers/u-1')

    await actor.click(await screen.findByRole('button', { name: 'Edit' }))
    let sheet = await screen.findByRole('dialog', { name: 'Edit account' })
    const field = within(sheet).getByLabelText(/^WhatsApp number/)
    await actor.type(field, '0712 345 678')
    await actor.click(within(sheet).getByRole('button', { name: 'Save changes' }))
    expect(await within(sheet).findByText(/with \+ and the country code/)).toBeInTheDocument()

    await actor.clear(field)
    await actor.type(field, '+40 712 345 678')
    await actor.click(within(sheet).getByRole('button', { name: 'Save changes' }))
    expect(await screen.findByRole('link', { name: NUMBER })).toHaveAttribute(
      'href',
      'https://wa.me/40712345678',
    )

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    await actor.click(screen.getByRole('button', { name: 'Edit' }))
    sheet = await screen.findByRole('dialog', { name: 'Edit account' })
    await actor.clear(within(sheet).getByLabelText(/^WhatsApp number/))
    await actor.click(within(sheet).getByRole('button', { name: 'Save changes' }))
    await waitFor(() =>
      expect(patches).toEqual([{ whatsappNumber: '+40 712 345 678' }, { whatsappNumber: null }]),
    )
  })

  it('never offers a number on an admin account', async () => {
    signedInAs(superAdmin)
    const admin = orgAdmin('org-1')
    server.use(
      http.get(api('/orgs/org-1'), () => HttpResponse.json(organization())),
      http.get(api('/orgs/org-1/members'), () => HttpResponse.json(page([]))),
      http.get(api('/courses'), () => HttpResponse.json(page([]))),
      http.get(api('/users/admin-1'), () => HttpResponse.json(admin)),
    )
    const { user: actor } = renderApp('/platform/orgs/org-1/admins/admin-1')

    expect(await screen.findByRole('heading', { level: 2, name: admin.name })).toBeInTheDocument()
    expect(screen.queryByText('WhatsApp number')).not.toBeInTheDocument()
    await actor.click(screen.getByRole('button', { name: 'Edit' }))
    const sheet = await screen.findByRole('dialog', { name: 'Edit account' })
    expect(within(sheet).queryByLabelText(/^WhatsApp number/)).not.toBeInTheDocument()
  })

  it("lets the super-admin set a freelance teacher's number through the freelance endpoint", async () => {
    signedInAs(superAdmin)
    let current: User = freelanceTeacher()
    const patches: Record<string, unknown>[] = []
    server.use(
      http.get(api('/freelance-teachers/f-1'), () => HttpResponse.json(current)),
      http.get(api('/users/f-1'), () => HttpResponse.json(current)),
      http.get(api('/courses'), () => HttpResponse.json(page([]))),
      http.get(api('/lessons'), () => HttpResponse.json(page([]))),
      http.get(api('/students'), () => HttpResponse.json(page([]))),
      http.get(api('/invites'), () => HttpResponse.json(page([]))),
      http.patch(api('/freelance-teachers/f-1'), async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>
        patches.push(body)
        current = { ...current, whatsappNumber: NUMBER }
        return HttpResponse.json(current)
      }),
    )
    const { user: actor } = renderApp('/platform/freelance/f-1')

    await actor.click(await screen.findByRole('button', { name: 'Edit' }))
    const sheet = await screen.findByRole('dialog', { name: 'Edit freelance teacher' })
    await actor.type(within(sheet).getByLabelText(/^WhatsApp number/), '+40 712 345 678')
    await actor.click(within(sheet).getByRole('button', { name: 'Save changes' }))

    expect(await screen.findByRole('link', { name: NUMBER })).toBeInTheDocument()
    expect(patches).toEqual([{ whatsappNumber: '+40 712 345 678' }])
  })

  it('lets an org admin set and remove the meeting link of each teacher and the student (D-057)', async () => {
    signedInAs(orgAdmin('org-1'))
    let links: MeetingLink[] = [
      meetingLink({ teacherId: 'u-1', teacherName: 'Ana Pop' }),
      meetingLink({
        teacherId: 'u-2',
        teacherName: 'Bo Guitar',
        meetingUrl: 'https://meet.example.com/bo',
      }),
    ]
    const calls: { method: string; teacherId: string; body?: unknown }[] = []
    server.use(
      http.get(api('/orgs/org-1'), () => HttpResponse.json(organization())),
      http.get(api('/orgs/org-1/members'), () => HttpResponse.json(page([]))),
      http.get(api('/students/s-1'), () => HttpResponse.json(student())),
      http.get(api('/users/s-1'), () => HttpResponse.json(studentUser())),
      http.get(api('/students/s-1/lessons/summary'), () => HttpResponse.json(summary)),
      http.get(api('/students/s-1/enrollments'), () => HttpResponse.json(page([]))),
      http.get(api('/students/s-1/profiles'), () => HttpResponse.json([])),
      http.get(api('/homework'), () => HttpResponse.json(page([]))),
      http.get(api('/recurring-lessons'), () => HttpResponse.json(page([]))),
      http.get(api('/students/s-1/meeting-links'), () => HttpResponse.json(links)),
      http.put(api('/students/s-1/meeting-links/:teacherId'), async ({ params, request }) => {
        const body = (await request.json()) as { meetingUrl: string }
        if (body.meetingUrl === 'https://not-allowed.example.com')
          return apiError(400, 'VALIDATION_FAILED', 'Invalid', [
            { field: 'meetingUrl', message: 'must be an absolute https:// URL' },
          ])
        calls.push({ method: 'PUT', teacherId: String(params.teacherId), body })
        links = links.map((l) =>
          l.teacherId === params.teacherId ? { ...l, meetingUrl: body.meetingUrl } : l,
        )
        return HttpResponse.json(links.find((l) => l.teacherId === params.teacherId))
      }),
      http.delete(api('/students/s-1/meeting-links/:teacherId'), ({ params }) => {
        calls.push({ method: 'DELETE', teacherId: String(params.teacherId) })
        links = links.map((l) =>
          l.teacherId === params.teacherId ? { ...l, meetingUrl: null } : l,
        )
        return new HttpResponse(null, { status: 204 })
      }),
    )
    const { user: actor } = renderApp('/org/org-1/students/s-1')

    const panel = await screen.findByRole('region', { name: 'Meeting links' })
    expect(
      await within(panel).findByRole('link', { name: 'https://meet.example.com/bo' }),
    ).toBeInTheDocument()
    await actor.click(
      within(panel).getByRole('button', { name: 'Set the meeting link with Ana Pop' }),
    )
    const sheet = await screen.findByRole('dialog', { name: 'Meeting link with Ana Pop' })
    await actor.type(
      within(sheet).getByLabelText(/^Meeting link/),
      'https://call.whatsapp.com/video/kid',
    )
    await actor.click(within(sheet).getByRole('button', { name: 'Save link' }))
    expect(await within(panel).findByRole('link', { name: 'WhatsApp link' })).toHaveAttribute(
      'href',
      'https://call.whatsapp.com/video/kid',
    )

    await actor.click(
      within(panel).getByRole('button', { name: 'Remove the meeting link with Bo Guitar' }),
    )
    const confirm = await screen.findByRole('alertdialog')
    await actor.click(within(confirm).getByRole('button', { name: 'Remove link' }))
    await waitFor(() =>
      expect(
        within(panel).queryByRole('link', { name: 'https://meet.example.com/bo' }),
      ).not.toBeInTheDocument(),
    )
    expect(calls).toEqual([
      {
        method: 'PUT',
        teacherId: 'u-1',
        body: { meetingUrl: 'https://call.whatsapp.com/video/kid' },
      },
      { method: 'DELETE', teacherId: 'u-2' },
    ])
  })

  it("makes a pair's link a WhatsApp call on the teacher's number, offered only with a number (D-058)", async () => {
    signedInAs(orgAdmin('org-1'))
    let links: MeetingLink[] = [
      meetingLink({ teacherId: 'u-1', teacherName: 'Ana Pop' }),
      meetingLink({
        teacherId: 'u-2',
        teacherName: 'Bo Guitar',
        meetingUrl: 'https://meet.example.com/bo',
        teacherWhatsappNumber: NUMBER,
      }),
    ]
    const puts: unknown[] = []
    server.use(
      http.get(api('/orgs/org-1'), () => HttpResponse.json(organization())),
      http.get(api('/orgs/org-1/members'), () => HttpResponse.json(page([]))),
      http.get(api('/students/s-1'), () => HttpResponse.json(student())),
      http.get(api('/users/s-1'), () => HttpResponse.json(studentUser())),
      http.get(api('/students/s-1/lessons/summary'), () => HttpResponse.json(summary)),
      http.get(api('/students/s-1/enrollments'), () => HttpResponse.json(page([]))),
      http.get(api('/students/s-1/profiles'), () => HttpResponse.json([])),
      http.get(api('/homework'), () => HttpResponse.json(page([]))),
      http.get(api('/recurring-lessons'), () => HttpResponse.json(page([]))),
      http.get(api('/students/s-1/meeting-links'), () => HttpResponse.json(links)),
      http.put(api('/students/s-1/meeting-links/u-2'), async ({ request }) => {
        puts.push(await request.json())
        links = links.map((l) =>
          l.teacherId === 'u-2'
            ? { ...l, whatsapp: true, meetingUrl: 'https://wa.me/40712345678' }
            : l,
        )
        return HttpResponse.json(links[1])
      }),
    )
    const { user: actor } = renderApp('/org/org-1/students/s-1')

    const panel = await screen.findByRole('region', { name: 'Meeting links' })
    await actor.click(
      await within(panel).findByRole('button', { name: 'Set the meeting link with Ana Pop' }),
    )
    const numberless = await screen.findByRole('dialog', { name: 'Meeting link with Ana Pop' })
    expect(within(numberless).getByRole('checkbox', { name: 'WhatsApp call' })).toBeDisabled()
    expect(within(numberless).getByRole('link', { name: 'Add it on their page' })).toHaveAttribute(
      'href',
      '/org/org-1/teachers/u-1',
    )
    await actor.keyboard('{Escape}')

    await actor.click(
      within(panel).getByRole('button', { name: 'Edit the meeting link with Bo Guitar' }),
    )
    const sheet = await screen.findByRole('dialog', { name: 'Meeting link with Bo Guitar' })
    await actor.click(within(sheet).getByRole('checkbox', { name: 'WhatsApp call' }))
    expect(within(sheet).queryByLabelText(/^Meeting link/)).not.toBeInTheDocument()
    await actor.click(within(sheet).getByRole('button', { name: 'Save link' }))
    expect(await within(panel).findByRole('link', { name: 'WhatsApp call' })).toHaveAttribute(
      'href',
      'https://wa.me/40712345678',
    )
    expect(puts).toEqual([{ whatsapp: true }])
  })
})

function meetingLink(overrides: Partial<MeetingLink>): MeetingLink {
  return {
    teacherId: 'u-1',
    teacherName: 'Ana Pop',
    meetingUrl: null,
    whatsapp: false,
    teacherWhatsappNumber: null,
    ...overrides,
  }
}
