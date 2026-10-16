import js from '@eslint/js'
import prettier from 'eslint-config-prettier'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default defineConfig([
  globalIgnores(['dist', 'coverage', 'playwright-report', 'test-results', 'src/api/schema.d.ts']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
      prettier,
    ],
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      // `any` is allowed only with a comment explaining why (see CLAUDE.md).
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      // shadcn/ui files export helpers next to components.
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      // React Compiler is not used; these compiler-oriented rules flag the deliberate
      // "reset the form when the sheet opens" effect and react-hook-form's watch().
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/incompatible-library': 'off',
    },
  },
  {
    // shadcn/ui files export variants next to components; route modules export `handle` next to `Component`.
    files: [
      'src/components/ui/**/*.{ts,tsx}',
      'src/components/data/*.tsx',
      'src/**/*-page.tsx',
      'src/**/*-layout.tsx',
      'src/app/**/*.tsx',
      'src/auth/*.tsx',
    ],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
  {
    files: ['e2e/**/*.ts', 'playwright.config.ts', 'vite.config.ts', 'vitest.config.ts'],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
])
