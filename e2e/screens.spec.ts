import { mkdirSync } from 'node:fs'
import AxeBuilder from '@axe-core/playwright'
import { api, expect, test } from './fixtures'

/**
 * Visual self-review and accessibility pass: every key screen at five widths in both themes,
 * saved under `e2e/screenshots/` (ignored by git), plus an axe scan with no serious or critical
 * violations. Lives on the desktop project; the mobile project has its own spec.
 */
const WIDTHS = [1440, 1280, 1024, 768, 375] as const
const THEMES = ['light', 'dark'] as const
const OUT = new URL('./screenshots/', import.meta.url)

test.describe('screens', () => {
  test.skip(({ isMobile }) => isMobile, 'viewports are set explicitly here')
  test.describe.configure({ mode: 'serial' })

  let routes: { name: string; path: string }[] = []

  test.beforeAll(async ({ tokens }) => {
    mkdirSync(OUT, { recursive: true })
    const orgs = await api<{ content: { id: string }[] }>(
      tokens,
      'GET',
      '/orgs?page=0&size=1&sort=createdAt,desc',
    )
    const lessons = await api<{ content: { id: string }[] }>(
      tokens,
      'GET',
      '/lessons?page=0&size=1&sort=scheduledAt,desc',
    )
    const freelancers = await api<{ content: { id: string }[] }>(
      tokens,
      'GET',
      '/freelance-teachers?page=0&size=1',
    )
    const org = orgs.data?.content?.[0]?.id
    const lesson = lessons.data?.content?.[0]?.id
    const freelancer = freelancers.data?.content?.[0]?.id
    routes = [
      { name: 'platform-overview', path: '/platform' },
      { name: 'organizations', path: '/platform/orgs' },
      ...(org
        ? [
            { name: 'org-overview', path: `/platform/orgs/${org}` },
            { name: 'org-students', path: `/platform/orgs/${org}/students` },
            { name: 'org-courses', path: `/platform/orgs/${org}/courses` },
          ]
        : []),
      { name: 'freelance', path: '/platform/freelance' },
      ...(freelancer
        ? [{ name: 'freelance-students', path: `/platform/freelance/${freelancer}/students` }]
        : []),
      { name: 'lessons-table', path: '/platform/lessons' },
      { name: 'lessons-agenda', path: '/platform/lessons?view=agenda' },
      ...(lesson ? [{ name: 'lesson-detail', path: `/platform/lessons/${lesson}` }] : []),
      { name: 'account', path: '/account' },
    ]
  })

  for (const theme of THEMES) {
    test(`captures every screen in ${theme} at five widths and scans it with axe`, async ({
      page,
    }) => {
      test.setTimeout(240_000)
      await page.addInitScript(
        (value) => window.localStorage.setItem('novis-admin.theme', value),
        theme,
      )
      const violations: string[] = []
      for (const route of routes) {
        for (const width of WIDTHS) {
          await page.setViewportSize({ width, height: width < 768 ? 812 : 900 })
          await page.goto(route.path)
          await expect(page.locator('main')).toBeVisible()
          await page.waitForLoadState('networkidle').catch(() => {})
          await page.waitForTimeout(300)
          const widths = await page.evaluate(() => ({
            scroll: document.documentElement.scrollWidth,
            inner: window.innerWidth,
          }))
          expect(
            widths.scroll,
            `${route.name} @${width}px ${theme}: no horizontal scroll`,
          ).toBeLessThanOrEqual(widths.inner)
          await page.screenshot({
            path: new URL(`${route.name}-${width}-${theme}.png`, OUT).pathname,
            fullPage: true,
          })
          if (width === 1440 || width === 375) {
            const results = await new AxeBuilder({ page })
              .withTags(['wcag2a', 'wcag2aa', 'wcag22aa'])
              .analyze()
            for (const v of results.violations) {
              const line = `${route.name} @${width}px ${theme}: [${v.impact}] ${v.id} — ${v.help} (${v.nodes.length} node${v.nodes.length === 1 ? '' : 's'}: ${v.nodes
                .slice(0, 2)
                .map((n) => n.target.join(' '))
                .join(' | ')})`
              if (v.impact === 'serious' || v.impact === 'critical') violations.push(line)
              else console.log('axe (minor/moderate):', line)
            }
          }
        }
      }
      expect(violations, violations.join('\n')).toEqual([])
    })
  }
})
