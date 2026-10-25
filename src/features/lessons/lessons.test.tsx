import { screen, waitFor, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw/http'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { LessonDetail, ScheduleLessonRequest } from '@/api/types'
import {
  course,
  lesson,
  lessonDetail,
  material,
  member,
  orgAdmin,
  organization,
  page,
  paid,
  student,
  summary,
  superAdmin,
  user,
} from '@/test/fixtures'
import { api, apiError, renderApp, signedInAs } from '@/test/render'
import { server } from '@/test/server'

/** The lookups every lesson screen makes to turn ids into names (and the lesson's homework, none). */
function nameLookups() {
  server.use(
    http.get(api('/users/u-1'), () => HttpResponse.json(user())),
    http.get(api('/students/s-1'), () => HttpResponse.json(student())),
    http.get(api('/courses/c-1'), () => HttpResponse.json(course())),
    http.get(api('/orgs/org-1'), () => HttpResponse.json(organization())),
    http.get(api('/orgs'), () => HttpResponse.json(page([organization()]))),
    http.get(api('/homework'), () => HttpResponse.json(page([]))),
  )
}

describe('lessons ledger', () => {
  beforeEach(() => {
    signedInAs(superAdmin)
    nameLookups()
  })

  it('lists lessons with resolved names and creates one, telling when a prepaid lesson was spent', async () => {
    const posted: Record<string, unknown>[] = []
    server.use(
      http.get(api('/lessons'), () => HttpResponse.json(page([lesson()]))),
      http.get(api('/orgs/org-1/members'), () => HttpResponse.json(page([member()]))),
      http.get(api('/students'), () => HttpResponse.json(page([student()]))),
      http.get(api('/courses'), () => HttpResponse.json(page([course()]))),
      http.post(api('/lessons'), async ({ request }) => {
        posted.push((await request.json()) as Record<string, unknown>)
        return HttpResponse.json(lessonDetail({ id: 'l-new', studentPayment: paid() }), {
          status: 201,
        })
      }),
      http.get(api('/lessons/l-new'), () =>
        HttpResponse.json(lessonDetail({ id: 'l-new', studentPayment: paid() })),
      ),
      http.get(api('/students/s-1/lessons/summary'), () => HttpResponse.json(summary)),
    )
    const { user: actor } = renderApp('/platform/lessons')

    const table = await screen.findByRole('table', { name: 'Lessons' })
    expect(await within(table).findByText('Kid Student')).toBeInTheDocument()
    expect(within(table).getByText('Upcoming')).toBeInTheDocument()
    expect(within(table).getByText('Unpaid')).toBeInTheDocument()

    await actor.click(screen.getByRole('button', { name: 'New lesson' }))
    await actor.click(await screen.findByRole('combobox', { name: /Organization/ }))
    await actor.click(await screen.findByRole('option', { name: /Riverside Music School/ }))
    await actor.click(screen.getByRole('combobox', { name: /Teacher/ }))
    await actor.click(await screen.findByRole('option', { name: /Ana Pop/ }))
    await actor.click(screen.getByRole('combobox', { name: /Student/ }))
    await actor.click(await screen.findByRole('option', { name: /Kid Student/ }))
    await actor.click(screen.getByRole('combobox', { name: /^Course/ }))
    await actor.click(await screen.findByRole('option', { name: /Piano/ }))
    await actor.type(screen.getByLabelText(/Date and time/), '2026-10-21T15:00')
    await actor.click(screen.getByRole('button', { name: 'Create lesson' }))

    await waitFor(() => expect(posted).toHaveLength(1), { timeout: 3000 }).catch(() => {
      console.log(
        'DEBUG form state',
        document.body.innerHTML.includes('Choose'),
        [...document.querySelectorAll('[role=alert], [aria-invalid=true], p.text-destructive')].map(
          (e) => e.textContent,
        ),
      )
    })
    expect(await screen.findByText('Lesson created · Prepaid lesson used')).toBeInTheDocument()
    expect(posted).toHaveLength(1)
    expect(posted[0]).toMatchObject({
      teacherId: 'u-1',
      studentId: 's-1',
      courseId: 'c-1',
      usePrepaid: true,
    })
    expect(String(posted[0]?.scheduledAt)).toMatch(/^2026-10-21T/)
    expect(await screen.findByRole('heading', { level: 2, name: /^Lesson on/ })).toBeInTheDocument()
  })

  it('takes the course’s default length and books an overlapping lesson only after a confirmation', async () => {
    const posted: Record<string, unknown>[] = []
    server.use(
      http.get(api('/lessons'), () => HttpResponse.json(page([lesson()]))),
      http.get(api('/orgs/org-1/members'), () => HttpResponse.json(page([member()]))),
      http.get(api('/students'), () => HttpResponse.json(page([student()]))),
      http.get(api('/courses'), () =>
        HttpResponse.json(page([course({ defaultDurationMinutes: 45 })])),
      ),
      http.post(api('/lessons'), async ({ request }) => {
        posted.push((await request.json()) as Record<string, unknown>)
        if (posted.length === 1) {
          return apiError(
            409,
            'SCHEDULE_CONFLICT',
            'This time overlaps another lesson of the teacher or the student',
          )
        }
        return HttpResponse.json(lessonDetail({ id: 'l-new', durationMinutes: 45 }), {
          status: 201,
        })
      }),
      http.get(api('/lessons/l-new'), () =>
        HttpResponse.json(lessonDetail({ id: 'l-new', durationMinutes: 45 })),
      ),
      http.get(api('/students/s-1/lessons/summary'), () => HttpResponse.json(summary)),
    )
    const { user: actor } = renderApp('/platform/lessons')

    await actor.click(await screen.findByRole('button', { name: 'New lesson' }))
    await actor.click(await screen.findByRole('combobox', { name: /Organization/ }))
    await actor.click(await screen.findByRole('option', { name: /Riverside Music School/ }))
    await actor.click(screen.getByRole('combobox', { name: /Teacher/ }))
    await actor.click(await screen.findByRole('option', { name: /Ana Pop/ }))
    await actor.click(screen.getByRole('combobox', { name: /Student/ }))
    await actor.click(await screen.findByRole('option', { name: /Kid Student/ }))
    const length = screen.getByLabelText(/^Length/)
    expect(length).toHaveValue(60)
    await actor.click(screen.getByRole('combobox', { name: /^Course/ }))
    await actor.click(await screen.findByRole('option', { name: /Piano/ }))
    await waitFor(() => expect(length).toHaveValue(45))
    await actor.type(screen.getByLabelText(/Date and time/), '2026-10-21T15:00')
    await actor.click(screen.getByRole('button', { name: 'Create lesson' }))

    const confirm = await screen.findByRole('alertdialog', { name: 'This time is taken' })
    expect(
      within(confirm).getByText('This time overlaps another lesson of the teacher or the student.'),
    ).toBeInTheDocument()
    await actor.click(within(confirm).getByRole('button', { name: 'Create anyway' }))

    expect(await screen.findByText('Lesson created')).toBeInTheDocument()
    expect(posted).toHaveLength(2)
    expect(posted[0]).toMatchObject({ courseId: 'c-1', durationMinutes: 45 })
    expect(posted[0]).not.toHaveProperty('allowOverlap')
    expect(posted[1]).toEqual({ ...posted[0], allowOverlap: true })
  })

  it('keeps a length typed by hand when the course changes', async () => {
    const posted: Record<string, unknown>[] = []
    server.use(
      http.get(api('/lessons'), () => HttpResponse.json(page([]))),
      http.get(api('/orgs/org-1/members'), () => HttpResponse.json(page([member()]))),
      http.get(api('/students'), () => HttpResponse.json(page([student()]))),
      http.get(api('/courses'), () =>
        HttpResponse.json(page([course({ defaultDurationMinutes: 45 })])),
      ),
      http.post(api('/lessons'), async ({ request }) => {
        posted.push((await request.json()) as Record<string, unknown>)
        return HttpResponse.json(lessonDetail({ id: 'l-new' }), { status: 201 })
      }),
      http.get(api('/lessons/l-new'), () => HttpResponse.json(lessonDetail({ id: 'l-new' }))),
      http.get(api('/students/s-1/lessons/summary'), () => HttpResponse.json(summary)),
    )
    const { user: actor } = renderApp('/platform/lessons')

    await actor.click(await screen.findByRole('button', { name: 'New lesson' }))
    await actor.click(await screen.findByRole('combobox', { name: /Organization/ }))
    await actor.click(await screen.findByRole('option', { name: /Riverside Music School/ }))
    await actor.click(screen.getByRole('combobox', { name: /Teacher/ }))
    await actor.click(await screen.findByRole('option', { name: /Ana Pop/ }))
    await actor.click(screen.getByRole('combobox', { name: /Student/ }))
    await actor.click(await screen.findByRole('option', { name: /Kid Student/ }))
    const length = screen.getByLabelText(/^Length/)
    await actor.clear(length)
    await actor.type(length, '30')
    await actor.click(screen.getByRole('combobox', { name: /^Course/ }))
    await actor.click(await screen.findByRole('option', { name: /Piano/ }))
    expect(length).toHaveValue(30)
    await actor.click(screen.getByRole('button', { name: 'Create lesson' }))

    expect(await screen.findByText('Lesson created')).toBeInTheDocument()
    expect(posted[0]).toMatchObject({ courseId: 'c-1', durationMinutes: 30 })
  })

  it('shows the agenda grouped by day', async () => {
    server.use(
      http.get(api('/lessons'), () =>
        HttpResponse.json(
          page([lesson(), lesson({ id: 'l-2', scheduledAt: null, studentPayment: paid() })]),
        ),
      ),
    )
    renderApp('/platform/lessons?view=agenda')
    expect(await screen.findByText('Not scheduled')).toBeInTheDocument()
    expect((await screen.findAllByText(/Kid Student/)).length).toBeGreaterThanOrEqual(2)
    expect(screen.queryByRole('table', { name: 'Lessons' })).not.toBeInTheDocument()
  })
})

describe('lesson detail', () => {
  beforeEach(() => {
    signedInAs(superAdmin)
    nameLookups()
    server.use(http.get(api('/students/s-1/lessons/summary'), () => HttpResponse.json(summary)))
  })

  describe('an uploaded file', () => {
    afterEach(() => vi.restoreAllMocks())

    it('opens in a new tab through a fresh signed URL, next to links that open directly', async () => {
      const tab = { opener: {} as unknown, location: { href: '' }, close: vi.fn() }
      const openWindow = vi.spyOn(window, 'open').mockReturnValue(tab as unknown as Window)
      const signed = 'https://storage.test/novis/lessons/l-1/m-1/scales.mp4?X-Amz-Signature=abc'
      server.use(
        http.get(api('/lessons/l-1'), () =>
          HttpResponse.json(
            lessonDetail(
              {},
              {
                materials: [
                  material(),
                  material({
                    id: 'm-2',
                    title: 'Recording',
                    type: 'LINK',
                    externalUrl: 'https://youtu.be/x',
                    fileName: null,
                    contentType: null,
                    sizeBytes: null,
                  }),
                ],
              },
            ),
          ),
        ),
        http.get(api('/materials/m-1/download-url'), () =>
          HttpResponse.json({ url: signed, expiresAt: '2026-10-20T21:00:00Z' }),
        ),
      )
      const { user: actor } = renderApp('/platform/lessons/l-1')

      expect(await screen.findByText('(scales.mp4)')).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Recording' })).toHaveAttribute(
        'href',
        'https://youtu.be/x',
      )
      expect(screen.queryByRole('button', { name: 'Open Recording' })).not.toBeInTheDocument()
      await actor.click(screen.getByRole('button', { name: 'Open Scales, slowly' }))

      await waitFor(() => expect(tab.location.href).toBe(signed))
      expect(openWindow).toHaveBeenCalledWith('', '_blank')
      expect(tab.opener).toBeNull()
      expect(tab.close).not.toHaveBeenCalled()
    })

    it('closes the tab again and says why when the file cannot be opened', async () => {
      const tab = { opener: {} as unknown, location: { href: '' }, close: vi.fn() }
      vi.spyOn(window, 'open').mockReturnValue(tab as unknown as Window)
      server.use(
        http.get(api('/lessons/l-1'), () =>
          HttpResponse.json(lessonDetail({}, { materials: [material()] })),
        ),
        http.get(api('/materials/m-1/download-url'), () =>
          apiError(404, 'NOT_FOUND', 'Material not found: m-1'),
        ),
      )
      const { user: actor } = renderApp('/platform/lessons/l-1')

      await actor.click(await screen.findByRole('button', { name: 'Open Scales, slowly' }))

      expect(await screen.findByText('Could not open Scales, slowly')).toBeInTheDocument()
      expect(screen.getByText('Not found, or not accessible with your role.')).toBeInTheDocument()
      expect(tab.close).toHaveBeenCalled()
      expect(tab.location.href).toBe('')
    })
  })

  it('closes a pending dated lesson with a journal and reports a rollover', async () => {
    let detail: LessonDetail = lessonDetail({ studentPayment: paid() })
    const posted: Record<string, unknown>[] = []
    server.use(
      http.get(api('/lessons/l-1'), () => HttpResponse.json(detail)),
      http.post(api('/lessons/l-1/close'), async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>
        posted.push(body)
        detail = lessonDetail(
          {
            status: 'CANCELED',
            studentPayment: paid(),
            closedAt: '2026-10-20T16:00:00Z',
          },
          { rolledOverToLessonId: 'l-credit' },
        )
        return HttpResponse.json(detail)
      }),
    )
    const { user: actor } = renderApp('/platform/lessons/l-1')

    expect(await screen.findByRole('heading', { level: 2, name: /^Lesson on/ })).toBeInTheDocument()
    await actor.click(screen.getByRole('button', { name: 'More actions' }))
    await actor.click(await screen.findByRole('menuitem', { name: 'Close lesson' }))
    const dialog = await screen.findByRole('dialog', { name: 'Close lesson' })
    await actor.type(within(dialog).getByLabelText(/^Journal/), 'Scales and a short piece')
    await actor.click(within(dialog).getByRole('radio', { name: /Canceled on time/ }))
    expect(within(dialog).queryByLabelText(/^Journal/)).not.toBeInTheDocument()
    await actor.click(within(dialog).getByRole('button', { name: 'Close lesson' }))

    expect(await screen.findByText('Lesson canceled')).toBeInTheDocument()
    expect(
      await screen.findByText('Prepaid credit rolled over into a new unscheduled lesson'),
    ).toBeInTheDocument()
    expect(posted).toEqual([{ status: 'CANCELED' }])
    expect(await screen.findByRole('link', { name: /Prepaid credit/ })).toHaveAttribute(
      'href',
      '/platform/lessons/l-credit',
    )
  })

  it('sends only the journal when the lesson was held: homework is assigned on its own', async () => {
    const posted: Record<string, unknown>[] = []
    server.use(
      http.get(api('/lessons/l-1'), () => HttpResponse.json(lessonDetail())),
      http.post(api('/lessons/l-1/close'), async ({ request }) => {
        posted.push((await request.json()) as Record<string, unknown>)
        return HttpResponse.json(
          lessonDetail({ status: 'PRESENT', journal: 'Scales', closedAt: '2026-10-20T16:00:00Z' }),
        )
      }),
    )
    const { user: actor } = renderApp('/platform/lessons/l-1')
    await screen.findByRole('heading', { level: 2, name: /^Lesson on/ })
    await actor.click(screen.getByRole('button', { name: 'More actions' }))
    await actor.click(await screen.findByRole('menuitem', { name: 'Close lesson' }))
    const dialog = await screen.findByRole('dialog', { name: 'Close lesson' })
    expect(within(dialog).queryByText('Checklist')).not.toBeInTheDocument()
    await actor.type(within(dialog).getByLabelText(/^Journal/), 'Scales')
    await actor.click(within(dialog).getByRole('button', { name: 'Close lesson' }))

    expect(await screen.findByText('Lesson closed as held')).toBeInTheDocument()
    expect(posted).toEqual([{ status: 'PRESENT', journal: 'Scales' }])
  })

  it('reschedules with the meeting link left out, removed with null or replaced, and unschedules', async () => {
    let current = lesson({ meetingUrl: 'https://meet.example.com/room' })
    const patched: ScheduleLessonRequest[] = []
    server.use(
      http.get(api('/lessons/l-1'), () => HttpResponse.json(lessonDetail(current))),
      http.patch(api('/lessons/l-1/schedule'), async ({ request }) => {
        const body = (await request.json()) as ScheduleLessonRequest
        patched.push(body)
        // Like the API: an omitted link stays, null removes it.
        const { meetingUrl = current.meetingUrl } = body
        current = lesson({ scheduledAt: body.scheduledAt, meetingUrl })
        return HttpResponse.json(current)
      }),
    )
    const { user: actor } = renderApp('/platform/lessons/l-1')
    const openSheet = async () => {
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
      await actor.click(await screen.findByRole('button', { name: 'More actions' }))
      await actor.click(await screen.findByRole('menuitem', { name: /Reschedule or unschedule/ }))
      return screen.findByRole('dialog', { name: 'Reschedule lesson' })
    }
    const date = '2026-10-20T15:00:00.000Z'

    // Untouched, the link stays out of the body.
    let dialog = await openSheet()
    expect(
      within(dialog).getByText('An absolute https:// link. Empty it to remove the link.'),
    ).toBeInTheDocument()
    await actor.click(within(dialog).getByRole('button', { name: 'Move lesson' }))
    expect(await screen.findByText('Lesson rescheduled')).toBeInTheDocument()
    await waitFor(() => expect(patched).toEqual([{ scheduledAt: date }]))

    // Emptied, it goes out as null and the API removes it.
    dialog = await openSheet()
    await actor.clear(within(dialog).getByLabelText(/Meeting link/))
    await actor.click(within(dialog).getByRole('button', { name: 'Move lesson' }))
    await waitFor(() => expect(patched).toHaveLength(2))
    expect(patched[1]).toEqual({ scheduledAt: date, meetingUrl: null })

    // Without a link, a typed one goes out as typed.
    dialog = await openSheet()
    expect(within(dialog).getByText('Optional absolute https:// link.')).toBeInTheDocument()
    await actor.type(within(dialog).getByLabelText(/Meeting link/), 'https://meet.example.com/new')
    await actor.click(within(dialog).getByRole('button', { name: 'Move lesson' }))
    await waitFor(() => expect(patched).toHaveLength(3))
    expect(patched[2]).toEqual({ scheduledAt: date, meetingUrl: 'https://meet.example.com/new' })

    // Unscheduling sends the date alone: the link stays.
    dialog = await openSheet()
    await actor.click(within(dialog).getByRole('button', { name: 'Unschedule' }))
    expect(await screen.findByText('Lesson unscheduled')).toBeInTheDocument()
    expect(patched[3]).toEqual({ scheduledAt: null })
  })

  it('shows the length and moves the lesson onto another one only after a confirmation', async () => {
    let current = lesson()
    const patched: ScheduleLessonRequest[] = []
    server.use(
      http.get(api('/lessons/l-1'), () => HttpResponse.json(lessonDetail(current))),
      http.patch(api('/lessons/l-1/schedule'), async ({ request }) => {
        const body = (await request.json()) as ScheduleLessonRequest
        patched.push(body)
        if (!body.allowOverlap) {
          return apiError(
            409,
            'SCHEDULE_CONFLICT',
            'This time overlaps another lesson of the teacher or the student',
          )
        }
        current = lesson({
          scheduledAt: body.scheduledAt,
          durationMinutes: body.durationMinutes ?? current.durationMinutes,
        })
        return HttpResponse.json(current)
      }),
    )
    const { user: actor } = renderApp('/platform/lessons/l-1')

    await screen.findByRole('heading', { level: 2, name: /^Lesson on .*\d{2}:\d{2}–\d{2}:\d{2}$/ })
    expect(screen.getByText('Length', { selector: 'dt' }).nextElementSibling).toHaveTextContent(
      /^1 h · \d{2}:\d{2}–\d{2}:\d{2}$/,
    )
    await actor.click(screen.getByRole('button', { name: 'More actions' }))
    await actor.click(await screen.findByRole('menuitem', { name: /Reschedule or unschedule/ }))
    const dialog = await screen.findByRole('dialog', { name: 'Reschedule lesson' })
    const length = within(dialog).getByLabelText(/^Length/)
    expect(length).toHaveValue(60)
    await actor.clear(length)
    await actor.type(length, '90')
    await actor.click(within(dialog).getByRole('button', { name: 'Move lesson' }))

    // Going back keeps the sheet as it was typed.
    let confirm = await screen.findByRole('alertdialog', { name: 'This time is taken' })
    await actor.click(within(confirm).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    expect(within(dialog).getByLabelText(/^Length/)).toHaveValue(90)
    await actor.click(within(dialog).getByRole('button', { name: 'Move lesson' }))
    confirm = await screen.findByRole('alertdialog', { name: 'This time is taken' })
    await actor.click(within(confirm).getByRole('button', { name: 'Move anyway' }))

    expect(await screen.findByText('Lesson rescheduled')).toBeInTheDocument()
    const date = '2026-10-20T15:00:00.000Z'
    expect(patched).toEqual([
      { scheduledAt: date, durationMinutes: 90 },
      { scheduledAt: date, durationMinutes: 90 },
      { scheduledAt: date, durationMinutes: 90, allowOverlap: true },
    ])
  })

  it('toggles payment optimistically and rolls back when the server refuses', async () => {
    const patched: Record<string, unknown>[] = []
    let fail = false
    let current = lessonDetail({ status: 'PRESENT', closedAt: '2026-10-20T16:00:00Z' })
    server.use(
      http.get(api('/lessons/l-1'), () => HttpResponse.json(current)),
      http.patch(api('/lessons/l-1/payment'), async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>
        patched.push(body)
        if (fail) return apiError(409, 'CONFLICT', 'Payment is locked for this lesson.')
        current = lessonDetail({
          status: 'PRESENT',
          closedAt: '2026-10-20T16:00:00Z',
          studentPayment: paid('2026-10-21T10:00:00Z'),
        })
        return HttpResponse.json(current.lesson)
      }),
    )
    const { user: actor } = renderApp('/platform/lessons/l-1')

    const markPaid = await screen.findByRole('button', { name: 'Mark paid' })
    expect(screen.getAllByText('Unpaid · due').length).toBeGreaterThan(0)
    await actor.click(markPaid)
    expect(await screen.findByText('Lesson marked paid')).toBeInTheDocument()
    expect(patched).toEqual([{ paid: true }])

    fail = true
    await actor.click(await screen.findByRole('button', { name: 'Mark unpaid' }))
    expect(await screen.findByText('Payment is locked for this lesson.')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Mark unpaid' })).toBeEnabled())
    expect(patched).toEqual([{ paid: true }, { paid: false }])
  })

  it('refuses to delete a closed lesson and deletes a pending unpaid one', async () => {
    let deleted = 0
    server.use(
      http.get(api('/lessons/l-1'), () =>
        HttpResponse.json(lessonDetail({ status: 'PRESENT', closedAt: '2026-10-20T16:00:00Z' })),
      ),
      http.get(api('/lessons/l-2'), () => HttpResponse.json(lessonDetail({ id: 'l-2' }))),
      http.delete(api('/lessons/l-2'), () => {
        deleted += 1
        return new HttpResponse(null, { status: 204 })
      }),
      http.get(api('/lessons'), () => HttpResponse.json(page([]))),
    )
    const first = renderApp('/platform/lessons/l-1')
    await screen.findByRole('heading', { level: 2, name: /^Lesson on/ })
    await first.user.click(screen.getByRole('button', { name: 'More actions' }))
    const item = await screen.findByRole('menuitem', { name: /Delete lesson/ })
    expect(item).toHaveAttribute('aria-disabled', 'true')
    expect(item).toHaveTextContent('Closed lessons are kept as history and cannot be deleted.')
    await first.user.keyboard('{Escape}')
    first.unmount()

    const second = renderApp('/platform/lessons/l-2')
    await screen.findByRole('heading', { level: 2, name: /^Lesson on/ })
    await second.user.click(screen.getByRole('button', { name: 'More actions' }))
    await second.user.click(await screen.findByRole('menuitem', { name: 'Delete lesson' }))
    const dialog = await screen.findByRole('alertdialog')
    await second.user.click(within(dialog).getByRole('button', { name: 'Delete lesson' }))
    expect(await screen.findByText('Lesson deleted')).toBeInTheDocument()
    expect(deleted).toBe(1)
    expect((await screen.findAllByText('No lessons match')).length).toBeGreaterThan(0)
  })

  it('adds prepaid lessons for the student with this teacher', async () => {
    const posted: Record<string, unknown>[] = []
    server.use(
      http.get(api('/lessons/l-1'), () => HttpResponse.json(lessonDetail())),
      http.get(api('/courses'), () => HttpResponse.json(page([course()]))),
      http.post(api('/students/s-1/lessons/prepaid'), async ({ request }) => {
        posted.push((await request.json()) as Record<string, unknown>)
        return HttpResponse.json(
          { created: 5, lessons: [], summary: { ...summary, prepaidRemaining: 7 } },
          { status: 201 },
        )
      }),
    )
    const { user: actor } = renderApp('/platform/lessons/l-1')
    await screen.findByRole('heading', { level: 2, name: /^Lesson on/ })
    await actor.click(screen.getByRole('button', { name: 'Add prepaid' }))
    const dialog = await screen.findByRole('dialog', { name: 'Add prepaid lessons' })
    const count = within(dialog).getByLabelText(/Number of lessons/)
    await actor.clear(count)
    await actor.type(count, '5')
    await actor.click(within(dialog).getByRole('button', { name: 'Add prepaid lessons' }))

    expect(await screen.findByText('5 prepaid lessons added')).toBeInTheDocument()
    expect(posted).toEqual([{ count: 5, teacherId: 'u-1' }])
  })
})

describe('lessons for an organization admin', () => {
  beforeEach(() => {
    signedInAs(orgAdmin('org-1'))
    nameLookups()
    server.use(
      http.get(api('/orgs/org-1/members'), () => HttpResponse.json(page([member()]))),
      http.get(api('/students'), () => HttpResponse.json(page([student()]))),
      http.get(api('/courses'), () => HttpResponse.json(page([course()]))),
      http.get(api('/students/s-1/lessons/summary'), () => HttpResponse.json(summary)),
    )
  })

  it('lists the organization’s lessons with their payment and opens them inside /org', async () => {
    const queries: URLSearchParams[] = []
    server.use(
      http.get(api('/lessons'), ({ request }) => {
        queries.push(new URL(request.url).searchParams)
        return HttpResponse.json(page([lesson({ studentPayment: paid() })]))
      }),
      http.get(api('/lessons/l-1'), () => HttpResponse.json(lessonDetail())),
    )
    const { router, user: actor } = renderApp('/org/org-1/lessons')

    const table = await screen.findByRole('table', { name: 'Lessons' })
    expect(await within(table).findByText('Kid Student')).toBeInTheDocument()
    expect(within(table).getByText('Paid')).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: /Payment/ })).toBeInTheDocument()
    expect(queries[0]?.get('organizationId')).toBe('org-1')

    await actor.click(within(table).getByText('Kid Student'))
    await waitFor(() => expect(router.state.location.pathname).toBe('/org/org-1/lessons/l-1'))
    expect(await screen.findByRole('heading', { level: 2, name: /^Lesson on/ })).toBeInTheDocument()
  })

  it('records payments and prepaid lessons from the lesson detail, linking within the organization', async () => {
    const patched: Record<string, unknown>[] = []
    const prepaid: Record<string, unknown>[] = []
    let current = lessonDetail({ status: 'PRESENT', closedAt: '2026-10-20T16:00:00Z' })
    server.use(
      http.get(api('/lessons/l-1'), () => HttpResponse.json(current)),
      http.patch(api('/lessons/l-1/payment'), async ({ request }) => {
        patched.push((await request.json()) as Record<string, unknown>)
        current = lessonDetail({
          status: 'PRESENT',
          closedAt: '2026-10-20T16:00:00Z',
          studentPayment: paid('2026-10-21T10:00:00Z'),
        })
        return HttpResponse.json(current.lesson)
      }),
      http.post(api('/students/s-1/lessons/prepaid'), async ({ request }) => {
        prepaid.push((await request.json()) as Record<string, unknown>)
        return HttpResponse.json(
          { created: 2, lessons: [], summary: { ...summary, prepaidRemaining: 4 } },
          { status: 201 },
        )
      }),
    )
    const { user: actor } = renderApp('/org/org-1/lessons/l-1')

    await screen.findByRole('heading', { level: 2, name: /^Lesson on/ })
    // The back link, the tab and the sidebar entry all lead to the organization's ledger.
    for (const link of screen.getAllByRole('link', { name: 'Lessons' })) {
      expect(link).toHaveAttribute('href', '/org/org-1/lessons')
    }
    expect(await screen.findByRole('link', { name: /Ana Pop/ })).toHaveAttribute(
      'href',
      '/org/org-1/teachers/u-1',
    )
    expect(screen.getByText('To schedule')).toBeInTheDocument()

    await actor.click(screen.getByRole('button', { name: 'Mark paid' }))
    expect(await screen.findByText('Lesson marked paid')).toBeInTheDocument()
    expect(patched).toEqual([{ paid: true }])

    await actor.click(screen.getByRole('button', { name: 'Add prepaid' }))
    const dialog = await screen.findByRole('dialog', { name: 'Add prepaid lessons' })
    const count = within(dialog).getByLabelText(/Number of lessons/)
    await actor.clear(count)
    await actor.type(count, '2')
    await actor.click(within(dialog).getByRole('button', { name: 'Add prepaid lessons' }))
    expect(await screen.findByText('2 prepaid lessons added')).toBeInTheDocument()
    expect(prepaid).toEqual([{ count: 2, teacherId: 'u-1' }])
  })

  it('shows no payment, and no payment actions, when the API sends none', async () => {
    server.use(
      http.get(api('/lessons/l-1'), () =>
        HttpResponse.json(
          lessonDetail({
            status: 'PRESENT',
            closedAt: '2026-10-20T16:00:00Z',
            studentPayment: null,
          }),
        ),
      ),
      http.get(api('/students/s-1/lessons/summary'), () =>
        HttpResponse.json({
          ...summary,
          prepaidRemaining: null,
          unpaidDue: null,
          upcomingUnpaid: null,
        }),
      ),
    )
    renderApp('/org/org-1/lessons/l-1')

    await screen.findByRole('heading', { level: 2, name: /^Lesson on/ })
    expect(await screen.findByText('To schedule')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Mark (un)?paid/ })).not.toBeInTheDocument()
    expect(screen.queryByText(/Unpaid/)).not.toBeInTheDocument()
    expect(screen.queryByText('Paid at')).not.toBeInTheDocument()
    expect(screen.queryByText('Prepaid left')).not.toBeInTheDocument()
  })
})
