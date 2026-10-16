import type { Page } from '@playwright/test'
import { expect, test } from './fixtures'

/** Phone-only checks: no horizontal scroll, stacked lists, the collapsible lesson filters. */
test.describe('phone layout', () => {
  test.skip(({ isMobile }) => !isMobile, 'phone project only')

  const noHorizontalScroll = async (page: Page) => {
    const widths = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      inner: window.innerWidth,
    }))
    expect(widths.scroll, 'page must not scroll sideways').toBeLessThanOrEqual(widths.inner)
  }

  test('the ledger stacks rows and hides the filters behind a toggle', async ({ page }) => {
    await page.goto('/platform/lessons')
    await expect(page.getByRole('heading', { name: 'Lessons' })).toBeVisible()
    await noHorizontalScroll(page)
    const toggle = page.getByRole('button', { name: /^Filters/ })
    await expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await expect(page.getByRole('combobox', { name: 'Status' })).toBeHidden()
    await toggle.click()
    await expect(page.getByRole('combobox', { name: 'Status' })).toBeVisible()
    await noHorizontalScroll(page)
  })

  test('the organizations list and an organization workspace fit the screen', async ({ page }) => {
    await page.goto('/platform/orgs')
    await expect(page.getByRole('heading', { name: 'Organizations' })).toBeVisible()
    await noHorizontalScroll(page)
    // Stacked rows are buttons that navigate; the first button in the row is the row itself.
    await page.getByRole('list', { name: 'Organizations' }).getByRole('button').first().click()
    await expect(page.getByRole('navigation', { name: 'Organization sections' })).toBeVisible()
    await noHorizontalScroll(page)
    await page.getByRole('button', { name: 'Open navigation' }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
  })
})
