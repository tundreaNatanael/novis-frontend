import { expect, test } from '@playwright/test'

test.describe('public pages', () => {
  test('the sign-in page renders and validates', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page.getByText('Enter an email address')).toBeVisible()
    await expect(page.getByText('Enter your password')).toBeVisible()
  })

  test('protected routes redirect anonymous visitors to sign in', async ({ page }) => {
    await page.goto('/platform/orgs')
    await expect(page).toHaveURL(/\/login\?next=%2Fplatform%2Forgs/)
  })

  test('the reset link page explains an invalid token', async ({ page }) => {
    await page.goto('/reset-password/not-a-real-token')
    await expect(page.getByRole('heading', { name: 'Choose a new password' })).toBeVisible()
  })
})
