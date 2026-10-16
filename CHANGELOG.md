# Changelog

All notable changes to the Novis admin console. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); dates are the day the change landed on `main`.

## Unreleased

### Planned

- Phase 3: freelance teachers. Phase 4: lessons. Phase 5: organization picker and switcher polish for admins. Phase 6: polish. Phase 7: docs.

## Phase 2 — Organizations and the organization workspace — 2026-10-16

### Added

- `/platform` overview with platform counts (`totalElements` of `GET /orgs`, `/students`, `/courses`, `/lessons`), recent organizations and shortcuts.
- `/platform/orgs`: organizations table (server paging and sorting, client filter on the loaded page), create sheet with slug suggestion (`POST /orgs`), row actions edit / archive / restore.
- Organization workspace (`/platform/orgs/:orgId/*`, also mounted at `/org/:orgId/*` for admins): header with status, slug and id, tabs by capability, archived banner.
  - Overview: counts per tab, every field, edit (`PATCH /orgs/{id}`), archive with slug confirmation (`DELETE /orgs/{id}`), restore (`PATCH … status: ACTIVE`).
  - Admins / Teachers / Students: member tables (`GET /orgs/{orgId}/members?role=`), "Remove from this organization" (`DELETE /memberships/{id}`) and "Delete account" (`DELETE /users/{id}` / `DELETE /students/{id}`) with the backend's real consequences in the confirmation.
  - Add admin / teacher with a password (`POST /orgs/{orgId}/staff`), teacher course step (`POST /courses` or `PATCH /courses/{id} { teacherId }`) with per-step status, retry and skip; password generator.
  - Add student (`POST /students` + `POST /courses/{courseId}/enrollments`), `409` already-enrolled treated as success, retry / skip on failure.
  - Courses: table (`GET /courses?organizationId`), create / edit sheet with teacher reassignment warning, archive / reactivate, soft delete.
  - Invites: pending / accepted / expired states, invite sheet (`POST /orgs/{orgId}/invites`), revoke (`DELETE /invites/{id}`), resend.
  - Detail pages: staff (`GET /users/{id}`, memberships, courses here, edit, reset link, remove, delete), student (`GET /students/{id}`, `GET /users/{id}`, balances from `GET /students/{id}/lessons/summary`, enrollments from `GET /students/{id}/enrollments`, unenrol, edit, remove, delete), course (`GET /courses/{id}`, teacher and organization links, enrollments table, enrol / unenrol, edit, archive, delete).
- Shared components: `DataTable` (TanStack Table v9, manual sorting, stacked list on phones), `Pagination`, `ListToolbar`, `EmptyState`, `ErrorState`, `DetailPanel` family (id copy, enum badge with raw value, local time with UTC tooltip), `FormSheet`, `ConfirmDialog` (type-to-confirm), `RowActions` (disabled actions show their reason), `StatusBadge`, `NavTabs`, `PasswordField`, `StepStatus`, `SelectField`.
- URL list state hook (`useListParams`: `page`, `size`, `sort`, `q`, sheet flags).
- Tests: organizations create and duplicate slug, workspace tabs by role and redirect, teacher create with failed / retried course step, student create with `409` and failed enrollment, membership removal; test harness over the real route tree with MSW.

### Changed

- Access token mirrored per tab in `sessionStorage` so reloads no longer refresh (decision D-021, gap G17).
- Platform routes nested so breadcrumbs read "Organizations › School".
- React Query devtools shown only with `localStorage['novis-admin.devtools'] = '1'`.

### Fixed

- Session storm: a reload during an in-flight refresh reused a rotated token and the backend revoked every session.

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
