import { screen, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw/http'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  course,
  homework,
  lessonDetail,
  material,
  page,
  rosterStudent,
  user,
} from '@/test/fixtures'
import { api, renderApp, signedInAs } from '@/test/render'
import { server } from '@/test/server'

/** A PDF the teacher attached in the app to the first line of hw-1. */
const sheet = material({
  id: 'm-pdf',
  type: 'PDF',
  lessonId: null,
  externalUrl: null,
  fileName: 'sheet.pdf',
  contentType: 'application/pdf',
  sizeBytes: 1024,
  homeworkId: 'hw-1',
  homeworkTitle: 'Weekly practice',
})
const tutorial = material({
  id: 'm-link',
  type: 'VIDEO',
  lessonId: null,
  externalUrl: 'https://youtu.be/abc',
  fileName: null,
  contentType: null,
  sizeBytes: null,
  homeworkId: 'hw-1',
  homeworkTitle: 'Weekly practice',
})
const withMaterials = () =>
  homework({
    lessonId: 'l-1',
    lessonScheduledAt: '2026-10-20T15:00:00Z',
    items: [
      { id: 'hi-1', text: 'Read the sheet', done: false, position: 0, material: sheet },
      { id: 'hi-2', text: 'Watch the tutorial', done: true, position: 1, material: tutorial },
      { id: 'hi-3', text: 'Scales', done: false, position: 2, material: null },
    ],
  })

describe('the teacher workspace shows and keeps the materials on homework lines (D-059)', () => {
  beforeEach(() => {
    signedInAs(user())
    server.use(
      http.get(api('/teacher/students'), () => HttpResponse.json(page([rosterStudent()]))),
      http.get(api('/courses'), () => HttpResponse.json(page([course()]))),
      http.get(api('/lessons'), () => HttpResponse.json(page([]))),
      http.get(api('/teacher/lesson-totals'), () =>
        HttpResponse.json({ held: 5, paid: 3, balance: -2 }),
      ),
      http.get(api('/lessons/l-1'), () => HttpResponse.json(lessonDetail())),
      http.get(api('/homework'), () => HttpResponse.json(page([withMaterials()]))),
      http.get(api('/homework/hw-1'), () => HttpResponse.json(withMaterials())),
    )
  })

  it('shows a line’s material: a link in a new tab, an uploaded file through a fresh signed URL', async () => {
    const tab = { location: { href: '' }, close: vi.fn(), opener: {} } as unknown as Window
    const open = vi.spyOn(window, 'open').mockReturnValue(tab)
    server.use(
      http.get(api('/materials/m-pdf/download-url'), () =>
        HttpResponse.json({ url: 'https://files.test/sheet.pdf', expiresAt: null }),
      ),
    )
    const { user: actor } = renderApp('/teach/lessons/l-1')

    const link = await screen.findByRole('link', { name: 'Open: Scales, slowly' })
    expect(link).toHaveAttribute('href', 'https://youtu.be/abc')
    expect(link).toHaveAttribute('target', '_blank')
    await actor.click(screen.getByRole('button', { name: 'Open: Scales, slowly' }))
    expect(open).toHaveBeenCalledWith('', '_blank')
    expect(tab.location.href).toBe('https://files.test/sheet.pdf')
    open.mockRestore()
  })

  it('edits a homework: every kept line sends its material, a new line none', async () => {
    const patched: Record<string, unknown>[] = []
    server.use(
      http.patch(api('/homework/hw-1'), async ({ request }) => {
        patched.push((await request.json()) as Record<string, unknown>)
        return HttpResponse.json(withMaterials())
      }),
    )
    const { user: actor } = renderApp('/teach/lessons/l-1')

    await actor.click(await screen.findByRole('button', { name: 'Edit Weekly practice' }))
    const dialog = await screen.findByRole('dialog', { name: 'Edit homework' })
    expect(within(dialog).getAllByText(/Attached: Scales, slowly/)).toHaveLength(2)
    await actor.type(within(dialog).getByLabelText('Checklist item 1'), ' twice')
    await actor.click(within(dialog).getByRole('button', { name: 'Add item' }))
    await actor.type(within(dialog).getByLabelText('Checklist item 4'), 'Sight-read')
    await actor.click(within(dialog).getByRole('button', { name: 'Save homework' }))

    expect(await screen.findByText('Homework saved')).toBeInTheDocument()
    expect(patched).toEqual([
      {
        items: [
          { text: 'Read the sheet twice', done: false, materialId: 'm-pdf' },
          { text: 'Watch the tutorial', done: true, materialId: 'm-link' },
          { text: 'Scales', done: false, materialId: null },
          { text: 'Sight-read', done: false, materialId: null },
        ],
      },
    ])
  })

  it('assigns homework with plain lines: every line goes out with materialId null', async () => {
    const posted: Record<string, unknown>[] = []
    server.use(
      http.get(api('/students/s-1/enrollments'), () => HttpResponse.json(page([]))),
      http.post(api('/homework'), async ({ request }) => {
        posted.push((await request.json()) as Record<string, unknown>)
        return HttpResponse.json(homework({ id: 'hw-2' }), { status: 201 })
      }),
    )
    const { user: actor } = renderApp('/teach/lessons/l-1')

    await actor.click(await screen.findByRole('button', { name: 'Assign homework' }))
    const dialog = await screen.findByRole('dialog', { name: 'Assign homework' })
    await actor.type(within(dialog).getByLabelText('Checklist item 1'), 'Scales, slowly')
    await actor.click(within(dialog).getByRole('button', { name: 'Assign homework' }))

    expect(await screen.findByText('Homework assigned')).toBeInTheDocument()
    expect(posted).toHaveLength(1)
    expect(posted[0]!.items).toEqual([{ text: 'Scales, slowly', materialId: null }])
  })
})
