# Changelog

All notable changes to the Novis admin console. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); dates are the day the change landed on `main`.

## Unreleased

### Planned

- Nothing scheduled. Follow-ups that need the backend are the **B** items in `docs/BACKEND_GAPS.md`.

## Phase 7 — Documentation — 2026-10-16

### Changed

- README: every router row built, a Verification section (unit tests, live smoke, phone checks, screens + axe, manual passes) and two more known limitations; CLAUDE.md "Current state" describes the finished console and the open follow-ups; `docs/PLAN.md` §10 marks the phases delivered.

## Phase 6 — Polish — 2026-10-16

### Added

- Playwright suite against the live API: `e2e/fixtures.ts` signs in once per worker through `POST /auth/login` and seeds the token stores (no login throttling, no refresh rotation per test); `e2e/console.spec.ts` runs organization → admin → teacher with course → student → lesson created, closed and paid → organization archived; `e2e/mobile.spec.ts` checks the phone layout (no horizontal scroll, stacked lists, collapsible filters, navigation drawer); `e2e/screens.spec.ts` captures every key screen at 1440 / 1280 / 1024 / 768 / 375 in both themes under `e2e/screenshots/` and fails on serious or critical axe violations (WCAG 2.0/2.1/2.2 A + AA tags). The mobile project runs the iPhone 13 descriptor in Chromium, so one `npx playwright install chromium` covers both projects.
- The lesson filters collapse behind a "Filters" toggle on phones (expanded when any filter is active).
- On tablets (768–1023 px) the sidebar starts as the icon rail, so lists keep their columns; expanding it is remembered (`novis-admin.sidebar-collapsed`).

### Fixed

- The platform overview and every two-column detail page could overflow the viewport on phones (grid children with `min-width: auto`); the base column is now `minmax(0, 1fr)` and the sections `min-w-0`.
- Page titles no longer truncate at tablet widths: actions wrap under a long title instead of squeezing it.
- Date columns (Created / Joined / Sent / Enrolled) and the ledger's Course / Organization columns are hidden between `md` and `lg`, so tables fit at 768 px without a horizontal scroll.
- Light theme: `--success` darkened to `#26664a` and the avatar / filter-count badges switched to solid brass with white text, so every badge meets WCAG AA contrast (axe reported `color-contrast` on the success badges and the avatar fallback).
- The agenda's day lists are valid `<ol>` markup again (the stave rail sits beside the list, not inside it).

## Phase 5 — Organization admin console — 2026-10-16

### Added

- `/org`: the organization picker for admins of several organizations — one card per ADMIN membership with teacher and student counts (`GET /orgs/{id}/members?role=…&size=1`), TEACHER-only memberships hidden; a single-organization admin is sent straight to `/org/:orgId`.
- Tests: picker lists ADMIN organizations with counts and opens the chosen workspace; single-organization admins skip the picker.

### Verified

- Signed in as an organization admin against the dev backend: picker, switcher (keeps the current tab), sidebar scoped to the organization, no Admins / Lessons tabs, `/platform/*` bounced home.

## Phase 4 — Lessons — 2026-10-16

### Added

- `/platform/lessons`: the ledger (`GET /lessons`) with every filter kept in the URL (organization or freelance scope, teacher, student, course, status, payment, scheduled, date range), a table and a day-grouped agenda view, server paging and sorting. The same `LessonLedger` powers the organization Lessons tab (`organizationId` fixed) and the freelance Lessons tab (`teacherId` fixed).
- New lesson sheet (`POST /lessons`): scope → teacher → student → course cascade, optional date and meeting link, "use prepaid" toggle; the toast says when a prepaid lesson was spent, a `404` is explained as "not on the roster / not enrolled".
- `/platform/lessons/:lessonId`: every field, homework and materials, the student's balances with this teacher (`GET /students/{id}/lessons/summary?teacherId=`) and the actions: schedule / reschedule / unschedule (`PATCH …/schedule`), close as held / canceled / canceled late with journal and homework (`POST …/close`, rollover toast and link), edit journal (`PATCH …/journal`), mark paid / unpaid (`PATCH …/payment`, optimistic with rollback), delete (`DELETE /lessons/{id}`), add prepaid lessons. Disabled actions show their reason (`lessonRules`).
- Add prepaid lessons sheet (`POST /students/{id}/lessons/prepaid`, 1–50, optional course) on the lesson detail and on the student detail (teacher picker in an organization, fixed teacher in the freelance workspace); the student detail links to the student's lessons.
- Tests: ledger + create (prepaid toast), agenda, close with rollover, close with journal + homework, optimistic payment toggle with rollback, delete rules, prepaid pack.

### Changed

- Form sheets span the full width on phones (the base sheet's `w-3/4` was winning).
- Ids chosen from server-fed selects are no longer validated as UUIDs client-side; the server is the authority.

### Fixed

- A freelance student's detail page no longer requests `/orgs//members` (the membership scan is disabled without an organization).
- Signing in after a redirect to `/login?next=…` lands on that page again: the signed-in bounce honours a safe `next` instead of always going home.

## Phase 3 — Freelance teachers — 2026-10-16

### Added

- `/platform/freelance`: freelance teachers table (`GET /users?freelance=true`), add with a password (`POST /freelance-teachers`), invite by email (`POST /invites`), open invitations from `GET /invites` with resend and revoke (`DELETE /invites/{id}`), delete account.
- Freelance teacher workspace `/platform/freelance/:teacherId/*`: profile (every field, memberships, edit, reset link, delete), students (`GET /students?teacherId=`, add with `POST /students { teacherId }` and optional enrollment, delete), courses (`GET /courses?teacherId=`, create / edit / archive / delete), lessons tab placeholder for phase 4.
- The student and course detail pages, the add-student sheet and the course sheet work in both scopes (organization and freelance) through `useWorkspaceScope()`.
- Tests: freelance list + create, freelance student create without an organization.

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
