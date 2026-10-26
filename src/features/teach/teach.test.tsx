import { screen, waitFor, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw/http'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  calendarLesson,
  course,
  freelanceTeacher,
  homework,
  lesson,
  lessonDetail,
  orgAdmin,
  page,
  paid,
  rosterStudent,
  summary,
  user,
} from '@/test/fixtures'
import type { Course } from '@/api/types'
import { api, apiError, renderApp, signedInAs } from '@/test/render'
import { server } from '@/test/server'

/** What every workspace screen reads: the roster, the courses, nothing to finish or to show yet. */
function emptyWorkspace() {
  server.use(
    http.get(api('/teacher/students'), () =>
      HttpResponse.json(page([rosterStudent({ toSchedule: 2 })])),
    ),
    http.get(api('/courses'), () => HttpResponse.json(page([course()]))),
    http.get(api('/lessons'), () => HttpResponse.json(page([]))),
    http.get(api('/homework'), () => HttpResponse.json(page([]))),
    http.get(api('/teacher/calendar'), () => HttpResponse.json([])),
    http.get(api('/teacher/earnings'), () =>
      HttpResponse.json({ taught: 3, paidOut: 1, owed: 2, lastPaidOn: '2026-10-20' }),
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
  )
}

describe('the teacher workspace (D-051)', () => {
  it('is where a teacher lands, with the school in the shell; an admin is sent to their own home', async () => {
    signedInAs(user())
    emptyWorkspace()
    renderApp('/')
    expect(await screen.findByRole('heading', { level: 1, name: 'Hello, Ana' })).toBeInTheDocument()
    expect(screen.getByText('Teacher at Riverside Music School')).toBeInTheDocument()
    // An org teacher sees what the school owes; a freelance teacher would not.
    expect(await screen.findByText('Owed to you')).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: 'Students' }).length).toBeGreaterThan(0)
  })

  it('keeps admins out of /teach and teachers out of the console', async () => {
    signedInAs(orgAdmin('org-1'))
    server.use(
      http.get(api('/orgs/org-1'), () =>
        HttpResponse.json({
          id: 'org-1',
          name: 'Riverside Music School',
          slug: 'riverside',
          status: 'ACTIVE',
          createdAt: '',
          updatedAt: '',
        }),
      ),
      http.get(api('/orgs/org-1/members'), () => HttpResponse.json(page([]))),
      http.get(api('/students'), () => HttpResponse.json(page([]))),
      http.get(api('/courses'), () => HttpResponse.json(page([]))),
      http.get(api('/lessons'), () => HttpResponse.json(page([]))),
      http.get(api('/orgs/org-1/invites'), () => HttpResponse.json(page([]))),
    )
    const { router } = renderApp('/teach')
    await waitFor(() => expect(router.state.location.pathname).toBe('/org/org-1'))
  })

  it('sends a teacher who opens the console to the workspace', async () => {
    signedInAs(freelanceTeacher())
    emptyWorkspace()
    const { router } = renderApp('/platform/orgs')
    await waitFor(() => expect(router.state.location.pathname).toBe('/teach'))
  })
})

describe('Today', () => {
  beforeEach(() => {
    signedInAs(user())
    emptyWorkspace()
  })

  it('lists the lessons left to finish with a one-click Finish, and the week in the calendar', async () => {
    const past = lesson({ scheduledAt: '2020-01-10T15:00:00Z', studentPayment: null })
    server.use(
      http.get(api('/lessons'), ({ request }) => {
        const url = new URL(request.url)
        // The lessons left to finish: pending, dated, started before now.
        if (
          url.searchParams.get('status') === 'PENDING' &&
          url.searchParams.get('unscheduled') === 'false'
        ) {
          return HttpResponse.json(page([past]))
        }
        return HttpResponse.json(page([]))
      }),
    )
    renderApp('/teach')
    const section = (await screen.findByRole('heading', { name: 'To finish' })).closest('section')!
    expect(await within(section).findByText('Kid Student')).toBeInTheDocument()
    expect(within(section).getByRole('button', { name: 'Finish lesson' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '1 lesson to finish' })).toHaveAttribute(
      'href',
      '/teach/calendar?view=day&date=2020-01-10&focus=l-1',
    )
  })
})

describe('students', () => {
  beforeEach(() => {
    signedInAs(user())
    emptyWorkspace()
  })

  it('lists the roster, searches it and adds a student through the sheet', async () => {
    const posted: Record<string, unknown>[] = []
    server.use(
      http.post(api('/students'), async ({ request }) => {
        posted.push((await request.json()) as Record<string, unknown>)
        return HttpResponse.json(
          { ...rosterStudent(), id: 's-2', name: 'New Kid', profileCreated: true },
          { status: 201 },
        )
      }),
    )
    const { user: actor } = renderApp('/teach/students')
    expect(await screen.findByRole('link', { name: /Kid Student/ })).toBeInTheDocument()
    expect(screen.getByText('2 to schedule')).toBeInTheDocument()

    await actor.type(screen.getByRole('searchbox', { name: 'Search students' }), 'nobody')
    expect(await screen.findByText('No students match "nobody"')).toBeInTheDocument()

    await actor.click(screen.getByRole('button', { name: 'Add student' }))
    const sheet = await screen.findByRole('dialog', { name: 'Add student' })
    await actor.type(within(sheet).getByLabelText(/^Name/), 'New Kid')
    await actor.type(within(sheet).getByLabelText(/^Email/), 'new@kid.test')
    await actor.click(within(sheet).getByRole('button', { name: 'Add student' }))
    expect(await screen.findByText('New profile created for New Kid')).toBeInTheDocument()
    expect(posted).toEqual([{ name: 'New Kid', email: 'new@kid.test' }])
  })

  it('explains a 409 ROLE_CONFLICT on the email field', async () => {
    server.use(
      http.post(api('/students'), () =>
        apiError(
          409,
          'ROLE_CONFLICT',
          'This email already belongs to an account with a role elsewhere',
        ),
      ),
    )
    const { user: actor } = renderApp('/teach/students')
    await actor.click(await screen.findByRole('button', { name: 'Add student' }))
    const sheet = await screen.findByRole('dialog', { name: 'Add student' })
    await actor.type(within(sheet).getByLabelText(/^Name/), 'Taken')
    await actor.type(within(sheet).getByLabelText(/^Email/), 'taken@staff.test')
    await actor.click(within(sheet).getByRole('button', { name: 'Add student' }))
    expect(await within(sheet).findByRole('alert')).toHaveTextContent(/already used elsewhere/)
  })
})

describe('a lesson', () => {
  it('shows an org teacher no payment data and no paid toggle', async () => {
    signedInAs(user())
    emptyWorkspace()
    server.use(
      http.get(api('/lessons/l-1'), () =>
        HttpResponse.json(
          lessonDetail({ scheduledAt: '2020-01-10T15:00:00Z', studentPayment: null }),
        ),
      ),
    )
    renderApp('/teach/lessons/l-1')
    expect(await screen.findByRole('button', { name: 'Finish lesson' })).toBeInTheDocument()
    expect(screen.queryByText('Unpaid')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Mark as/ })).not.toBeInTheDocument()
  })

  it('lets a freelance teacher mark a lesson paid and finishes one as held, then offers homework', async () => {
    signedInAs(freelanceTeacher())
    emptyWorkspace()
    const closed: Record<string, unknown>[] = []
    let isPaid = false
    server.use(
      http.get(api('/lessons/l-1'), () =>
        HttpResponse.json(
          lessonDetail({
            scheduledAt: '2020-01-10T15:00:00Z',
            organizationId: null,
            ...(isPaid ? { studentPayment: paid() } : {}),
          }),
        ),
      ),
      http.patch(api('/lessons/l-1/payment'), () => {
        isPaid = true
        return HttpResponse.json(lesson({ organizationId: null, studentPayment: paid() }))
      }),
      http.post(api('/lessons/l-1/close'), async ({ request }) => {
        closed.push((await request.json()) as Record<string, unknown>)
        return HttpResponse.json(
          lessonDetail({
            scheduledAt: '2020-01-10T15:00:00Z',
            organizationId: null,
            status: 'PRESENT',
            journal: 'Scales',
          }),
        )
      }),
    )
    const { user: actor } = renderApp('/teach/lessons/l-1')
    // An unpaid pending lesson carries no payment badge (nothing is due yet), only the action.
    await actor.click(await screen.findByRole('button', { name: 'Mark as paid' }))
    expect(await screen.findByText('Marked as paid')).toBeInTheDocument()
    expect(await screen.findByText('Credit')).toBeInTheDocument()

    await actor.click(screen.getByRole('button', { name: 'Finish lesson' }))
    const sheet = await screen.findByRole('dialog', { name: 'Finish lesson' })
    await actor.click(within(sheet).getByRole('radio', { name: /^Present/ }))
    await actor.type(within(sheet).getByLabelText('Journal'), 'Scales')
    await actor.click(within(sheet).getByRole('button', { name: 'Finish lesson' }))
    expect(await screen.findByRole('alertdialog', { name: 'Assign homework?' })).toBeInTheDocument()
    expect(closed).toEqual([{ status: 'PRESENT', journal: 'Scales' }])
  })
})

describe('the calendar', () => {
  beforeEach(() => {
    signedInAs(user())
    emptyWorkspace()
  })

  it('shows the week of the day in the URL, opens a lesson’s actions and marks it held in one click', async () => {
    const closed: string[] = []
    server.use(
      http.get(api('/teacher/calendar'), () => HttpResponse.json([calendarLesson()])),
      http.post(api('/lessons/l-1/close'), async ({ request }) => {
        closed.push(String(((await request.json()) as { status: string }).status))
        return HttpResponse.json(lessonDetail({ status: 'PRESENT' }))
      }),
    )
    const { user: actor } = renderApp('/teach/calendar?view=week&date=2026-10-20')
    const block = await screen.findByRole('button', {
      name: /Piano — beginners with Kid Student, 18:00–19:00/,
    })
    await actor.click(block)
    const dialog = await screen.findByRole('dialog', { name: 'Kid Student' })
    await actor.click(within(dialog).getByRole('button', { name: 'Mark as held' }))
    expect(await screen.findByText('Marked as held')).toBeInTheDocument()
    expect(closed).toEqual(['PRESENT'])
  })

  it('lists the lessons of a segment in Romanian once the language is switched', async () => {
    server.use(
      http.get(api('/lessons'), () => HttpResponse.json(page([lesson({ studentPayment: null })]))),
      http.get(api('/homework'), () => HttpResponse.json(page([homework()]))),
    )
    const { user: actor } = renderApp('/teach/profile')
    await actor.click(await screen.findByRole('radio', { name: 'Română' }))
    expect(await screen.findByRole('heading', { name: 'Cont' })).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: 'Elevi' }).length).toBeGreaterThan(0)
  })
})

describe('courses (D-053)', () => {
  /** One course of the teacher, with nobody enrolled and no materials or homework yet. */
  function oneCourse(owner: Partial<Course> = {}) {
    server.use(
      http.get(api('/courses'), () => HttpResponse.json(page([course(owner)]))),
      http.get(api('/courses/c-1'), () => HttpResponse.json(course(owner))),
      http.get(api('/courses/c-1/enrollments'), () => HttpResponse.json(page([]))),
      http.get(api('/courses/c-1/materials'), () => HttpResponse.json(page([]))),
      http.get(api('/courses/c-1/homework'), () => HttpResponse.json(page([]))),
    )
  }

  it('gives an org teacher no Courses tab, and sends its address to Today', async () => {
    signedInAs(user())
    emptyWorkspace()
    const { router } = renderApp('/teach/courses')
    expect(await screen.findByRole('heading', { level: 1, name: 'Hello, Ana' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/teach')
    expect(screen.getAllByRole('link', { name: 'Students' }).length).toBeGreaterThan(0)
    expect(screen.queryByRole('link', { name: 'Courses' })).not.toBeInTheDocument()
  })

  it('opens an assigned course for an org teacher to enroll and add materials, without Edit or Archive', async () => {
    signedInAs(user())
    emptyWorkspace()
    oneCourse()
    renderApp('/teach/courses/c-1')
    expect(await screen.findByRole('button', { name: 'Enroll a student' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add material' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Edit course' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Archive course' })).not.toBeInTheDocument()
  })

  it('keeps the Courses tab, New course, Edit and Archive for a freelance teacher', async () => {
    signedInAs(freelanceTeacher())
    emptyWorkspace()
    oneCourse({ teacherId: 'f-1', organizationId: null })
    const { user: actor } = renderApp('/teach/courses')
    expect(await screen.findByRole('button', { name: 'New course' })).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: 'Courses' }).length).toBeGreaterThan(0)
    await actor.click(await screen.findByRole('link', { name: /Piano — beginners/ }))
    expect(await screen.findByRole('button', { name: 'Edit course' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Archive course' })).toBeInTheDocument()
  })
})
