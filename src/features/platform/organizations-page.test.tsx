import { screen, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw/http'
import { beforeEach, describe, expect, it } from 'vitest'
import type { Organization } from '@/api/types'
import { organization, page, superAdmin } from '@/test/fixtures'
import { api, apiError, renderApp, signedInAs } from '@/test/render'
import { server } from '@/test/server'

describe('organizations page', () => {
  beforeEach(() => signedInAs(superAdmin))

  it('lists organizations and creates one, then opens its workspace', async () => {
    const existing = organization()
    let created: Organization | null = null
    const posted: unknown[] = []
    server.use(
      http.get(api('/orgs'), () =>
        HttpResponse.json(page(created ? [existing, created] : [existing])),
      ),
      http.post(api('/orgs'), async ({ request }) => {
        const body = (await request.json()) as { name: string; slug: string }
        posted.push(body)
        created = organization({ id: 'org-new', name: body.name, slug: body.slug })
        return HttpResponse.json(created, { status: 201 })
      }),
      http.get(api('/orgs/org-new'), () => HttpResponse.json(created)),
      http.get(api('/orgs/org-new/members'), () => HttpResponse.json(page([]))),
      http.get(api('/orgs/org-new/invites'), () => HttpResponse.json(page([]))),
      http.get(api('/courses'), () => HttpResponse.json(page([]))),
    )
    const { user } = renderApp('/platform/orgs')

    expect((await screen.findAllByText('Riverside Music School')).length).toBeGreaterThan(0)
    await user.click(screen.getByRole('button', { name: 'New organization' }))
    await user.type(await screen.findByLabelText(/^Name/), 'Console School')
    expect(screen.getByLabelText(/^Slug/)).toHaveValue('console-school')
    await user.click(screen.getByRole('button', { name: 'Create organization' }))

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Console School' }),
    ).toBeInTheDocument()
    expect(posted).toEqual([{ name: 'Console School', slug: 'console-school' }])
  })

  it('puts a duplicate-slug conflict on the slug field', async () => {
    server.use(
      http.get(api('/orgs'), () => HttpResponse.json(page([]))),
      http.post(api('/orgs'), () => apiError(409, 'CONFLICT', 'Slug already in use: riverside')),
    )
    const { user } = renderApp('/platform/orgs?new=1')

    await user.type(await screen.findByLabelText(/^Name/), 'Riverside')
    await user.click(screen.getByRole('button', { name: 'Create organization' }))

    const alert = await screen.findByRole('alert')
    expect(within(alert).getByText(/already taken/)).toBeInTheDocument()
  })
})
