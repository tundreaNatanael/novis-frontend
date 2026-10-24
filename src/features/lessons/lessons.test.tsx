import { screen, waitFor, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw/http'
import { beforeEach, describe, expect, it } from 'vitest'
import type { LessonDetail } from '@/api/types'
import {
  course,
  lesson,
  lessonDetail,
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

/** The lookups every lesson screen makes to turn ids into names. */
function nameLookups() {
  server.use(
    http.get(api('/users/u-1'), () => HttpResponse.json(user())),
    http.get(api('/students/s-1'), () => HttpResponse.json(student())),
    http.get(api('/courses/c-1'), () => HttpResponse.json(course())),
    http.get(api('/orgs/org-1'), () => HttpResponse.json(organization())),
    http.get(api('/orgs'), () => HttpResponse.json(page([organization()]))),
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

  it('sends the journal and homework when the lesson was held', async () => {
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
    await actor.type(within(dialog).getByLabelText(/^Journal/), 'Scales')
    await actor.type(within(dialog).getByLabelText(/^Notes/), 'Practise daily')
    await actor.click(within(dialog).getByRole('button', { name: 'Add item' }))
    await actor.type(within(dialog).getByLabelText('Checklist item 1'), 'C major scale')
    await actor.click(within(dialog).getByRole('button', { name: 'Close lesson' }))

    expect(await screen.findByText('Lesson closed as held')).toBeInTheDocument()
    expect(posted).toEqual([
      {
        status: 'PRESENT',
        journal: 'Scales',
        homework: { notes: 'Practise daily', items: ['C major scale'] },
      },
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
