import { screen, waitFor, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw/http'
import { describe, expect, it, vi } from 'vitest'
import type { MeetingLink, User } from '@/api/types'
import { course, lessonDetail, page, rosterStudent, summary, user } from '@/test/fixtures'
import { api, renderApp } from '@/test/render'
import { server } from '@/test/server'
import { tokenStore } from '@/auth/tokenStore'

/** Signed in as the teacher `u-1`; `GET /users/me` answers whatever `current()` is now. */
function signedInAsTeacher(current: () => User) {
  tokenStore.set({ accessToken: 'test-access', refreshToken: 'test-refresh' })
  server.use(http.get(api('/users/me'), () => HttpResponse.json(current())))
}

/** What the workspace screens read around the one under test. */
function quietWorkspace(roster = [rosterStudent()]) {
  server.use(
    http.get(api('/teacher/students'), () => HttpResponse.json(page(roster))),
    http.get(api('/courses'), () => HttpResponse.json(page([course()]))),
    http.get(api('/lessons'), () => HttpResponse.json(page([]))),
    http.get(api('/homework'), () => HttpResponse.json(page([]))),
    http.get(api('/teacher/calendar'), () => HttpResponse.json([])),
    http.get(api('/teacher/lesson-totals'), () =>
      HttpResponse.json({ held: 0, paid: 0, balance: 0 }),
    ),
    http.get(api('/students/s-1/lessons/summary'), () =>
      HttpResponse.json({
        ...summary,
        prepaidRemaining: null,
        unpaidDue: null,
        upcomingUnpaid: null,
      }),
    ),
    http.get(api('/students/s-1/enrollments'), () => HttpResponse.json(page([]))),
    http.get(api('/students/s-1/meeting-links'), () => HttpResponse.json([])),
  )
}

/** The teacher's own row of `GET /students/s-1/meeting-links`. */
function myLink(overrides: Partial<MeetingLink> = {}): MeetingLink {
  return {
    teacherId: 'u-1',
    teacherName: 'Ana Pop',
    meetingUrl: null,
    whatsapp: false,
    teacherWhatsappNumber: null,
    ...overrides,
  }
}

describe('WhatsApp in the teacher workspace (D-056, D-057, D-058)', () => {
  it('lets a teacher share their WhatsApp number from the profile and checks its format', async () => {
    let me = user()
    signedInAsTeacher(() => me)
    quietWorkspace()
    const patches: Record<string, unknown>[] = []
    server.use(
      http.patch(api('/users/u-1'), async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>
        patches.push(body)
        me = { ...me, whatsappNumber: '+40712345678' }
        return HttpResponse.json(me)
      }),
    )
    const { user: actor } = renderApp('/teach/profile')

    const row = await screen.findByRole('button', { name: /^WhatsApp number/ })
    expect(row).toHaveTextContent('Not set')
    await actor.click(row)
    const sheet = await screen.findByRole('dialog', { name: 'WhatsApp number' })
    const field = within(sheet).getByLabelText(/^WhatsApp number/)
    await actor.type(field, '0712 345 678')
    await actor.click(within(sheet).getByRole('button', { name: 'Save' }))
    expect(await within(sheet).findByText(/with \+ and the country code/)).toBeInTheDocument()
    expect(patches).toEqual([])

    await actor.clear(field)
    await actor.type(field, '+40 712 345 678')
    await actor.click(within(sheet).getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('WhatsApp number saved')).toBeInTheDocument()
    expect(patches).toEqual([{ whatsappNumber: '+40 712 345 678' }])
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /^WhatsApp number/ })).toHaveTextContent(
        '+40712345678',
      ),
    )
  })

  it('removes the number when the field is emptied', async () => {
    let me = user({ whatsappNumber: '+40712345678' })
    signedInAsTeacher(() => me)
    quietWorkspace()
    const patches: Record<string, unknown>[] = []
    server.use(
      http.patch(api('/users/u-1'), async ({ request }) => {
        patches.push((await request.json()) as Record<string, unknown>)
        me = { ...me, whatsappNumber: null }
        return HttpResponse.json(me)
      }),
    )
    const { user: actor } = renderApp('/teach/profile')

    const row = await screen.findByRole('button', { name: /^WhatsApp number/ })
    expect(row).toHaveTextContent('+40712345678')
    await actor.click(row)
    const sheet = await screen.findByRole('dialog', { name: 'WhatsApp number' })
    await actor.clear(within(sheet).getByLabelText(/^WhatsApp number/))
    await actor.click(within(sheet).getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('WhatsApp number removed')).toBeInTheDocument()
    expect(patches).toEqual([{ whatsappNumber: null }])
  })

  it('says "Join on WhatsApp" when the lesson link is a WhatsApp call link', async () => {
    signedInAsTeacher(() => user())
    quietWorkspace()
    server.use(
      http.get(api('/lessons/l-1'), () =>
        HttpResponse.json(
          lessonDetail({
            scheduledAt: '2099-01-10T15:00:00Z',
            studentPayment: null,
            meetingUrl: 'https://call.whatsapp.com/video/AbC123',
          }),
        ),
      ),
    )
    renderApp('/teach/lessons/l-1')
    expect(await screen.findByRole('button', { name: 'Join on WhatsApp' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Join lesson' })).not.toBeInTheDocument()
  })

  it('sets the meeting link between the teacher and a student, and removes it (D-057)', async () => {
    signedInAsTeacher(() => user())
    let ana = rosterStudent()
    quietWorkspace([ana])
    const calls: { method: string; body?: unknown }[] = []
    server.use(
      http.get(api('/teacher/students'), () => HttpResponse.json(page([ana]))),
      http.put(api('/students/s-1/meeting-links/u-1'), async ({ request }) => {
        const body = (await request.json()) as { meetingUrl: string }
        calls.push({ method: 'PUT', body })
        ana = { ...ana, meetingUrl: body.meetingUrl }
        return HttpResponse.json(myLink({ meetingUrl: body.meetingUrl }))
      }),
      http.delete(api('/students/s-1/meeting-links/u-1'), () => {
        calls.push({ method: 'DELETE' })
        ana = { ...ana, meetingUrl: null }
        return new HttpResponse(null, { status: 204 })
      }),
      http.patch(api('/students/s-1'), () => {
        calls.push({ method: 'PATCH' })
        return HttpResponse.json(ana)
      }),
    )
    const { user: actor } = renderApp('/teach/students/s-1')

    await actor.click(await screen.findByRole('button', { name: 'Edit' }))
    const sheet = await screen.findByRole('dialog', { name: 'Edit student' })
    const link = within(sheet).getByLabelText(/^Meeting link/)
    await actor.type(link, 'http://zoom.example.com')
    await actor.click(within(sheet).getByRole('button', { name: 'Save' }))
    expect(await within(sheet).findByText('Enter a full https:// link')).toBeInTheDocument()

    await actor.clear(link)
    await actor.type(link, 'https://call.whatsapp.com/video/ana')
    await actor.click(within(sheet).getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('Student saved')).toBeInTheDocument()
    expect(await screen.findByRole('link', { name: 'WhatsApp link' })).toHaveAttribute(
      'href',
      'https://call.whatsapp.com/video/ana',
    )

    await actor.click(screen.getByRole('button', { name: 'Edit' }))
    const again = await screen.findByRole('dialog', { name: 'Edit student' })
    await waitFor(() =>
      expect(within(again).getByLabelText(/^Meeting link/)).toHaveValue(
        'https://call.whatsapp.com/video/ana',
      ),
    )
    await actor.clear(within(again).getByLabelText(/^Meeting link/))
    await actor.click(within(again).getByRole('button', { name: 'Save' }))
    await screen.findAllByText('Student saved')
    // The name did not change, so only the link went out: set, then removed.
    expect(calls).toEqual([
      { method: 'PUT', body: { meetingUrl: 'https://call.whatsapp.com/video/ana' } },
      { method: 'DELETE' },
    ])
  })

  it("makes the link a WhatsApp call on the teacher's number, and Join then opens WhatsApp (D-058)", async () => {
    const number = '+40712345678'
    signedInAsTeacher(() => user({ whatsappNumber: number }))
    let ana = rosterStudent({ meetingUrl: 'https://meet.example.com/ana' })
    let link = myLink({ meetingUrl: ana.meetingUrl, teacherWhatsappNumber: number })
    quietWorkspace([ana])
    const puts: unknown[] = []
    server.use(
      http.get(api('/teacher/students'), () => HttpResponse.json(page([ana]))),
      http.get(api('/students/s-1/meeting-links'), () => HttpResponse.json([link])),
      http.put(api('/students/s-1/meeting-links/u-1'), async ({ request }) => {
        puts.push(await request.json())
        link = { ...link, whatsapp: true, meetingUrl: 'https://wa.me/40712345678' }
        ana = { ...ana, meetingUrl: link.meetingUrl }
        return HttpResponse.json(link)
      }),
    )
    const { user: actor } = renderApp('/teach/students/s-1')

    await actor.click(await screen.findByRole('button', { name: 'Edit' }))
    const sheet = await screen.findByRole('dialog', { name: 'Edit student' })
    const call = within(sheet).getByRole('switch', { name: 'WhatsApp call' })
    expect(call).toBeEnabled()
    expect(call).not.toBeChecked()
    expect(within(sheet).getByText(/with your number, \+40712345678/)).toBeInTheDocument()
    await actor.click(call)
    expect(within(sheet).queryByLabelText(/^Meeting link/)).not.toBeInTheDocument()
    await actor.click(within(sheet).getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('Student saved')).toBeInTheDocument()
    expect(puts).toEqual([{ whatsapp: true }])
    // Your own chat would be with yourself: the student page's link opens WhatsApp.
    expect(await screen.findByRole('link', { name: 'WhatsApp call' })).toHaveAttribute(
      'href',
      'whatsapp://',
    )

    await actor.click(screen.getByRole('button', { name: 'Edit' }))
    const again = await screen.findByRole('dialog', { name: 'Edit student' })
    await waitFor(() =>
      expect(within(again).getByRole('switch', { name: 'WhatsApp call' })).toBeChecked(),
    )
  })

  it('without a number the switch is off and "Add WhatsApp number" comes back to the student (D-058)', async () => {
    let me = user()
    signedInAsTeacher(() => me)
    quietWorkspace()
    const patches: unknown[] = []
    server.use(
      http.patch(api('/users/u-1'), async ({ request }) => {
        patches.push(await request.json())
        me = { ...me, whatsappNumber: '+40712345678' }
        return HttpResponse.json(me)
      }),
    )
    const { user: actor } = renderApp('/teach/students/s-1')

    await actor.click(await screen.findByRole('button', { name: 'Edit' }))
    const sheet = await screen.findByRole('dialog', { name: 'Edit student' })
    expect(within(sheet).getByRole('switch', { name: 'WhatsApp call' })).toBeDisabled()
    expect(
      within(sheet).getByText('Add your WhatsApp number to offer WhatsApp calls.'),
    ).toBeInTheDocument()
    expect(within(sheet).getByLabelText(/^Meeting link/)).toBeInTheDocument()

    await actor.click(within(sheet).getByRole('button', { name: 'Add WhatsApp number' }))
    const numberSheet = await screen.findByRole('dialog', { name: 'WhatsApp number' })
    await actor.type(within(numberSheet).getByLabelText(/^WhatsApp number/), '+40 712 345 678')
    await actor.click(within(numberSheet).getByRole('button', { name: 'Save' }))

    const back = await screen.findByRole('dialog', { name: 'Edit student' })
    await waitFor(() =>
      expect(within(back).getByRole('switch', { name: 'WhatsApp call' })).toBeEnabled(),
    )
    expect(patches).toEqual([{ whatsappNumber: '+40 712 345 678' }])
  })

  it("opens WhatsApp from the teacher's Join of a WhatsApp call on their own number (D-058)", async () => {
    signedInAsTeacher(() => user({ whatsappNumber: '+40712345678' }))
    quietWorkspace()
    server.use(
      http.get(api('/lessons/l-1'), () =>
        HttpResponse.json(
          lessonDetail({
            scheduledAt: '2099-01-10T15:00:00Z',
            studentPayment: null,
            meetingUrl: 'https://wa.me/40712345678',
          }),
        ),
      ),
    )
    const open = vi.spyOn(window, 'open').mockReturnValue({} as Window)
    const { user: actor } = renderApp('/teach/lessons/l-1')

    await actor.click(await screen.findByRole('button', { name: 'Open WhatsApp' }))
    expect(open).toHaveBeenCalledWith('whatsapp://', '_self')
    open.mockRestore()
  })
})
