import { screen, waitFor, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw/http'
import { describe, expect, it } from 'vitest'
import type { User } from '@/api/types'
import { tokenStore } from '@/auth/tokenStore'
import { course, freelanceTeacher, page, rosterStudent, user } from '@/test/fixtures'
import { api, apiError, renderApp, signedInAs } from '@/test/render'
import { server } from '@/test/server'

/** What the workspace reads around the Profile page; `students` is the teacher's roster count. */
function quietWorkspace(students = 0) {
  server.use(
    http.get(api('/teacher/students'), ({ request }) => {
      const size = Number(new URL(request.url).searchParams.get('size'))
      const roster = Array.from({ length: Math.min(students, size) }, (_, i) =>
        rosterStudent({ id: `s-${i + 1}` }),
      )
      return HttpResponse.json(page(roster, { totalElements: students }))
    }),
    http.get(api('/courses'), () => HttpResponse.json(page([course()]))),
    http.get(api('/lessons'), () => HttpResponse.json(page([]))),
    http.get(api('/teacher/calendar'), () => HttpResponse.json([])),
    http.get(api('/teacher/lesson-totals'), () =>
      HttpResponse.json({ held: 0, paid: 0, balance: 0 }),
    ),
  )
}

/** Records every `DELETE /users/me` body and every `POST /auth/logout`. */
function recordCalls(answer: () => Response = () => new HttpResponse(null, { status: 204 })) {
  const deletes: unknown[] = []
  const logouts: unknown[] = []
  server.use(
    http.delete(api('/users/me'), async ({ request }) => {
      deletes.push(await request.json())
      return answer()
    }),
    http.post(api('/auth/logout'), async ({ request }) => {
      logouts.push(await request.json())
      return new HttpResponse(null, { status: 204 })
    }),
  )
  return { deletes, logouts }
}

async function openSheet(me: User) {
  signedInAs(me)
  const app = renderApp('/teach/profile')
  await app.user.click(await screen.findByRole('button', { name: 'Delete account' }))
  const sheet = await screen.findByRole('dialog', { name: 'Delete account' })
  return { ...app, sheet }
}

describe('Delete account in the teacher workspace (D-060)', () => {
  it('a school teacher confirms with their password, is signed out without a logout call and lands on sign-in', async () => {
    quietWorkspace()
    const calls = recordCalls()
    const { user: actor, sheet, router } = await openSheet(user())

    expect(within(sheet).getByText(/Riverside Music School keeps the lessons/)).toBeInTheDocument()
    await actor.click(within(sheet).getByRole('button', { name: 'Delete account' }))
    expect(await within(sheet).findByText('This field is required')).toBeInTheDocument()

    await actor.type(within(sheet).getByLabelText(/^Password/), 'my secret')
    await actor.click(within(sheet).getByRole('button', { name: 'Delete account' }))
    const confirm = await screen.findByRole('alertdialog', { name: 'Delete your account?' })
    expect(calls.deletes).toEqual([])
    await actor.click(within(confirm).getByRole('button', { name: 'Delete account' }))

    expect(await screen.findByText('Your account was deleted.')).toBeInTheDocument()
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'))
    expect(calls.deletes).toEqual([{ password: 'my secret' }])
    expect(calls.logouts).toEqual([])
    expect(tokenStore.getRefreshToken()).toBeNull()
  })

  it('shows a wrong password on the field, in the workspace own words, and stays signed in', async () => {
    quietWorkspace()
    const calls = recordCalls(() =>
      apiError(400, 'VALIDATION_FAILED', 'Validation failed', [
        { field: 'password', message: 'Incorrect password' },
      ]),
    )
    const { user: actor, sheet, router } = await openSheet(user())

    await actor.type(within(sheet).getByLabelText(/^Password/), 'wrong')
    await actor.click(within(sheet).getByRole('button', { name: 'Delete account' }))
    const confirm = await screen.findByRole('alertdialog', { name: 'Delete your account?' })
    await actor.click(within(confirm).getByRole('button', { name: 'Delete account' }))

    expect(await within(sheet).findByText('That is not your password.')).toBeInTheDocument()
    expect(screen.queryByText('Incorrect password')).not.toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    expect(calls.deletes).toHaveLength(1)
    expect(router.state.location.pathname).toBe('/teach/profile')
    expect(tokenStore.getRefreshToken()).toBe('test-refresh')
  })

  it('tells a freelance teacher with students to remove them first, with no button that would fail', async () => {
    quietWorkspace(2)
    const calls = recordCalls()
    const { user: actor, sheet, router } = await openSheet(freelanceTeacher())

    expect(
      await within(sheet).findByText(/You still have 2 students\. Remove them first/),
    ).toBeInTheDocument()
    expect(within(sheet).queryByLabelText(/^Password/)).not.toBeInTheDocument()
    expect(within(sheet).getByRole('button', { name: 'Delete account' })).toBeDisabled()

    await actor.click(within(sheet).getByRole('button', { name: 'Go to Students' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/teach/students'))
    expect(calls.deletes).toEqual([])
  })

  it('lets a freelance teacher without students delete their account', async () => {
    quietWorkspace(0)
    const calls = recordCalls()
    const { user: actor, sheet } = await openSheet(freelanceTeacher())

    expect(within(sheet).getByText(/Your courses are archived/)).toBeInTheDocument()
    await actor.type(await within(sheet).findByLabelText(/^Password/), 'my secret')
    await actor.click(within(sheet).getByRole('button', { name: 'Delete account' }))
    const confirm = await screen.findByRole('alertdialog', { name: 'Delete your account?' })
    await actor.click(within(confirm).getByRole('button', { name: 'Delete account' }))

    await waitFor(() => expect(calls.deletes).toEqual([{ password: 'my secret' }]))
  })
})
