import { screen, waitFor, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw/http'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { FinanceSummary, StudentFinanceRow, TeacherFinanceRow } from '@/api/types'
import {
  financeSummary,
  orgAdmin,
  organization,
  page,
  studentFinanceRow,
  superAdmin,
  teacherFinanceRow,
  user,
} from '@/test/fixtures'
import { api, renderApp, signedInAs } from '@/test/render'
import { server } from '@/test/server'

/** Mid-October 2026 in the test's time zone, so "this month" is October. */
const NOW = new Date(2026, 9, 15, 12)
const OCTOBER = {
  from: new Date(2026, 9, 1).toISOString(),
  to: new Date(2026, 10, 1).toISOString(),
}
const SEPTEMBER = {
  from: new Date(2026, 8, 1).toISOString(),
  to: new Date(2026, 9, 1).toISOString(),
}
const STUDENTS = 'Lessons paid for and used, per student'
const TEACHERS = 'Lessons taught and paid out, per teacher'

interface Reports {
  students?: StudentFinanceRow[]
  teachers?: TeacherFinanceRow[]
  summary?: FinanceSummary
}

/** The organization and its three reports; returns the query of every report request. */
function reports({
  students = [studentFinanceRow()],
  teachers = [teacherFinanceRow()],
  summary = financeSummary(),
}: Reports = {}) {
  const seen = {
    summary: [] as URLSearchParams[],
    students: [] as URLSearchParams[],
    teachers: [] as URLSearchParams[],
  }
  server.use(
    http.get(api('/orgs/org-1'), () => HttpResponse.json(organization())),
    http.get(api('/orgs/org-1/reports/summary'), ({ request }) => {
      seen.summary.push(new URL(request.url).searchParams)
      return HttpResponse.json(summary)
    }),
    http.get(api('/orgs/org-1/reports/students'), ({ request }) => {
      seen.students.push(new URL(request.url).searchParams)
      return HttpResponse.json(page(students))
    }),
    http.get(api('/orgs/org-1/reports/teachers'), ({ request }) => {
      seen.teachers.push(new URL(request.url).searchParams)
      return HttpResponse.json(page(teachers))
    }),
  )
  return seen
}

const periodOf = (query: URLSearchParams | undefined) => ({
  from: query?.get('from'),
  to: query?.get('to'),
})

describe('finance tab', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(NOW)
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows this month’s totals and both tables to an organization admin', async () => {
    signedInAs(orgAdmin('org-1'))
    const seen = reports()
    renderApp('/org/org-1/finance')

    const tabs = await screen.findByRole('navigation', { name: 'Organization sections' })
    expect(within(tabs).getByRole('link', { name: 'Finance' })).toHaveAttribute(
      'href',
      '/org/org-1/finance',
    )
    const sidebar = screen.getByRole('complementary', { name: 'Primary' })
    expect(within(sidebar).getByRole('link', { name: 'Finance' })).toHaveAttribute(
      'href',
      '/org/org-1/finance',
    )
    expect(await screen.findByText('October 2026')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'This month' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )

    const totals = await screen.findByRole('list', { name: 'Totals for the period' })
    await within(totals).findByText('6')
    for (const [label, value] of [
      ['Paid by students', '6'],
      ['Used', '5'],
      ['Paid to teachers', '3'],
      ['Owed to teachers', '2'],
    ] as const) {
      const card = within(totals).getByText(label).closest('li')
      expect(card).not.toBeNull()
      expect(within(card!).getByText(value)).toBeInTheDocument()
    }
    expect(within(totals).getByText(/4 owed all time\./)).toBeInTheDocument()

    const students = await screen.findByRole('table', { name: STUDENTS })
    expect(await within(students).findByRole('link', { name: 'Kid Student' })).toHaveAttribute(
      'href',
      '/org/org-1/students/s-1',
    )
    // The names of the student's Lesson balances, for the same numbers.
    for (const header of ['Paid by student', 'Used', 'Prepaid left', 'Unpaid due']) {
      expect(within(students).getByRole('columnheader', { name: header })).toBeInTheDocument()
    }
    const teachers = screen.getByRole('table', { name: TEACHERS })
    expect(await within(teachers).findByRole('link', { name: 'Ana Pop' })).toHaveAttribute(
      'href',
      '/org/org-1/teachers/u-1',
    )
    expect(within(teachers).getByRole('link', { name: 'Payouts of Ana Pop' })).toHaveAttribute(
      'href',
      '/org/org-1/teachers/u-1#payouts',
    )

    expect(seen.summary.map(periodOf)).toEqual([OCTOBER])
    expect(periodOf(seen.students[0])).toEqual(OCTOBER)
    expect(periodOf(seen.teachers[0])).toEqual(OCTOBER)
    expect(seen.students[0]?.get('sort')).toBe('used,desc')
    expect(seen.teachers[0]?.get('sort')).toBe('taught,desc')
  })

  it('shows each mismatch with an icon and words, never colour alone', async () => {
    signedInAs(orgAdmin('org-1'))
    reports({
      teachers: [teacherFinanceRow({ usedPaidNotPaidOut: 2, paidOutNotPaidByStudent: 0 })],
    })
    renderApp('/org/org-1/finance')

    const table = await screen.findByRole('table', { name: TEACHERS })
    const row = await within(table).findByRole('row', { name: /Ana Pop/ })
    const flagged = within(row).getByText('2 lessons')
    expect(flagged.querySelector('svg')).not.toBeNull()
    expect(within(row).getByText('None')).toBeInTheDocument()

    const phones = screen.getByRole('list', { name: TEACHERS })
    expect(within(phones).getByText('2 lessons paid by student, not paid out')).toBeInTheDocument()
    expect(within(phones).queryByText(/paid out, not paid by student/)).not.toBeInTheDocument()
  })

  it('refetches for the previous month and for custom days, from the first page of each table', async () => {
    signedInAs(orgAdmin('org-1'))
    const seen = reports()
    const { router, user: actor } = renderApp(
      '/org/org-1/finance?studentsPage=1&teachersSort=owed,desc',
    )
    await screen.findByRole('table', { name: STUDENTS })
    await waitFor(() => expect(seen.students.at(-1)?.get('page')).toBe('1'))
    expect(seen.teachers.at(-1)?.get('sort')).toBe('owed,desc')

    await actor.click(screen.getByRole('button', { name: 'Previous month' }))

    expect(await screen.findByText('September 2026')).toBeInTheDocument()
    await waitFor(() => expect(periodOf(seen.summary.at(-1))).toEqual(SEPTEMBER))
    await waitFor(() => expect(periodOf(seen.students.at(-1))).toEqual(SEPTEMBER))
    expect(seen.students.at(-1)?.get('page')).toBe('0')
    await waitFor(() => expect(periodOf(seen.teachers.at(-1))).toEqual(SEPTEMBER))
    expect(seen.teachers.at(-1)?.get('sort')).toBe('owed,desc')
    expect(router.state.location.search).toContain('period=previous-month')

    await actor.click(screen.getByRole('button', { name: 'Custom' }))
    expect(screen.getByLabelText('First day')).toHaveValue('2026-09-01')
    const last = screen.getByLabelText('Last day')
    expect(last).toHaveValue('2026-09-30')
    await actor.clear(last)
    await actor.type(last, '2026-09-15')

    expect(await screen.findByText('1 Sep 2026 – 15 Sep 2026')).toBeInTheDocument()
    await waitFor(() =>
      expect(periodOf(seen.summary.at(-1))).toEqual({
        from: SEPTEMBER.from,
        to: new Date(2026, 8, 16).toISOString(),
      }),
    )
    expect(router.state.location.search).toContain('from=2026-09-01')
    expect(router.state.location.search).toContain('to=2026-09-15')

    const requests = seen.summary.length
    const first = screen.getByLabelText('First day')
    await actor.clear(first)
    await actor.type(first, '2026-09-20')
    expect(
      await screen.findByText('Pick a first and a last day, in that order.'),
    ).toBeInTheDocument()
    expect(screen.queryByRole('table', { name: STUDENTS })).not.toBeInTheDocument()
    expect(seen.summary).toHaveLength(requests)
  })

  it('sorts a table by a count through the API, leaving the other one as it was', async () => {
    signedInAs(orgAdmin('org-1'))
    const seen = reports()
    const { router, user: actor } = renderApp('/org/org-1/finance')

    const table = await screen.findByRole('table', { name: STUDENTS })
    await within(table).findByRole('link', { name: 'Kid Student' })
    await actor.click(within(table).getByRole('button', { name: 'Unpaid due' }))

    await waitFor(() => expect(seen.students.at(-1)?.get('sort')).toMatch(/^unpaidDue,(asc|desc)$/))
    expect(router.state.location.search).toMatch(/studentsSort=unpaidDue/)
    expect(seen.teachers.at(-1)?.get('sort')).toBe('taught,desc')
  })

  it('says so when nobody has had a lesson in the organization yet', async () => {
    signedInAs(orgAdmin('org-1'))
    reports({
      students: [],
      teachers: [],
      summary: {
        students: { paidByStudent: 0, used: 0, prepaidRemaining: 0, unpaidDue: 0 },
        teachers: {
          taught: 0,
          paidOut: 0,
          owed: 0,
          owedAllTime: 0,
          usedPaidNotPaidOut: 0,
          paidOutNotPaidByStudent: 0,
        },
      },
    })
    renderApp('/org/org-1/finance')

    expect((await screen.findAllByText('No students with lessons yet')).length).toBeGreaterThan(0)
    expect(screen.getAllByText('No teachers with lessons yet').length).toBeGreaterThan(0)
    const totals = screen.getByRole('list', { name: 'Totals for the period' })
    await waitFor(() => expect(within(totals).getAllByText('0')).toHaveLength(4))
    expect(within(totals).getByText(/0 owed all time\./)).toBeInTheDocument()
  })

  it('marks a teacher who left; an organization admin cannot open their page', async () => {
    signedInAs(orgAdmin('org-1'))
    reports({
      teachers: [teacherFinanceRow({ teacherId: 'u-2', name: 'Maria Former', active: false })],
    })
    renderApp('/org/org-1/finance')

    const table = await screen.findByRole('table', { name: TEACHERS })
    expect(await within(table).findByText('Maria Former')).toBeInTheDocument()
    expect(within(table).getByText('Former teacher')).toBeInTheDocument()
    expect(within(table).queryByRole('link', { name: 'Maria Former' })).not.toBeInTheDocument()
    expect(within(table).queryByRole('link', { name: /^Payouts of/ })).not.toBeInTheDocument()
  })

  it('links a teacher who left for the super-admin, who can open their page', async () => {
    signedInAs(superAdmin)
    reports({
      teachers: [teacherFinanceRow({ teacherId: 'u-2', name: 'Maria Former', active: false })],
    })
    renderApp('/platform/orgs/org-1/finance')

    const table = await screen.findByRole('table', { name: TEACHERS })
    expect(await within(table).findByRole('link', { name: 'Maria Former' })).toHaveAttribute(
      'href',
      '/platform/orgs/org-1/teachers/u-2',
    )
    expect(within(table).getByText('Former teacher')).toBeInTheDocument()
    expect(within(table).getByRole('link', { name: 'Payouts of Maria Former' })).toHaveAttribute(
      'href',
      '/platform/orgs/org-1/teachers/u-2#payouts',
    )
  })

  it('lands a Payouts link on the panel of the teacher’s page', async () => {
    // jsdom has no scrolling; the panel calls scrollIntoView only when it exists.
    const original = Element.prototype.scrollIntoView
    const scrolled = vi.fn()
    Element.prototype.scrollIntoView = scrolled
    try {
      signedInAs(orgAdmin('org-1'))
      server.use(
        http.get(api('/orgs/org-1'), () => HttpResponse.json(organization())),
        http.get(api('/orgs/org-1/members'), () => HttpResponse.json(page([]))),
        http.get(api('/courses'), () => HttpResponse.json(page([]))),
        http.get(api('/users/u-1'), () => HttpResponse.json(user())),
        http.get(api('/orgs/org-1/teachers/u-1/payable-lessons'), () =>
          HttpResponse.json(page([])),
        ),
        http.get(api('/orgs/org-1/teacher-payouts'), () => HttpResponse.json(page([]))),
      )
      renderApp('/org/org-1/teachers/u-1#payouts')

      const panel = await screen.findByRole('region', { name: 'Payouts' })
      expect(panel).toHaveAttribute('id', 'payouts')
      await waitFor(() => expect(scrolled).toHaveBeenCalled())
      expect(scrolled.mock.contexts[0]).toBe(panel)
    } finally {
      Element.prototype.scrollIntoView = original
    }
  })
})
