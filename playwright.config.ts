import { defineConfig, devices } from '@playwright/test'

/**
 * End-to-end smoke tests against the dev server and a live Novis API
 * (`VITE_API_BASE_URL` from the environment or `.env`, default http://localhost:8080), signed in
 * as the dev super-admin (`E2E_EMAIL` / `E2E_PASSWORD`). See README → Scripts.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run start',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 60_000,
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    // iPhone 13 geometry, touch and user agent, run in Chromium so one browser download covers both projects.
    { name: 'mobile', use: { ...devices['iPhone 13'], browserName: 'chromium' } },
  ],
})
