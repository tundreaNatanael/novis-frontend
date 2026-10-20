import { screen } from '@testing-library/react'
import { http } from 'msw/http'
import { describe, expect, it } from 'vitest'
import { api, apiError, renderApp } from '@/test/render'
import { server } from '@/test/server'

async function fillAndSubmit(user: ReturnType<typeof renderApp>['user']) {
  await user.type(await screen.findByLabelText(/^Your name/), 'Ana Pop')
  await user.type(screen.getByLabelText(/^Password/), 'Str0ngPassw0rd!')
  await user.type(screen.getByLabelText(/^Repeat the password/), 'Str0ngPassw0rd!')
  await user.click(screen.getByRole('button', { name: 'Accept invitation' }))
}

describe('accept invitation', () => {
  it('tells an existing account to enter its current password', async () => {
    server.use(
      http.post(api('/auth/accept-invite'), () =>
        apiError(
          400,
          'INVITE_PASSWORD_MISMATCH',
          'This email already has an account: enter its current password',
        ),
      ),
    )
    const { user } = renderApp('/invite/tok-1')

    expect(
      await screen.findByText(
        /If this email already has a Novis account, enter its current password instead/,
      ),
    ).toBeInTheDocument()
    await fillAndSubmit(user)

    expect(
      await screen.findByText(
        'This email already has a Novis account: enter its current password.',
      ),
    ).toBeInTheDocument()
    expect(screen.getByLabelText(/^Password/)).toHaveAttribute('aria-invalid', 'true')
  })

  it('words the refusals by code: a role elsewhere, a disabled account, an inactive organization', async () => {
    const answers = [
      apiError(
        409,
        'ROLE_CONFLICT',
        'This email already belongs to an account with a role elsewhere',
      ),
      apiError(400, 'INVITE_ACCOUNT_DISABLED', 'This account is disabled'),
      apiError(400, 'INVITE_ORGANIZATION_INACTIVE', 'The organization is no longer active'),
      // Without a dedicated code, a 400 is the invalid / used / expired link, whatever its wording.
      apiError(400, 'BAD_REQUEST', 'This account is disabled'),
    ]
    server.use(http.post(api('/auth/accept-invite'), () => answers.shift()))
    const { user } = renderApp('/invite/tok-1')
    await fillAndSubmit(user)
    const accept = screen.getByRole('button', { name: 'Accept invitation' })

    expect(
      await screen.findByText(
        /This email already belongs to an account with a role elsewhere in Novis\. This invitation cannot be accepted/,
      ),
    ).toBeInTheDocument()

    await user.click(accept)
    expect(
      await screen.findByText(
        'This account is disabled, so the invitation cannot be accepted. Ask the platform owner.',
      ),
    ).toBeInTheDocument()

    await user.click(accept)
    expect(
      await screen.findByText(
        'The organization of this invitation is no longer active. Ask the platform owner.',
      ),
    ).toBeInTheDocument()

    await user.click(accept)
    expect(
      await screen.findByText(/This invitation is invalid, already used or expired/),
    ).toBeInTheDocument()
  })
})
