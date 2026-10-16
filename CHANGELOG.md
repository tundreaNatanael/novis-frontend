# Changelog

All notable changes to the Novis admin console. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); dates are the day the change landed on `main`.

## Unreleased

### Planned

- Phase 2: organizations and the organization workspace (admins, teachers, students, courses, invites).
- Phase 3: freelance teachers. Phase 4: lessons. Phase 5: the `/org/:orgId` admin mount. Phase 6: polish. Phase 7: docs.

## Phase 1 — Foundation — 2026-10-16

### Added

- Project tooling: Vite 8, TypeScript 6 (strict), ESLint 10 + Prettier, Vitest 5 + Testing Library + MSW 3,
  Playwright 1.64 (`e2e/public-pages.spec.ts`), scripts in `package.json`, `.env.example`
  (`VITE_API_BASE_URL`).
- Design tokens and themes in `src/index.css` (paper / ink / brass / slate palette, semantic colors,
  Inter and JetBrains Mono, radius scale, the stave motif), light / dark / system theme provider with
  a no-flash inline script, shadcn/ui primitives (`radix-nova` style) re-themed with the tokens.
- Responsive shell (`/` under `RequireAuth`): collapsible ink sidebar on desktop, top bar with
  drawer on phones, breadcrumbs from route `handle.crumb`, organization switcher for admins of
  several organizations, theme toggle, user menu, ⌘K / Ctrl+K command palette (pages and, for the
  super-admin, organizations via `GET /orgs`).
- API layer: `src/api/client.ts` (bearer header, `ApiError` parsing, single-flight refresh on
  `401 TOKEN_EXPIRED`, sign-out on `INVALID_REFRESH_TOKEN` / `ACCOUNT_UNAVAILABLE` / `INVALID_TOKEN`,
  repeatable query params), generated `schema.d.ts` from the backend OpenAPI (`npm run api:types`),
  typed overlay `types.ts`, one module per resource with query-key factories (orgs, invites,
  members, users, students, courses, enrollments, lessons, auth).
- Session and guards: `tokenStore` (access token in memory, refresh token in `localStorage`),
  `SessionProvider` (`GET /users/me`), `RequireAuth`, `RequireSuperAdmin`, `RequireOrgAdmin`,
  `RedirectIfAuthenticated`, `HomeRedirect`; capabilities helper `deriveCapabilities` and
  `lessonRules` in `src/lib/permissions.ts`.
- Pages: `/login` (`POST /auth/login`), `/forgot-password` (`POST /auth/forgot-password`),
  `/reset-password/:token` (`POST /auth/reset-password`), `/invite/:token` (`POST /auth/accept-invite`),
  `/no-access`, `/account` (`PATCH /users/{me}` for name, email, password), not-found and root error
  pages; placeholder pages for every route of phases 2–5.
- Tests: API client (refresh single-flight, token replacement, retries, logout cases, error
  parsing, network errors), token store, capabilities and lesson rules, zod schemas, formatting.
- Docs: `README.md`, `CLAUDE.md`, this changelog; `docs/PLAN.md`, `docs/BACKEND_GAPS.md`,
  `docs/DECISIONS.md` from Phase 0.

### Changed

- Backend (`../novis-backend`, approved at the Phase 0 checkpoint): new endpoints
  `POST /orgs/{orgId}/staff`, `POST /freelance-teachers`, `GET /users?freelance=&q=`, `GET /invites`,
  `GET /students/{id}/enrollments`; filters `organizationId` / `teacherId` on `GET /courses` and
  `GET /students`, `organizationId` on `GET /lessons`; `POST /students` lets the super-admin name a
  `teacherId` instead of an organization. See the backend's own `CHANGELOG.md`.

## Phase 0 — Discovery — 2026-10-16

### Added

- `docs/BACKEND_GAPS.md` (G1–G16 verified against the Java code), `docs/PLAN.md` (stack, routes,
  screens, components, data layer, design plan, phases), `docs/DECISIONS.md` (D-001–D-014).
