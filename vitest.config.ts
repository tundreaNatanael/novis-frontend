import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config.ts'

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      // Every test runs in Europe/Bucharest, so the teacher calendar's daylight-saving cases are real.
      env: { TZ: 'Europe/Bucharest' },
      setupFiles: ['./src/test/setup.ts'],
      include: ['src/**/*.test.{ts,tsx}'],
      css: false,
      clearMocks: true,
      testTimeout: 20_000,
      coverage: {
        provider: 'v8',
        include: ['src/**/*.{ts,tsx}'],
        exclude: [
          'src/**/*.test.{ts,tsx}',
          'src/test/**',
          'src/api/schema.d.ts',
          'src/components/ui/**',
        ],
      },
    },
  }),
)
