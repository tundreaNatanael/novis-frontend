import { screen, waitFor, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw/http'
import { beforeEach, describe, expect, it } from 'vitest'
import type { CreateTeacherPayoutRequest, VoidTeacherPayoutRequest } from '@/api/types'
import {
  course,
  lessonDetail,
  orgAdmin,
  organization,
  page,
  payoutLesson,
  student,
  summary,
  superAdmin,
  teacherPayout,
  teacherPayoutDetail,
  user,
} from '@/test/fixtures'
import { api, apiError, renderApp, signedInAs } from '@/test/render'
import { server } from '@/test/server'
import { todayInput, upToInstant } from './payout-state'

const PAYABLE = '/orgs/org-1/teachers/u-1/payable-lessons'
const PAYOUTS = '/orgs/org-1/teacher-payouts'

/** The teacher's page around the panel: the organization, the account and its courses. */
function teacherPage() {
  server.use(
    http.get(api('/orgs/org-1'), () => HttpResponse.json(organization())),
    http.get(api('/orgs/org-1/members'), () => HttpResponse.json(page([]))),
    http.get(api('/courses'), () => HttpResponse.json(page([]))),
    http.get(api('/users/u-1'), () => HttpResponse.json(user())),
  )
}

const held = payoutLesson()
const late = payoutLesson({
  id: 'l-late',
  scheduledAt: '2026-10-08T15:00:00Z',
  status: 'CANCELED_LATE',
  courseId: null,
  courseTitle: null,
})

describe('teacher payouts panel', () => {
  beforeEach(() => {
    signedInAs(orgAdmin('org-1'))
    teacherPage()
  })

  it('shows what the organization owes and records a payout of the ticked lessons', async () => {
    const posted: CreateTeacherPayoutRequest[] = []
    server.use(
      http.get(api(PAYABLE), () => HttpResponse.json(page([held, late]))),
      http.get(api(PAYOUTS), () => HttpResponse.json(page([]))),
      http.post(api(PAYOUTS), async ({ request }) => {
        posted.push((await request.json()) as CreateTeacherPayoutRequest)
        return HttpResponse.json(teacherPayoutDetail({ lessonCount: 1 }, [held]), { status: 201 })
      }),
    )
    const { user: actor } = renderApp('/org/org-1/teachers/u-1')

    const panel = await screen.findByRole('region', { name: 'Payouts' })
    expect(await within(panel).findByText('2 lessons')).toBeInTheDocument()
    expect(within(panel).getByText(/not the students’ payments/i)).toBeInTheDocument()
    expect(within(panel).getByRole('button', { name: 'Record payout' })).toBeDisabled()

    const boxes = within(panel).getAllByRole('checkbox', { name: /^Select the lesson of/ })
    expect(boxes).toHaveLength(2)
    await actor.click(boxes[0]!)
    await actor.click(within(panel).getByRole('button', { name: 'Record payout (1 lesson)' }))

    const sheet = await screen.findByRole('dialog', { name: 'Record payout' })
    expect(within(sheet).getByText('1 lesson selected in the table.')).toBeInTheDocument()
    expect(within(sheet).getByLabelText(/^Paid on/)).toHaveValue(todayInput())
    await actor.type(within(sheet).getByLabelText(/^Note/), '1,200 RON, bank transfer')
    await actor.click(within(sheet).getByRole('button', { name: 'Record payout of 1 lesson' }))

    expect(await screen.findByText('Payout recorded')).toBeInTheDocument()
    expect(posted).toEqual([
      {
        teacherId: 'u-1',
        paidOn: todayInput(),
        lessonIds: ['l-held-1'],
        note: '1,200 RON, bank transfer',
      },
    ])
  })

  it('pays everything up to a day, sending the start of the next local day as upTo', async () => {
    const posted: CreateTeacherPayoutRequest[] = []
    const counted: (string | null)[] = []
    server.use(
      http.get(api(PAYABLE), ({ request }) => {
        const to = new URL(request.url).searchParams.get('to')
        counted.push(to)
        return HttpResponse.json(to ? page([held], { totalElements: 3 }) : page([held, late]))
      }),
      http.get(api(PAYOUTS), () => HttpResponse.json(page([]))),
      http.post(api(PAYOUTS), async ({ request }) => {
        posted.push((await request.json()) as CreateTeacherPayoutRequest)
        return HttpResponse.json(teacherPayoutDetail({ lessonCount: 3 }), { status: 201 })
      }),
    )
    const { user: actor } = renderApp('/org/org-1/teachers/u-1')

    const panel = await screen.findByRole('region', { name: 'Payouts' })
    await actor.click(await within(panel).findByRole('button', { name: /Pay everything up to/ }))
    const sheet = await screen.findByRole('dialog', { name: 'Record payout' })
    const day = within(sheet).getByLabelText(/^Pay everything up to/)
    await actor.clear(day)
    await actor.type(day, '2026-10-15')

    expect(
      await within(sheet).findByText('3 lessons up to and including 15 Oct 2026.'),
    ).toBeInTheDocument()
    expect(counted).toContain(upToInstant('2026-10-15'))
    await actor.click(within(sheet).getByRole('button', { name: 'Record payout of 3 lessons' }))

    expect(await screen.findByText('Payout recorded')).toBeInTheDocument()
    expect(posted).toEqual([
      { teacherId: 'u-1', paidOn: todayInput(), upTo: upToInstant('2026-10-15') },
    ])
  })

  it('explains a 409 and refreshes the lessons someone else paid meanwhile', async () => {
    let payableReads = 0
    server.use(
      http.get(api(PAYABLE), () => {
        payableReads += 1
        return HttpResponse.json(page([held, late]))
      }),
      http.get(api(PAYOUTS), () => HttpResponse.json(page([]))),
      http.post(api(PAYOUTS), () =>
        apiError(409, 'CONFLICT', '1 of these lessons is already paid out'),
      ),
    )
    const { user: actor } = renderApp('/org/org-1/teachers/u-1')

    const panel = await screen.findByRole('region', { name: 'Payouts' })
    await actor.click(
      (await within(panel).findAllByRole('checkbox', { name: /^Select the lesson of/ }))[0]!,
    )
    await actor.click(within(panel).getByRole('button', { name: 'Record payout (1 lesson)' }))
    const sheet = await screen.findByRole('dialog', { name: 'Record payout' })
    const before = payableReads
    await actor.click(within(sheet).getByRole('button', { name: 'Record payout of 1 lesson' }))

    expect(
      await within(sheet).findByText('1 of these lessons is already paid out'),
    ).toBeInTheDocument()
    await waitFor(() => expect(payableReads).toBeGreaterThan(before))
  })

  it('refuses a payout dated in the future before sending it', async () => {
    let posts = 0
    server.use(
      http.get(api(PAYABLE), () => HttpResponse.json(page([held]))),
      http.get(api(PAYOUTS), () => HttpResponse.json(page([]))),
      http.post(api(PAYOUTS), () => {
        posts += 1
        return HttpResponse.json(teacherPayoutDetail(), { status: 201 })
      }),
    )
    const { user: actor } = renderApp('/org/org-1/teachers/u-1')

    const panel = await screen.findByRole('region', { name: 'Payouts' })
    await actor.click(
      (await within(panel).findAllByRole('checkbox', { name: /^Select the lesson of/ }))[0]!,
    )
    await actor.click(within(panel).getByRole('button', { name: 'Record payout (1 lesson)' }))
    const sheet = await screen.findByRole('dialog', { name: 'Record payout' })
    const paidOn = within(sheet).getByLabelText(/^Paid on/)
    await actor.clear(paidOn)
    await actor.type(paidOn, '2099-01-01')
    await actor.click(within(sheet).getByRole('button', { name: 'Record payout of 1 lesson' }))

    expect(
      await within(sheet).findByText('The day the organization paid cannot be in the future'),
    ).toBeInTheDocument()
    expect(posts).toBe(0)
  })

  it('lists the history, opens a payout’s lessons and voids it after a reason and typing “void”', async () => {
    const voided: VoidTeacherPayoutRequest[] = []
    server.use(
      http.get(api(PAYABLE), () => HttpResponse.json(page([]))),
      http.get(api(PAYOUTS), () => HttpResponse.json(page([teacherPayout()]))),
      http.get(api('/teacher-payouts/p-1'), () => HttpResponse.json(teacherPayoutDetail())),
      http.post(api('/teacher-payouts/p-1/void'), async ({ request }) => {
        voided.push((await request.json()) as VoidTeacherPayoutRequest)
        return HttpResponse.json(
          teacherPayoutDetail(
            {
              voidedAt: '2026-10-24T10:00:00Z',
              voidedById: 'admin-1',
              voidReason: 'Recorded twice',
            },
            [],
          ),
        )
      }),
    )
    const { user: actor } = renderApp('/org/org-1/teachers/u-1')

    const panel = await screen.findByRole('region', { name: 'Payouts' })
    expect(await within(panel).findByText('20 Oct 2026 · 2 lessons')).toBeInTheDocument()
    expect(within(panel).getByText('1,200 RON, bank transfer')).toBeInTheDocument()
    expect(within(panel).getByText(/Nothing to pay out/)).toBeInTheDocument()

    await actor.click(within(panel).getByRole('button', { name: /^Actions for the payout of/ }))
    await actor.click(await screen.findByRole('menuitem', { name: 'View lessons' }))
    expect(await within(panel).findAllByText('Kid Student · Piano · Held')).toHaveLength(2)

    await actor.click(within(panel).getByRole('button', { name: /^Actions for the payout of/ }))
    await actor.click(await screen.findByRole('menuitem', { name: 'Void payout' }))
    const dialog = await screen.findByRole('alertdialog', { name: 'Void payout' })
    const confirm = within(dialog).getByRole('button', { name: 'Void payout' })
    expect(confirm).toBeDisabled()
    await actor.type(within(dialog).getByLabelText('Reason'), 'Recorded twice')
    expect(confirm).toBeDisabled()
    await actor.type(within(dialog).getByLabelText(/to confirm/), 'void')
    await actor.click(confirm)

    expect(await screen.findByText('Payout voided')).toBeInTheDocument()
    expect(voided).toEqual([{ reason: 'Recorded twice' }])
  })

  it('keeps Void payout disabled until the confirmation is exactly “void”', async () => {
    server.use(
      http.get(api(PAYABLE), () => HttpResponse.json(page([]))),
      http.get(api(PAYOUTS), () => HttpResponse.json(page([teacherPayout()]))),
    )
    const { user: actor } = renderApp('/org/org-1/teachers/u-1')

    const panel = await screen.findByRole('region', { name: 'Payouts' })
    await actor.click(
      await within(panel).findByRole('button', { name: /^Actions for the payout of/ }),
    )
    await actor.click(await screen.findByRole('menuitem', { name: 'Void payout' }))
    const dialog = await screen.findByRole('alertdialog', { name: 'Void payout' })
    const confirm = within(dialog).getByRole('button', { name: 'Void payout' })
    await actor.type(within(dialog).getByLabelText('Reason'), 'Recorded twice')
    const typed = within(dialog).getByLabelText(/to confirm/)
    for (const wrong of ['Void', 'voids', 'void it']) {
      await actor.clear(typed)
      await actor.type(typed, wrong)
      expect(confirm).toBeDisabled()
    }
    await actor.clear(typed)
    await actor.type(typed, 'void')
    expect(confirm).toBeEnabled()
  })

  it('shows voided payouts on request, with who voided them and why', async () => {
    const requested: (string | null)[] = []
    server.use(
      http.get(api(PAYABLE), () => HttpResponse.json(page([]))),
      http.get(api(PAYOUTS), ({ request }) => {
        const includeVoided = new URL(request.url).searchParams.get('includeVoided')
        requested.push(includeVoided)
        return HttpResponse.json(
          page(
            includeVoided === 'true'
              ? [
                  teacherPayout({
                    voidedAt: '2026-10-22T10:00:00Z',
                    voidedById: 'admin-1',
                    voidedByName: 'Riverside Admin',
                    voidReason: 'Wrong teacher',
                  }),
                ]
              : [],
          ),
        )
      }),
    )
    const { user: actor } = renderApp('/org/org-1/teachers/u-1')

    const panel = await screen.findByRole('region', { name: 'Payouts' })
    expect(await within(panel).findByText('No live payouts.')).toBeInTheDocument()
    await actor.click(within(panel).getByRole('switch', { name: 'Show voided' }))

    expect(await within(panel).findByText('Voided')).toBeInTheDocument()
    expect(
      within(panel).getByText(/voided by Riverside Admin on 22 Oct 2026: Wrong teacher/),
    ).toBeInTheDocument()
    expect(requested).toEqual(['false', 'true'])
  })

  it('is only on a teacher’s page', async () => {
    signedInAs(superAdmin)
    server.use(
      http.get(api('/users/u-2'), () =>
        HttpResponse.json(user({ id: 'u-2', name: 'Other Admin', role: 'ADMIN' })),
      ),
    )
    renderApp('/platform/orgs/org-1/admins/u-2')

    expect(
      await screen.findByRole('heading', { level: 2, name: 'Other Admin' }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Payouts' })).not.toBeInTheDocument()
  })
})

describe('lesson detail', () => {
  beforeEach(() => {
    signedInAs(orgAdmin('org-1'))
    server.use(
      http.get(api('/users/u-1'), () => HttpResponse.json(user())),
      http.get(api('/students/s-1'), () => HttpResponse.json(student())),
      http.get(api('/courses/c-1'), () => HttpResponse.json(course())),
      http.get(api('/orgs/org-1'), () => HttpResponse.json(organization())),
      http.get(api('/homework'), () => HttpResponse.json(page([]))),
      http.get(api('/students/s-1/lessons/summary'), () => HttpResponse.json(summary)),
    )
  })

  it('shows the teacher payout of a held lesson apart from the student’s payment', async () => {
    server.use(
      http.get(api('/lessons/l-1'), () =>
        HttpResponse.json(
          lessonDetail({
            status: 'PRESENT',
            closedAt: '2026-10-20T16:00:00Z',
            teacherPayout: { payoutId: 'p-1', paidOn: '2026-10-20' },
          }),
        ),
      ),
    )
    renderApp('/org/org-1/lessons/l-1')

    expect(await screen.findByText('Paid to the teacher on 20 Oct 2026')).toBeInTheDocument()
    expect(screen.getByText('Teacher payout')).toBeInTheDocument()
  })

  it('says a held lesson is not paid out yet', async () => {
    server.use(
      http.get(api('/lessons/l-1'), () =>
        HttpResponse.json(lessonDetail({ status: 'PRESENT', closedAt: '2026-10-20T16:00:00Z' })),
      ),
    )
    renderApp('/org/org-1/lessons/l-1')

    expect(await screen.findByText('Not paid out yet')).toBeInTheDocument()
  })
})
