import { screen, waitFor, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw/http'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  course,
  freelanceTeacher,
  lesson,
  lessonDetail,
  member,
  orgAdmin,
  organization,
  page,
  recurringLesson,
  student,
  studentUser,
  summary,
  superAdmin,
  user,
} from '@/test/fixtures'
import { api, apiError, renderApp, signedInAs } from '@/test/render'
import { server } from '@/test/server'

/** A Wednesday, 12:00 in Europe/Bucharest (the test zone): "today" for the rules is 2026-10-28. */
const NOW = new Date('2026-10-28T10:00:00Z')

/** The student page of `s-1` in `org-1` for its admin, with no weekly lesson unless `rules` says so. */
function studentPage(rules: ReturnType<typeof recurringLesson>[]) {
  server.use(
    http.get(api('/orgs/org-1'), () => HttpResponse.json(organization())),
    http.get(api('/orgs/org-1/members'), () => HttpResponse.json(page([member()]))),
    http.get(api('/students/s-1'), () => HttpResponse.json(student())),
    http.get(api('/users/s-1'), () => HttpResponse.json(studentUser())),
    http.get(api('/users/u-1'), () => HttpResponse.json(user())),
    http.get(api('/courses/c-1'), () => HttpResponse.json(course())),
    http.get(api('/courses'), () => HttpResponse.json(page([course()]))),
    http.get(api('/students/s-1/lessons/summary'), () => HttpResponse.json(summary)),
    http.get(api('/students/s-1/enrollments'), () => HttpResponse.json(page([]))),
    http.get(api('/students/s-1/profiles'), () => HttpResponse.json([])),
    http.get(api('/homework'), () => HttpResponse.json(page([]))),
    http.get(api('/recurring-lessons'), ({ request }) => {
      const query = new URL(request.url).searchParams
      expect(query.get('studentId')).toBe('s-1')
      expect(query.get('status')).toBe('ACTIVE')
      return HttpResponse.json(page(rules))
    }),
  )
}

const RULE_ROW = 'Every Tuesday, 17:00–18:00'

describe('weekly lessons on the student page', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(NOW)
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('lists a rule with its teacher, course and next date, and settles a date the daily run could not book', async () => {
    signedInAs(orgAdmin('org-1'))
    const posted: string[] = []
    studentPage([
      recurringLesson({
        conflicts: [
          {
            occurrenceOn: '2026-11-03',
            scheduledAt: '2026-11-03T15:00:00Z',
            conflictWithLessonId: 'l-9',
          },
        ],
      }),
    ])
    server.use(
      http.post(api('/recurring-lessons/r-1/occurrences/2026-11-03/book'), async ({ request }) => {
        posted.push(`book ${JSON.stringify(await request.json())}`)
        return HttpResponse.json(lesson({ id: 'l-10', recurringLessonId: 'r-1' }), {
          status: 201,
        })
      }),
      http.post(api('/recurring-lessons/r-1/occurrences/2026-11-03/skip'), () => {
        posted.push('skip')
        return new HttpResponse(null, { status: 204 })
      }),
    )
    const { user: actor } = renderApp('/org/org-1/students/s-1')

    const panel = await screen.findByRole('region', { name: 'Weekly lessons' })
    expect(await within(panel).findByText(RULE_ROW)).toBeInTheDocument()
    expect(
      await within(panel).findByText('With Ana Pop · Piano — beginners · Next: 3 Nov 2026'),
    ).toBeInTheDocument()
    expect(within(panel).getByText(/1 date needs attention/)).toBeInTheDocument()
    expect(within(panel).getByRole('link', { name: 'Open the lesson in the way' })).toHaveAttribute(
      'href',
      '/org/org-1/lessons/l-9',
    )

    await actor.click(
      within(panel).getByRole('button', { name: 'Book anyway on 3 Nov 2026, 17:00–18:00' }),
    )
    expect(await screen.findByText('Lesson booked')).toBeInTheDocument()
    expect(posted).toEqual(['book {"allowOverlap":true}'])

    await actor.click(within(panel).getByRole('button', { name: 'Skip 3 Nov 2026, 17:00–18:00' }))
    const confirm = await screen.findByRole('alertdialog', { name: 'Skip this date' })
    expect(within(confirm).getByText(/even once the time frees up/)).toBeInTheDocument()
    await actor.click(within(confirm).getByRole('button', { name: 'Skip the date' }))
    expect(await screen.findByText('Date skipped')).toBeInTheDocument()
    expect(posted).toEqual(['book {"allowOverlap":true}', 'skip'])
  })

  it('sets a weekly lesson up for a named teacher after previewing the dates, and anyway on an overlap', async () => {
    signedInAs(orgAdmin('org-1'))
    const posted: Record<string, unknown>[] = []
    studentPage([])
    server.use(
      http.post(api('/recurring-lessons'), async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>
        posted.push(body)
        if (body.dryRun) {
          return HttpResponse.json({
            occurrences: [
              {
                occurrenceOn: '2026-11-03',
                scheduledAt: '2026-11-03T15:00:00Z',
                conflict: true,
                conflictWithLessonId: 'l-9',
              },
              {
                occurrenceOn: '2026-11-10',
                scheduledAt: '2026-11-10T15:00:00Z',
                conflict: false,
                conflictWithLessonId: null,
              },
            ],
          })
        }
        if (!body.allowOverlap) {
          return apiError(409, 'SCHEDULE_CONFLICT', '1 of the dates overlap another lesson')
        }
        return HttpResponse.json(
          { rule: recurringLesson(), lessons: [lesson({ recurringLessonId: 'r-1' })] },
          { status: 201 },
        )
      }),
    )
    const { user: actor } = renderApp('/org/org-1/students/s-1')

    const panel = await screen.findByRole('region', { name: 'Weekly lessons' })
    expect(await within(panel).findByText('No weekly lesson yet.')).toBeInTheDocument()
    await actor.click(within(panel).getByRole('button', { name: 'Set up weekly lesson' }))
    const sheet = await screen.findByRole('dialog', { name: 'Set up weekly lesson' })
    expect(
      within(sheet).getByText('Choose the teacher and the first lesson to see the dates.'),
    ).toBeInTheDocument()
    await actor.click(within(sheet).getByRole('combobox', { name: /Teacher/ }))
    await actor.click(await screen.findByRole('option', { name: /Ana Pop/ }))
    await actor.type(within(sheet).getByLabelText(/First lesson/), '2026-11-03T17:00')

    // The dry run follows the form: the first dates, one of them taken.
    const preview = await within(sheet).findByRole('region', { name: 'First dates' })
    expect(await within(preview).findByText('3 Nov 2026, 17:00–18:00')).toBeInTheDocument()
    expect(within(preview).getByText('10 Nov 2026, 17:00–18:00')).toBeInTheDocument()
    expect(within(preview).getByText('1 date overlaps other lessons')).toBeInTheDocument()
    expect(within(preview).getByRole('link', { name: 'Overlaps a lesson' })).toHaveAttribute(
      'href',
      '/org/org-1/lessons/l-9',
    )
    expect(posted).toHaveLength(1)
    expect(posted[0]).toMatchObject({
      dryRun: true,
      studentId: 's-1',
      teacherId: 'u-1',
      timeZone: 'Europe/Bucharest',
      intervalWeeks: 1,
      durationMinutes: 60,
    })
    expect(String(posted[0]?.firstAt)).toMatch(/^2026-11-03T15:00/)

    await actor.click(within(sheet).getByRole('button', { name: 'Set up weekly lesson' }))
    const confirm = await screen.findByRole('alertdialog', { name: 'This time is taken' })
    await actor.click(within(confirm).getByRole('button', { name: 'Set it up anyway' }))

    expect(await screen.findByText('Weekly lesson set up')).toBeInTheDocument()
    expect(posted.map((body) => [body.dryRun, body.allowOverlap])).toEqual([
      [true, undefined],
      [false, undefined],
      [false, true],
    ])
    expect(posted[2]).toMatchObject({ teacherId: 'u-1', studentId: 's-1' })
  })

  it('changes a rule from a date with only what changed, and says when the change starts a new rule', async () => {
    signedInAs(orgAdmin('org-1'))
    const patched: Record<string, unknown>[] = []
    studentPage([recurringLesson()])
    server.use(
      http.patch(api('/recurring-lessons/r-1'), async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>
        patched.push(body)
        if (body.dryRun) {
          return HttpResponse.json({
            occurrences: [
              {
                occurrenceOn: '2026-11-03',
                scheduledAt: '2026-11-03T16:30:00Z',
                conflict: false,
                conflictWithLessonId: null,
              },
            ],
          })
        }
        return HttpResponse.json({
          rule: recurringLesson({
            id: 'r-2',
            localTime: '18:30',
            startsOn: '2026-10-28',
            replacesId: 'r-1',
          }),
          lessons: [],
        })
      }),
    )
    const { user: actor } = renderApp('/org/org-1/students/s-1')

    const panel = await screen.findByRole('region', { name: 'Weekly lessons' })
    await actor.click(await within(panel).findByRole('button', { name: `Actions for ${RULE_ROW}` }))
    await actor.click(await screen.findByRole('menuitem', { name: 'Change from a date' }))
    const sheet = await screen.findByRole('dialog', { name: 'Change weekly lesson' })
    expect(within(sheet).getByLabelText(/From which date/)).toHaveValue('2026-10-28')
    expect(
      within(sheet).getByText('Change a setting to see the dates it would book.'),
    ).toBeInTheDocument()

    // Nothing changed: no request goes out.
    await actor.click(within(sheet).getByRole('button', { name: 'Apply from 28 Oct 2026' }))
    expect(
      await within(sheet).findByText(
        /Nothing to change: the weekly lesson already has these settings/,
      ),
    ).toBeInTheDocument()
    expect(patched).toHaveLength(0)

    const time = within(sheet).getByLabelText(/^Time/)
    await actor.clear(time)
    await actor.type(time, '18:30')
    const preview = await within(sheet).findByRole('region', { name: 'Dates after the change' })
    expect(await within(preview).findByText('3 Nov 2026, 18:30–19:30')).toBeInTheDocument()
    expect(patched).toEqual([{ effectiveFrom: '2026-10-28', localTime: '18:30', dryRun: true }])

    await actor.click(within(sheet).getByRole('button', { name: 'Apply from 28 Oct 2026' }))
    expect(await screen.findByText('Weekly lesson changed from 28 Oct 2026')).toBeInTheDocument()
    expect(patched[1]).toEqual({ effectiveFrom: '2026-10-28', localTime: '18:30', dryRun: false })
  })

  it('stops a rule after saying that paid lessons come back as credits', async () => {
    signedInAs(orgAdmin('org-1'))
    const ended: string[] = []
    studentPage([recurringLesson()])
    server.use(
      http.post(api('/recurring-lessons/r-1/end'), () => {
        ended.push('r-1')
        return HttpResponse.json(
          recurringLesson({ status: 'ENDED', endReason: 'STOPPED', endsOn: '2026-10-28' }),
        )
      }),
    )
    const { user: actor } = renderApp('/org/org-1/students/s-1')

    const panel = await screen.findByRole('region', { name: 'Weekly lessons' })
    await actor.click(await within(panel).findByRole('button', { name: `Actions for ${RULE_ROW}` }))
    await actor.click(await screen.findByRole('menuitem', { name: 'Stop weekly lesson' }))
    const confirm = await screen.findByRole('alertdialog', { name: 'Stop weekly lesson' })
    expect(
      within(confirm).getByText(/returns to the student’s lessons to schedule as a credit/),
    ).toBeInTheDocument()
    await actor.click(within(confirm).getByRole('button', { name: 'Stop weekly lesson' }))

    expect(await screen.findByText('Weekly lesson stopped')).toBeInTheDocument()
    expect(ended).toEqual(['r-1'])
  })

  it('offers the panel for a freelance teacher’s student with the teacher fixed', async () => {
    signedInAs(superAdmin)
    const freelancer = freelanceTeacher()
    const listed: string[] = []
    server.use(
      http.get(api('/freelance-teachers/f-1'), () => HttpResponse.json(freelancer)),
      http.get(api('/users/f-1'), () => HttpResponse.json(freelancer)),
      http.get(api('/students/s-f'), () => HttpResponse.json(student({ id: 's-f', name: 'Bo' }))),
      http.get(api('/users/s-f'), () =>
        HttpResponse.json(studentUser({ id: 's-f', name: 'Bo', organization: null })),
      ),
      http.get(api('/students/s-f/lessons/summary'), () => HttpResponse.json(summary)),
      http.get(api('/students/s-f/enrollments'), () => HttpResponse.json(page([]))),
      http.get(api('/students/s-f/profiles'), () => HttpResponse.json([])),
      http.get(api('/homework'), () => HttpResponse.json(page([]))),
      http.get(api('/courses'), () => HttpResponse.json(page([]))),
      http.get(api('/recurring-lessons'), ({ request }) => {
        listed.push(new URL(request.url).search)
        return HttpResponse.json(page([]))
      }),
    )
    const { user: actor } = renderApp('/platform/freelance/f-1/students/s-f')

    const panel = await screen.findByRole('region', { name: 'Weekly lessons' })
    expect(await within(panel).findByText('No weekly lesson yet.')).toBeInTheDocument()
    expect(listed[0]).toContain('teacherId=f-1')
    await actor.click(within(panel).getByRole('button', { name: 'Set up weekly lesson' }))
    const sheet = await screen.findByRole('dialog', { name: 'Set up weekly lesson' })
    expect(within(sheet).queryByRole('combobox', { name: /Teacher/ })).not.toBeInTheDocument()
    expect(within(sheet).getByText(/for Bo with Free Lancer/)).toBeInTheDocument()
  })
})

describe('the weekly lesson mark', () => {
  it('shows on ledger rows and on the lesson page, linking to the student’s weekly lessons', async () => {
    signedInAs(superAdmin)
    const weekly = lesson({
      recurringLessonId: 'r-1',
      occurrenceOn: '2026-10-20',
      followsRule: true,
    })
    server.use(
      http.get(api('/lessons'), () => HttpResponse.json(page([weekly, lesson({ id: 'l-2' })]))),
      http.get(api('/lessons/l-1'), () => HttpResponse.json(lessonDetail(weekly))),
      http.get(api('/users/u-1'), () => HttpResponse.json(user())),
      http.get(api('/students/s-1'), () => HttpResponse.json(student())),
      http.get(api('/courses/c-1'), () => HttpResponse.json(course())),
      http.get(api('/orgs'), () => HttpResponse.json(page([organization()]))),
      http.get(api('/orgs/org-1'), () => HttpResponse.json(organization())),
      http.get(api('/orgs/org-1/members'), () => HttpResponse.json(page([member()]))),
      http.get(api('/students'), () => HttpResponse.json(page([student()]))),
      http.get(api('/courses'), () => HttpResponse.json(page([course()]))),
      http.get(api('/students/s-1/lessons/summary'), () => HttpResponse.json(summary)),
      http.get(api('/homework'), () => HttpResponse.json(page([]))),
    )
    const { user: actor } = renderApp('/platform/lessons')

    const table = await screen.findByRole('table', { name: 'Lessons' })
    expect(await within(table).findAllByText('Kid Student')).toHaveLength(2)
    await waitFor(() => expect(within(table).getAllByText('Weekly lesson')).toHaveLength(1))

    await actor.click(within(table).getAllByRole('row')[1]!)
    expect(await screen.findByText('The date of 20 Oct 2026')).toBeInTheDocument()
    expect(screen.getByText(/Still follows its weekly lesson/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Open the student’s weekly lessons' })).toHaveAttribute(
      'href',
      '/platform/orgs/org-1/students/s-1#weekly-lessons',
    )
  })
})
