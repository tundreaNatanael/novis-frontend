import { screen, waitFor, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw/http'
import { beforeEach, describe, expect, it } from 'vitest'
import type { Homework } from '@/api/types'
import { endOfLocalDay, toDateInput } from '@/lib/format'
import {
  course,
  homework,
  lessonDetail,
  member,
  orgAdmin,
  organization,
  page,
  student,
  studentEnrollment,
  studentUser,
  summary,
  superAdmin,
  user,
} from '@/test/fixtures'
import { api, apiError, renderApp, signedInAs } from '@/test/render'
import { server } from '@/test/server'
import { HOMEWORK_FORBIDDEN } from './homework-state'

describe('homework on a lesson', () => {
  beforeEach(() => {
    signedInAs(superAdmin)
    server.use(
      http.get(api('/users/u-1'), () => HttpResponse.json(user())),
      http.get(api('/students/s-1'), () => HttpResponse.json(student())),
      http.get(api('/courses/c-1'), () => HttpResponse.json(course())),
      http.get(api('/orgs/org-1'), () => HttpResponse.json(organization())),
      http.get(api('/orgs'), () => HttpResponse.json(page([organization()]))),
      http.get(api('/students/s-1/lessons/summary'), () => HttpResponse.json(summary)),
      http.get(api('/students/s-1/enrollments'), () =>
        HttpResponse.json(page([studentEnrollment()])),
      ),
      http.get(api('/lessons/l-1'), () =>
        HttpResponse.json(lessonDetail({ status: 'PRESENT', closedAt: '2026-10-20T16:00:00Z' })),
      ),
    )
  })

  it('lists the lesson’s homework and assigns more with the lesson and its course preselected', async () => {
    const queries: URLSearchParams[] = []
    const posted: Record<string, unknown>[] = []
    let assigned: Homework[] = [
      homework({
        lessonId: 'l-1',
        lessonScheduledAt: '2026-10-20T15:00:00Z',
        dueAt: '2026-10-21T21:59:59Z',
      }),
    ]
    server.use(
      http.get(api('/homework'), ({ request }) => {
        queries.push(new URL(request.url).searchParams)
        return HttpResponse.json(page(assigned))
      }),
      http.post(api('/homework'), async ({ request }) => {
        posted.push((await request.json()) as Record<string, unknown>)
        const created = homework({
          id: 'hw-2',
          title: 'Scales again',
          lessonId: 'l-1',
          courseId: 'c-1',
          courseTitle: 'Piano — beginners',
          dueAt: '2026-10-30T21:59:59Z',
          items: [{ id: 'hi-9', text: 'G major', done: false, position: 0 }],
        })
        assigned = [...assigned, created]
        return HttpResponse.json(created, { status: 201 })
      }),
    )
    const { user: actor } = renderApp('/platform/lessons/l-1')

    const panel = await screen.findByRole('region', { name: 'Homework' })
    expect(await within(panel).findByText('Weekly practice')).toBeInTheDocument()
    expect(within(panel).getByText('Overdue')).toBeInTheDocument()
    expect(within(panel).getByText(/1 of 2 done/)).toBeInTheDocument()
    expect(queries[0]?.get('lessonId')).toBe('l-1')
    expect(queries[0]?.getAll('sort')).toEqual(['status,asc', 'dueAt,asc'])

    await actor.click(within(panel).getByRole('button', { name: 'Assign homework' }))
    const dialog = await screen.findByRole('dialog', { name: 'Assign homework' })
    expect(within(dialog).queryByRole('combobox', { name: /Teacher/ })).not.toBeInTheDocument()
    await waitFor(() =>
      expect(within(dialog).getByRole('combobox', { name: /Course/ })).toHaveTextContent(
        'Piano — beginners',
      ),
    )
    await actor.type(within(dialog).getByLabelText(/^Title/), 'Scales again')
    await actor.type(within(dialog).getByLabelText(/^Due date/), '2026-10-30')
    await actor.type(within(dialog).getByLabelText('Checklist item 1'), 'G major')
    await actor.click(within(dialog).getByRole('button', { name: 'Assign homework' }))

    expect(await screen.findByText('Homework assigned')).toBeInTheDocument()
    expect(posted).toEqual([
      {
        studentId: 's-1',
        teacherId: 'u-1',
        lessonId: 'l-1',
        courseId: 'c-1',
        title: 'Scales again',
        dueAt: endOfLocalDay('2026-10-30'),
        items: [{ text: 'G major' }],
      },
    ])
    expect(await within(panel).findByText('Scales again')).toBeInTheDocument()
  })

  it('needs at least one checklist item and drops the course when the student left it', async () => {
    const posted: Record<string, unknown>[] = []
    server.use(
      http.get(api('/homework'), () => HttpResponse.json(page([]))),
      // The lesson's course is no longer one of the student's active courses.
      http.get(api('/students/s-1/enrollments'), () =>
        HttpResponse.json(page([studentEnrollment({ status: 'DROPPED' })])),
      ),
      http.post(api('/homework'), async ({ request }) => {
        posted.push((await request.json()) as Record<string, unknown>)
        return HttpResponse.json(homework(), { status: 201 })
      }),
    )
    const { user: actor } = renderApp('/platform/lessons/l-1')

    const panel = await screen.findByRole('region', { name: 'Homework' })
    expect(await within(panel).findByText('No homework for this lesson yet.')).toBeInTheDocument()
    await actor.click(within(panel).getByRole('button', { name: 'Assign homework' }))
    const dialog = await screen.findByRole('dialog', { name: 'Assign homework' })
    await waitFor(() =>
      expect(within(dialog).getByRole('combobox', { name: /Course/ })).toHaveTextContent(
        'No course',
      ),
    )
    await actor.click(within(dialog).getByRole('button', { name: 'Assign homework' }))
    expect(await within(dialog).findByText('Add at least one checklist item')).toBeInTheDocument()
    expect(posted).toEqual([])

    await actor.type(within(dialog).getByLabelText('Checklist item 1'), 'Scales')
    await actor.click(within(dialog).getByRole('button', { name: 'Add item' }))
    await actor.click(within(dialog).getByRole('button', { name: 'Assign homework' }))
    expect(await screen.findByText('Homework assigned')).toBeInTheDocument()
    expect(posted).toEqual([
      { studentId: 's-1', teacherId: 'u-1', lessonId: 'l-1', items: [{ text: 'Scales' }] },
    ])
  })

  it('edits a homework: only what changed goes out, with the ticks the student made meanwhile', async () => {
    const reads: string[] = []
    const patched: Record<string, unknown>[] = []
    let current = homework({ lessonId: 'l-1', lessonScheduledAt: '2026-10-20T15:00:00Z' })
    server.use(
      http.get(api('/homework'), () => HttpResponse.json(page([current]))),
      // The student ticked "Etude no. 3" while the sheet was open.
      http.get(api('/homework/hw-1'), () => {
        reads.push('hw-1')
        return HttpResponse.json({
          ...current,
          items: current.items.map((item) => ({ ...item, done: true })),
        })
      }),
      http.patch(api('/homework/hw-1'), async ({ request }) => {
        const body = (await request.json()) as {
          title: string
          items: { text: string; done: boolean }[]
        }
        patched.push(body)
        current = homework({
          ...current,
          title: body.title,
          items: body.items.map((item, position) => ({
            id: `hi-${position + 10}`,
            position,
            ...item,
          })),
        })
        return HttpResponse.json(current)
      }),
    )
    const { user: actor } = renderApp('/platform/lessons/l-1')

    const panel = await screen.findByRole('region', { name: 'Homework' })
    await actor.click(
      await within(panel).findByRole('button', { name: 'Actions for Weekly practice' }),
    )
    await actor.click(await screen.findByRole('menuitem', { name: /Edit homework/ }))
    const dialog = await screen.findByRole('dialog', { name: 'Edit homework' })
    // The teacher and the course stay as assigned; the ticks are the student's.
    expect(within(dialog).queryByRole('combobox')).not.toBeInTheDocument()
    expect(within(dialog).getByText('Ticked by the student')).toBeInTheDocument()
    expect(within(dialog).getByText('Not ticked yet')).toBeInTheDocument()
    const title = within(dialog).getByLabelText(/^Title/)
    await actor.clear(title)
    await actor.type(title, 'Scales week')
    await actor.type(within(dialog).getByLabelText('Checklist item 1'), ', hands together')
    await actor.click(within(dialog).getByRole('button', { name: 'Add item' }))
    await actor.type(within(dialog).getByLabelText('Checklist item 3'), 'Sight-read page 4')
    await actor.click(within(dialog).getByRole('button', { name: 'Save homework' }))

    expect(await screen.findByText('Homework saved')).toBeInTheDocument()
    expect(reads).toEqual(['hw-1'])
    expect(patched).toEqual([
      {
        title: 'Scales week',
        items: [
          { text: 'C major scale, hands together', done: true },
          { text: 'Etude no. 3', done: true },
          { text: 'Sight-read page 4', done: false },
        ],
      },
    ])
    expect(await within(panel).findByText('Scales week')).toBeInTheDocument()
  })

  it('sends nothing when nothing changed and removes a cleared due date with null', async () => {
    const requests: string[] = []
    const patched: unknown[] = []
    let current = homework({ lessonId: 'l-1' })
    server.use(
      http.get(api('/homework'), () => HttpResponse.json(page([current]))),
      http.get(api('/homework/hw-1'), () => {
        requests.push('GET')
        return HttpResponse.json(current)
      }),
      http.patch(api('/homework/hw-1'), async ({ request }) => {
        requests.push('PATCH')
        const body = (await request.json()) as { dueAt: null }
        patched.push(body)
        current = homework({ ...current, dueAt: body.dueAt })
        return HttpResponse.json(current)
      }),
    )
    const { user: actor } = renderApp('/platform/lessons/l-1')

    const panel = await screen.findByRole('region', { name: 'Homework' })
    const openEdit = async () => {
      await actor.click(
        await within(panel).findByRole('button', { name: 'Actions for Weekly practice' }),
      )
      await actor.click(await screen.findByRole('menuitem', { name: /Edit homework/ }))
      return screen.findByRole('dialog', { name: 'Edit homework' })
    }

    let dialog = await openEdit()
    await actor.click(within(dialog).getByRole('button', { name: 'Save homework' }))
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Edit homework' })).not.toBeInTheDocument(),
    )
    expect(requests).toEqual([])

    dialog = await openEdit()
    const due = within(dialog).getByLabelText(/^Due date/)
    expect(due).toHaveValue(toDateInput(homework().dueAt))
    await actor.click(within(dialog).getByRole('button', { name: 'Clear due date' }))
    expect(due).toHaveValue('')
    expect(within(dialog).queryByRole('button', { name: 'Clear due date' })).not.toBeInTheDocument()
    await actor.click(within(dialog).getByRole('button', { name: 'Save homework' }))

    expect(await screen.findByText('Homework saved')).toBeInTheDocument()
    expect(requests).toEqual(['PATCH'])
    expect(patched).toEqual([{ dueAt: null }])
    expect(await within(panel).findByText(/^No due date/)).toBeInTheDocument()
  })
})

describe('editing and deleting homework as an organization admin', () => {
  beforeEach(() => {
    signedInAs(orgAdmin('org-1'))
    server.use(
      http.get(api('/orgs/org-1'), () => HttpResponse.json(organization())),
      http.get(api('/orgs/org-1/members'), () => HttpResponse.json(page([member()]))),
      http.get(api('/users/u-1'), () => HttpResponse.json(user())),
      http.get(api('/users/s-1'), () => HttpResponse.json(studentUser())),
      http.get(api('/students/s-1'), () => HttpResponse.json(student())),
      http.get(api('/courses/c-1'), () => HttpResponse.json(course())),
      http.get(api('/students/s-1/lessons/summary'), () => HttpResponse.json(summary)),
      http.get(api('/students/s-1/enrollments'), () =>
        HttpResponse.json(page([studentEnrollment()])),
      ),
      http.get(api('/lessons/l-1'), () => HttpResponse.json(lessonDetail())),
    )
  })

  it('deletes a lesson’s homework after confirming, on the /org lesson detail', async () => {
    let assigned = [homework({ lessonId: 'l-1' })]
    const deleted: string[] = []
    server.use(
      http.get(api('/homework'), () => HttpResponse.json(page(assigned))),
      http.delete(api('/homework/:id'), ({ params }) => {
        deleted.push(String(params.id))
        assigned = []
        return new HttpResponse(null, { status: 204 })
      }),
    )
    const { user: actor } = renderApp('/org/org-1/lessons/l-1')

    const panel = await screen.findByRole('region', { name: 'Homework' })
    await actor.click(
      await within(panel).findByRole('button', { name: 'Actions for Weekly practice' }),
    )
    await actor.click(await screen.findByRole('menuitem', { name: /Delete homework/ }))
    const dialog = await screen.findByRole('alertdialog')
    expect(within(dialog).getByText(/1 of 2 done/)).toBeInTheDocument()
    expect(deleted).toEqual([])
    await actor.click(within(dialog).getByRole('button', { name: 'Delete homework' }))

    expect(await screen.findByText('Homework deleted')).toBeInTheDocument()
    expect(deleted).toEqual(['hw-1'])
    expect(await within(panel).findByText('No homework for this lesson yet.')).toBeInTheDocument()
  })

  it('explains a homework that is gone or out of reach and refreshes the student’s list', async () => {
    let assigned = [homework()]
    server.use(
      http.get(api('/homework'), () => HttpResponse.json(page(assigned))),
      http.delete(api('/homework/hw-1'), () => {
        // Deleted meanwhile, or not in the admin's organization: the API answers 404 either way.
        assigned = []
        return apiError(404, 'NOT_FOUND', 'Homework not found: hw-1')
      }),
    )
    const { user: actor } = renderApp('/org/org-1/students/s-1')

    const panel = await screen.findByRole('region', { name: 'Homework' })
    await actor.click(
      await within(panel).findByRole('button', { name: 'Actions for Weekly practice' }),
    )
    await actor.click(await screen.findByRole('menuitem', { name: /Delete homework/ }))
    const dialog = await screen.findByRole('alertdialog')
    await actor.click(within(dialog).getByRole('button', { name: 'Delete homework' }))

    expect(
      await within(dialog).findByText(/no longer exists or is out of your reach/),
    ).toBeInTheDocument()
    expect(await within(panel).findByText('No homework yet.')).toBeInTheDocument()
  })
})

describe('homework the server refuses to change', () => {
  it('disables the row’s Edit and Delete with the reason after a 403', async () => {
    signedInAs(superAdmin)
    server.use(
      http.get(api('/orgs'), () => HttpResponse.json(page([organization()]))),
      http.get(api('/orgs/org-1'), () => HttpResponse.json(organization())),
      http.get(api('/orgs/org-1/members'), () => HttpResponse.json(page([member()]))),
      http.get(api('/students/s-1'), () => HttpResponse.json(student())),
      http.get(api('/users/s-1'), () => HttpResponse.json(studentUser())),
      http.get(api('/students/s-1/lessons/summary'), () => HttpResponse.json(summary)),
      http.get(api('/students/s-1/enrollments'), () =>
        HttpResponse.json(page([studentEnrollment()])),
      ),
      http.get(api('/homework'), () => HttpResponse.json(page([homework()]))),
      http.patch(api('/homework/hw-1'), () =>
        apiError(403, 'FORBIDDEN', 'Student tokens are read-only'),
      ),
    )
    const { user: actor } = renderApp('/platform/orgs/org-1/students/s-1')

    const panel = await screen.findByRole('region', { name: 'Homework' })
    await actor.click(
      await within(panel).findByRole('button', { name: 'Actions for Weekly practice' }),
    )
    await actor.click(await screen.findByRole('menuitem', { name: /Edit homework/ }))
    const dialog = await screen.findByRole('dialog', { name: 'Edit homework' })
    await actor.type(within(dialog).getByLabelText(/^Notes/), 'Slowly')
    await actor.click(within(dialog).getByRole('button', { name: 'Save homework' }))
    expect(await within(dialog).findByText(HOMEWORK_FORBIDDEN)).toBeInTheDocument()
    await actor.click(within(dialog).getByRole('button', { name: 'Cancel' }))

    await actor.click(
      await within(panel).findByRole('button', { name: 'Actions for Weekly practice' }),
    )
    const edit = await screen.findByRole('menuitem', { name: /Edit homework/ })
    expect(edit).toHaveAttribute('aria-disabled', 'true')
    expect(edit).toHaveTextContent(HOMEWORK_FORBIDDEN)
    expect(screen.getByRole('menuitem', { name: /Delete homework/ })).toHaveAttribute(
      'aria-disabled',
      'true',
    )
  })
})

describe('homework on a student’s page', () => {
  beforeEach(() => {
    signedInAs(orgAdmin('org-1'))
    server.use(
      http.get(api('/orgs/org-1'), () => HttpResponse.json(organization())),
      http.get(api('/orgs/org-1/members'), () => HttpResponse.json(page([member()]))),
      http.get(api('/students/s-1'), () => HttpResponse.json(student())),
      http.get(api('/users/s-1'), () => HttpResponse.json(studentUser())),
      http.get(api('/students/s-1/lessons/summary'), () => HttpResponse.json(summary)),
      http.get(api('/students/s-1/enrollments'), () =>
        HttpResponse.json(page([studentEnrollment()])),
      ),
    )
  })

  it('shows the student’s homework and assigns weekly practice for a teacher of the organization', async () => {
    const queries: URLSearchParams[] = []
    const posted: Record<string, unknown>[] = []
    server.use(
      http.get(api('/homework'), ({ request }) => {
        queries.push(new URL(request.url).searchParams)
        return HttpResponse.json(
          page([
            homework({
              completedAt: '2026-10-22T10:00:00Z',
              items: [{ id: 'hi-1', text: 'C major scale', done: true, position: 0 }],
            }),
          ]),
        )
      }),
      http.post(api('/homework'), async ({ request }) => {
        posted.push((await request.json()) as Record<string, unknown>)
        return HttpResponse.json(homework({ id: 'hw-2' }), { status: 201 })
      }),
    )
    const { user: actor } = renderApp('/org/org-1/students/s-1')

    const panel = await screen.findByRole('region', { name: 'Homework' })
    expect(await within(panel).findByText('Done')).toBeInTheDocument()
    expect(within(panel).getByText(/Ana Pop/)).toBeInTheDocument()
    expect(queries[0]?.get('studentId')).toBe('s-1')
    expect(queries[0]?.has('teacherId')).toBe(false)

    await actor.click(within(panel).getByRole('button', { name: 'Assign homework' }))
    const dialog = await screen.findByRole('dialog', { name: 'Assign homework' })
    await actor.click(within(dialog).getByRole('combobox', { name: /Teacher/ }))
    await actor.click(await screen.findByRole('option', { name: /Ana Pop/ }))
    await actor.type(within(dialog).getByLabelText(/^Title/), 'Weekly practice')
    await actor.type(within(dialog).getByLabelText('Checklist item 1'), '20 minutes a day')
    await actor.click(within(dialog).getByRole('button', { name: 'Assign homework' }))

    expect(await screen.findByText('Homework assigned')).toBeInTheDocument()
    expect(posted).toEqual([
      {
        studentId: 's-1',
        teacherId: 'u-1',
        title: 'Weekly practice',
        items: [{ text: '20 minutes a day' }],
      },
    ])
  })

  it('explains a student the teacher cannot reach', async () => {
    server.use(
      http.get(api('/homework'), () => HttpResponse.json(page([]))),
      http.post(api('/homework'), () => apiError(404, 'NOT_FOUND', 'Student not found: s-1')),
    )
    const { user: actor } = renderApp('/org/org-1/students/s-1')

    const panel = await screen.findByRole('region', { name: 'Homework' })
    await actor.click(await within(panel).findByRole('button', { name: 'Assign homework' }))
    const dialog = await screen.findByRole('dialog', { name: 'Assign homework' })
    await actor.click(within(dialog).getByRole('combobox', { name: /Teacher/ }))
    await actor.click(await screen.findByRole('option', { name: /Ana Pop/ }))
    await actor.type(within(dialog).getByLabelText('Checklist item 1'), 'Scales')
    await actor.click(within(dialog).getByRole('button', { name: 'Assign homework' }))

    expect(
      await within(dialog).findByText(/not on the teacher’s roster and not enrolled/),
    ).toBeInTheDocument()
  })
})
