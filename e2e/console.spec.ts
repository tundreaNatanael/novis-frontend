import { expect, test } from './fixtures'

/**
 * One pass through the console against the live backend: organization → admin → teacher with a
 * course → student in that course → lesson created, closed and paid → organization archived.
 * Everything it creates is suffixed with a timestamp and the organization ends archived.
 */
test.describe('super-admin smoke', () => {
  test.skip(
    ({ isMobile }) => isMobile,
    'the full flow runs on desktop; phones are covered by the mobile spec',
  )

  test('organization → staff → student → lesson → archive', async ({ page }) => {
    test.setTimeout(180_000)
    const stamp = Date.now().toString(36)
    const orgName = `E2E School ${stamp}`
    const slug = `e2e-school-${stamp}`

    // Organization
    await page.goto('/platform/orgs')
    await page.getByRole('button', { name: 'New organization' }).first().click()
    const sheet = page.getByRole('dialog')
    await sheet.getByLabel('Name', { exact: false }).first().fill(orgName)
    await expect(sheet.getByLabel('Slug', { exact: false })).toHaveValue(slug)
    await sheet.getByRole('button', { name: 'Create organization' }).click()
    await expect(page.getByRole('heading', { name: orgName })).toBeVisible()
    const orgUrl = page.url()

    // Admin with a password
    const tabs = page.getByRole('navigation', { name: 'Organization sections' })
    await tabs.getByRole('link', { name: 'Admins' }).click()
    // The header button and the empty state both offer it.
    await page.getByRole('button', { name: 'Add admin' }).first().click()
    await sheet.getByLabel('Email', { exact: false }).fill(`e2e.admin.${stamp}@novis.local`)
    await sheet.getByLabel('Name', { exact: false }).first().fill('E2E Admin')
    await sheet.getByLabel(/^Password/).fill('E2e-Passw0rd-admin')
    await sheet.getByRole('button', { name: 'Create admin' }).click()
    await expect(page.getByText('E2E Admin').first()).toBeVisible()

    // Teacher with a new course
    await page.goto(`${orgUrl}/teachers`)
    // The header button and the empty state both offer it.
    await page.getByRole('button', { name: 'Add teacher' }).first().click()
    await sheet.getByLabel('Email', { exact: false }).fill(`e2e.teacher.${stamp}@novis.local`)
    await sheet.getByLabel('Name', { exact: false }).first().fill('E2E Teacher')
    await sheet.getByLabel(/^Password/).fill('E2e-Passw0rd-teacher')
    await sheet.getByRole('radio', { name: 'Create a new course for them' }).check()
    await sheet.getByLabel('Course title', { exact: false }).fill('E2E Piano')
    await sheet.getByRole('button', { name: 'Create teacher' }).click()
    await expect(page.getByRole('heading', { name: 'E2E Teacher' })).toBeVisible()

    // Student enrolled in that course
    await page.goto(`${orgUrl}/students`)
    // The header button and the empty state both offer it.
    await page.getByRole('button', { name: 'Add student' }).first().click()
    await sheet.getByLabel('Name', { exact: false }).first().fill('E2E Student')
    await sheet.getByLabel('Email', { exact: false }).fill(`e2e.student.${stamp}@novis.local`)
    await sheet.getByRole('combobox', { name: /Course/ }).click()
    await page.getByRole('option', { name: /E2E Piano/ }).click()
    await sheet.getByRole('button', { name: 'Create student' }).click()
    await expect(page.getByRole('heading', { name: 'E2E Student' })).toBeVisible()

    // Lesson: create, close as held, mark paid
    await page.goto(`${orgUrl}/lessons?new=1`)
    await sheet.getByRole('combobox', { name: 'Teacher' }).click()
    await page.getByRole('option', { name: /E2E Teacher/ }).click()
    await sheet.getByRole('combobox', { name: 'Student' }).click()
    await page.getByRole('option', { name: /E2E Student/ }).click()
    await sheet.getByRole('combobox', { name: 'Course' }).click()
    await page.getByRole('option', { name: /E2E Piano/ }).click()
    await sheet.getByLabel('Date and time', { exact: false }).fill('2026-11-05T10:00')
    await sheet.getByRole('button', { name: 'Create lesson' }).click()
    await expect(page.getByRole('heading', { name: /^Lesson on/ })).toBeVisible()
    await expect(page.getByText('Lesson created')).toBeVisible()

    await page.getByRole('button', { name: 'More actions' }).click()
    await page.getByRole('menuitem', { name: 'Close lesson' }).click()
    await sheet.getByRole('textbox', { name: /^Journal/ }).fill('E2E journal entry')
    await sheet.getByRole('button', { name: 'Close lesson' }).click()
    await expect(page.getByText('Lesson closed as held')).toBeVisible()
    await expect(page.getByText('E2E journal entry')).toBeVisible()

    await page.getByRole('button', { name: 'Mark paid' }).click()
    await expect(page.getByText('Lesson marked paid')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Mark unpaid' })).toBeVisible()

    // The ledger shows it under the organization filter
    await page.goto(`${orgUrl}/lessons`)
    const table = page.getByRole('table', { name: 'Lessons' })
    await expect(table.getByText('E2E Student')).toBeVisible()
    await expect(table.getByText('Held')).toBeVisible()
    await expect(table.getByText('Paid')).toBeVisible()

    // Archive (type the slug to confirm)
    await page.goto(orgUrl)
    await page.getByRole('button', { name: 'Archive organization' }).click()
    const dialog = page.getByRole('alertdialog')
    await dialog.getByRole('textbox').fill(slug) // labelled "Type the slug to confirm: <slug>"
    await dialog.getByRole('button', { name: 'Archive organization' }).click()
    await expect(page.getByText('Archived').first()).toBeVisible()
  })
})
