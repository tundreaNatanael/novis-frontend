# novis-admin — build plan

The web console super-admins and organization admins use to run Novis. Backend contract:
`../novis-backend/API.md` (code wins over docs; see `BACKEND_GAPS.md`). This plan is the Phase 0
deliverable; it is updated when a phase changes it.

## 1. Scope and principles

- **Two roles, one workspace.** The organization workspace (overview, admins, teachers, students,
  courses, invites, lessons) is built once and mounted at `/platform/orgs/:orgId/*` (super-admin) and
  `/org/:orgId/*` (admin). Tabs and actions are driven by a `capabilities` object, never by raw roles.
- **The server is the authority.** Guards are UX; every `403` and `404` is handled in place.
- **Never pretend.** No field the API ignores, no button for an action that will `409`; disabled
  actions show the reason.
- **Desktop first, phone proper.** Same features; tables become stacked lists, sheets go full-screen.
- **Docs are part of done.** `CHANGELOG.md` every task; `README.md` / `CLAUDE.md` / `docs/*` when
  routes, actions, conventions, decisions or gap statuses change.

## 2. Stack (pinned, checked on npm 2026-10-16)

| Area                             | Package                                                                                                                                                   | Version                                               | Notes                                                                                                                                                                                                     |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| UI                               | `react`, `react-dom`                                                                                                                                      | 19.3.1                                                |                                                                                                                                                                                                           |
| Build                            | `vite`                                                                                                                                                    | 8.3.4                                                 | `@vitejs/plugin-react` 6.1.2                                                                                                                                                                              |
| Language                         | `typescript`                                                                                                                                              | 6.0.3                                                 | **not 7.0.2**: `typescript-eslint` 8.71 peers `<6.1`; `openapi-typescript` peers `^5` (verify it runs on 6; fallback: run codegen with `npx -p typescript@5.9`)                                           |
| Routing                          | `react-router`                                                                                                                                            | 8.4.0                                                 | ESM-only; data mode (`createBrowserRouter`), `RouterProvider` from `react-router/dom`; `react-router-dom` no longer exists                                                                                |
| Server state                     | `@tanstack/react-query`                                                                                                                                   | 5.104.3                                               | + devtools in dev                                                                                                                                                                                         |
| Tables                           | `@tanstack/react-table`                                                                                                                                   | 9.3.1                                                 | v9 API: `useTable`, `tableFeatures({ rowSortingFeature, rowPaginationFeature, columnVisibilityFeature })`, `manualSorting`/`manualPagination`, `createColumnHelper<typeof features, Row>()`, `flexRender` |
| Forms                            | `react-hook-form`, `@hookform/resolvers`, `zod`                                                                                                           | 7.90.0, 5.9.1, 4.6.7                                  |                                                                                                                                                                                                           |
| Styling                          | `tailwindcss`, `@tailwindcss/vite`                                                                                                                        | 4.3.3                                                 | CSS-first config, tokens as CSS variables                                                                                                                                                                 |
| Components                       | `shadcn` (CLI), `radix-ui`, `class-variance-authority`, `clsx`, `tailwind-merge`, `tw-animate-css`                                                        | 4.21.5, 1.8.1, 0.7.1, 2.1.1, 3.7.0, 1.4.0             | re-themed with our tokens                                                                                                                                                                                 |
| Icons / toasts / dates / palette | `lucide-react`, `sonner`, `date-fns`, `cmdk`                                                                                                              | 1.58.0, 2.0.8, 4.4.0, 1.1.1                           |                                                                                                                                                                                                           |
| Fonts                            | `@fontsource-variable/inter`, `@fontsource-variable/jetbrains-mono`                                                                                       | 5.3.0, 5.3.0                                          | self-hosted, no FOUT from third parties                                                                                                                                                                   |
| API types                        | `openapi-typescript`                                                                                                                                      | 7.13.0                                                | `npm run api:types` → `src/api/schema.d.ts` (committed)                                                                                                                                                   |
| Unit tests                       | `vitest`, `jsdom`, `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`, `msw`                                            | 5.0.5, 30.1.3, 16.3.3, 7.0.1, 14.6.8, 3.0.3           | MSW 3: `http`/`HttpResponse` from `msw/http`, `setupServer` from `msw/node`, `onUnhandledFrame: 'error'`                                                                                                  |
| e2e                              | `@playwright/test`                                                                                                                                        | 1.64.1                                                | smoke suite + responsive screenshots                                                                                                                                                                      |
| Lint / format                    | `eslint`, `typescript-eslint`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`, `eslint-plugin-jsx-a11y`, `eslint-config-prettier`, `prettier` | 10.12.0, 8.71.2, 7.1.1, 0.5.7, 6.10.2, 10.1.8, 3.9.10 |                                                                                                                                                                                                           |
| Types                            | `@types/react`, `@types/react-dom`, `@types/node`                                                                                                         | 19.3.0, 19.3.0, 26.6.5                                |                                                                                                                                                                                                           |

Runtime: Node 24 (react-router needs ≥ 22.22, msw / vitest ≥ 22.12). Theme switching is a 40-line
provider of our own (class on `<html>`, system + toggle, persisted), not `next-themes`.

## 3. Route map

Guards: `RequireAuth` (session + `GET /users/me`), `RequireSuperAdmin`, `RequireOrgAdmin(orgId)`.
List state (search, filters, sort, page, view) lives in the query string; sheet state too
(`?new=1`, `?edit=<id>`) so forms are deep-linkable.

| Path                                                               | Who                      | Page                                                                                              | Main API calls                                                                                                                                                                                    |
| ------------------------------------------------------------------ | ------------------------ | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/login`                                                           | public                   | Sign in                                                                                           | `POST /auth/login` → `GET /users/me`                                                                                                                                                              |
| `/forgot-password`                                                 | public                   | Request reset link                                                                                | `POST /auth/forgot-password`                                                                                                                                                                      |
| `/reset-password/:token`                                           | public                   | Choose new password                                                                               | `POST /auth/reset-password`                                                                                                                                                                       |
| `/invite/:token`                                                   | public                   | Accept invite (name + password)                                                                   | `POST /auth/accept-invite` → `GET /users/me`                                                                                                                                                      |
| `/no-access`                                                       | signed in, no admin role | "This console is for administrators" + sign out                                                   | `POST /auth/logout`                                                                                                                                                                               |
| `/`                                                                | signed in                | redirect: super-admin → `/platform`; one admin org → `/org/:orgId`; several → `/org`              | `GET /users/me`                                                                                                                                                                                   |
| `/account`                                                         | signed in                | Own profile: name, email, change password, sessions note                                          | `PATCH /users/{me}`                                                                                                                                                                               |
| `/platform`                                                        | super-admin              | Overview: counts (`totalElements` of orgs / students / courses / lessons), shortcuts, recent orgs | `GET /orgs?size=1`, `GET /students?size=1`, …                                                                                                                                                     |
| `/platform/orgs`                                                   | super-admin              | Organizations list + create sheet                                                                 | `GET /orgs`, `POST /orgs`                                                                                                                                                                         |
| `/platform/orgs/:orgId`                                            | super-admin              | Org workspace → Overview (edit name / slug / status, archive / restore)                           | `GET /orgs/{id}`, `PATCH /orgs/{id}`, `DELETE /orgs/{id}`                                                                                                                                         |
| `/platform/orgs/:orgId/admins` · `/admins/:userId`                 | super-admin              | Admins list + create; admin detail                                                                | `GET /orgs/{id}/members?role=ADMIN`, `POST /orgs/{id}/staff` (G1-B) or `POST /orgs/{id}/invites`, `GET /users/{id}`, `PATCH /users/{id}`, `DELETE /memberships/{id}`, `DELETE /users/{id}`        |
| `/platform/orgs/:orgId/teachers` · `/teachers/:userId`             | super-admin              | Teachers list + create (email, password, course); teacher detail with courses                     | members `role=TEACHER`, staff/invite create, `POST /courses`, `PATCH /courses/{id}`, `GET /courses?organizationId&teacherId` (G4-B)                                                               |
| `/platform/orgs/:orgId/students` · `/students/:studentId`          | super-admin              | Students list + create (name, email, course); student detail with balances and courses            | members `role=STUDENT`, `POST /students`, `POST /courses/{c}/enrollments`, `GET /students/{id}`, `GET /users/{id}`, `GET /students/{id}/lessons/summary`, `GET /students/{id}/enrollments` (G6-B) |
| `/platform/orgs/:orgId/courses` · `/courses/:courseId`             | super-admin              | Courses list + create (title, owner teacher); course detail with enrollments                      | `GET /courses?organizationId` (G4-B), `POST /courses`, `PATCH /courses/{id}`, `DELETE /courses/{id}`, `GET/POST/DELETE /courses/{id}/enrollments`                                                 |
| `/platform/orgs/:orgId/invites`                                    | super-admin              | Pending invites: revoke, resend                                                                   | `GET /orgs/{id}/invites`, `DELETE /invites/{id}`, `POST /orgs/{id}/invites`                                                                                                                       |
| `/platform/orgs/:orgId/lessons`                                    | super-admin              | Org ledger (filters preset to the org)                                                            | `GET /lessons?organizationId` (G4-B)                                                                                                                                                              |
| `/platform/freelance`                                              | super-admin              | Freelance teachers list + create / invite                                                         | `GET /users?freelance=true` (G5-B), `POST /freelance-teachers` (G1-B), `POST /invites`, `GET /invites` (G5-B)                                                                                     |
| `/platform/freelance/:teacherId`                                   | super-admin              | Profile (every field, edit, delete)                                                               | `GET /users/{id}`, `PATCH /users/{id}`, `DELETE /users/{id}`                                                                                                                                      |
| `/platform/freelance/:teacherId/students` · `/students/:studentId` | super-admin              | Their students + create (name, email, course)                                                     | `GET /students?teacherId` (G5-B), `POST /students { teacherId }` (G5-B fix), detail as above                                                                                                      |
| `/platform/freelance/:teacherId/courses` · `/courses/:courseId`    | super-admin              | Their courses                                                                                     | `GET /courses?teacherId` (G4-B), course detail as above                                                                                                                                           |
| `/platform/freelance/:teacherId/lessons`                           | super-admin              | Their ledger                                                                                      | `GET /lessons?teacherId`                                                                                                                                                                          |
| `/platform/lessons`                                                | super-admin              | Global ledger: table and agenda (`?view=agenda`), all filters                                     | `GET /lessons?…`                                                                                                                                                                                  |
| `/platform/lessons/:lessonId`                                      | super-admin              | Lesson detail and actions                                                                         | `GET /lessons/{id}`, `PATCH …/schedule`, `POST …/close`, `PATCH …/journal`, `PATCH …/payment`, `DELETE /lessons/{id}`                                                                             |
| `/org`                                                             | admin, several orgs      | Organization picker                                                                               | `GET /users/me`                                                                                                                                                                                   |
| `/org/:orgId`                                                      | admin of that org        | Org workspace → Overview (edit name / slug; status read-only)                                     | `GET /orgs/{id}`, `PATCH /orgs/{id}`                                                                                                                                                              |
| `/org/:orgId/teachers` · `/teachers/:userId`                       | admin                    | Same screens as the platform mount, admin capabilities                                            | as above (no status / email edit, no account delete unless covering)                                                                                                                              |
| `/org/:orgId/students` · `/students/:studentId`                    | admin                    | Same                                                                                              | as above                                                                                                                                                                                          |
| `/org/:orgId/courses` · `/courses/:courseId`                       | admin                    | Same                                                                                              | as above                                                                                                                                                                                          |
| `/org/:orgId/invites`                                              | admin                    | Same (TEACHER invites only)                                                                       | as above                                                                                                                                                                                          |
| `*`                                                                | any                      | Not found                                                                                         | —                                                                                                                                                                                                 |

Lesson detail has a single URL (`/platform/lessons/:lessonId`); org and freelance ledgers link to it.
Admins do not get the Admins or Lessons tabs; the router does not even register them under `/org`.

## 4. Screens (behavior notes)

- **Lists.** Server paging / sorting mapped to `page`, `size`, `sort`. Search where the API supports
  it (none of the current endpoints has `q`; lists therefore search within the loaded page and say so
  — "Filtering 20 of 42 loaded" — until a `q` parameter exists). Desktop: dense table, sticky header,
  row actions menu. Mobile (< 768): stacked rows (title, subtitle, badge, actions). Never a
  horizontally scrolling page; tab strips are the only horizontal scroller.
- **Detail pages.** Header (title, status badge, primary and danger actions), then a details panel
  listing **every field**: id (monospace, copy button), enums as labels with the raw value in a
  tooltip, timestamps local with UTC tooltip, related ids as links, memberships with organization
  and role. Side panels for related lists (courses, enrollments, balances).
- **Forms.** Side sheet (desktop) / full-screen sheet (mobile), sticky footer with the primary
  action. Zod mirrors API.md §1.7; server `fieldErrors` map onto fields; other errors render the
  server `message`. Multi-step creates (student + enrollment, teacher + course) show per-step status
  with retry.
- **Destructive actions.** Confirm dialog with the real consequence. Archive organization: type the
  slug. Actions the API refuses are disabled with the reason.
- **Lessons.** Ledger with all filters; agenda view grouped by day (undated credits in their own
  group). Status badges per API.md §9.1 (upcoming · credit / not scheduled · held · canceled ·
  canceled late — charged) plus a separate paid / unpaid badge, each with icon + text. Create form:
  teacher → that teacher's students → optional course → date-time → meeting link → "Use one of the
  student's prepaid lessons if available" (checked by default). Response `paid: true` → toast
  "Prepaid lesson used". Detail actions as in `BACKEND_GAPS.md` G9; student panel: balances and
  "Add prepaid lessons".

## 5. Component inventory

Shell: `AppShell`, `Sidebar` (collapsible, remembers state), `MobileDrawer`, `TopBar`, `Breadcrumbs`,
`OrgSwitcher`, `UserMenu`, `ThemeToggle`, `CommandPalette` (⌘K: pages, organizations, recent entities),
`PageHeader` (title, badge, actions, staff-rule underline), `Tabs`.

Data display: `DataTable` (TanStack v9, manual sort/pagination, sticky header, column visibility),
`DataList` (mobile rows), `DataView` (switches table ↔ list at the breakpoint), `Pagination`,
`ListToolbar` (search, filter chips, view switch), `EmptyState`, `ErrorState` (retry), `Skeletons`
(table, list, detail), `DetailPanel` + `Field`, `IdField` (copy), `EnumBadge`, `TimeField`,
`EntityLink`, `MembershipList`, `StatusBadge` / `PaidBadge` (lessons), `Agenda`, `BalanceCards`.

Forms: `FormSheet`, `TextField`, `PasswordField`, `SelectField` (async options: teachers, students,
courses), `DateTimeField` (local → ISO UTC), `UrlField` (https only), `ChecklistField` (homework
items), `SubmitBar`, `StepStatus` (multi-step partial success), `ServerErrors` (maps `fieldErrors`).

Actions: `RowActions`, `ConfirmDialog`, `TypeToConfirmDialog`, `DangerZone`, `DisabledWithReason`.

shadcn primitives to add: button, input, label, textarea, select, checkbox, switch, badge, card,
dialog, sheet, dropdown-menu, tooltip, tabs, table, skeleton, separator, command, popover,
scroll-area, avatar, sonner.

## 6. Data layer

- **`src/api/client.ts`** — typed `request<T>(path, init)` over `fetch`: base URL from
  `VITE_API_BASE_URL`, `Accept`/`Content-Type: application/json`, bearer header from `tokenStore`,
  parses `ApiError { code, message, fieldErrors }` into an `ApiError` class. On `401 TOKEN_EXPIRED`:
  one shared in-flight `POST /auth/refresh` (single-flight promise), stores **both** new tokens,
  retries the queued requests once. On `INVALID_REFRESH_TOKEN` / `ACCOUNT_UNAVAILABLE` / refresh failure:
  clear the session, emit `session:expired`, router goes to `/login?next=…`.
- **`src/api/schema.d.ts`** — generated by `openapi-typescript`. **`src/api/types.ts`** — hand-written
  overlay: picks the generated schemas and re-adds `| null` for the fields API.md marks `?`
  (the spec does not mark nullability) plus `ApiError`, `Page<T>` and query-param types.
- **One module per resource** (`orgs`, `invites`, `members`, `users`, `students`, `courses`,
  `enrollments`, `lessons`, `auth`): functions returning typed promises, plus a **query-key factory**
  (`orgKeys.all`, `orgKeys.list(params)`, `orgKeys.detail(id)`, …). Mutations invalidate exactly the
  affected keys (documented in each module's header); the only optimistic update is paid / unpaid.
- **Capabilities** (`src/lib/permissions.ts`): `deriveCapabilities(me, orgId?)` →
  `{ isSuperAdmin, isOrgAdmin, canManageOrganizations, canChangeOrgStatus, canManageAdmins,
canManageTeachers, canManageStudents, canManageCourses, canReassignCourse, canManageInvites,
canManageLessons, canManageFreelance, canEditUser(user), canEditEmail(user), canEditStatus,
canDeleteAccount(user), canRemoveMembership(m), canSendResetLink(user) }` and pure lesson
  predicates (`canSchedule`, `canClose`, `canEditJournal`, `canDelete`, `deleteDisabledReason`).

## 7. Design plan

**Direction.** An operations console for a music school: calm, dense, trustworthy. The one memorable
element is **the stave** — a five-line staff motif used three times: the brand mark (five lines with a
brass note head), a thin ruled underline beneath page titles, and the agenda's time rail. Everything
else stays quiet: flat surfaces, 1 px borders, no card shadows (shadows only on floating layers),
no gradients, no eyebrow labels, no entrance animations (150 ms fades on menus and sheets only,
removed under `prefers-reduced-motion`).

**Colors** (CSS variables, `oklch` in code; hex here for reference):

| Token       | Light     | Dark                | Role                                               |
| ----------- | --------- | ------------------- | -------------------------------------------------- |
| `--ink`     | `#1B2432` | `#F6F3EC` (as text) | primary text, sidebar in light                     |
| `--paper`   | `#F6F3EC` | `#0F151E`           | page background                                    |
| `--surface` | `#FFFFFF` | `#161E2A`           | cards, tables, sheets                              |
| `--line`    | `#D9D4C7` | `#2A3444`           | borders, dividers, stave lines                     |
| `--slate`   | `#5B6573` | `#9AA4B2`           | secondary text, icons                              |
| `--brass`   | `#8A6218` | `#D9A441`           | primary actions, active nav, focus ring, note head |
| `--success` | `#2F7D5B` | `#5BBF8F`           | held, paid                                         |
| `--warning` | `#B45309` | `#F0A24A`           | canceled late (charged)                            |
| `--danger`  | `#B3261E` | `#F28B82`           | destructive actions, unpaid due                    |
| `--info`    | `#2B6CB0` | `#7FB2F0`           | upcoming                                           |

All text pairs meet WCAG AA (brass on white 5.5:1, slate on paper 5.3:1, brass-dark on ink 7:1).
Status is never color alone: badge = icon + text; paid dot has a check glyph.

**Type.** Inter Variable (UI), JetBrains Mono Variable (ids, tokens, code). Tabular numerals in
tables. Scale (size / line-height): xs 12/16 · sm 13/18 · base 14/20 (desktop body) · md 16/24
(mobile body and all inputs, avoids iOS zoom) · lg 18/26 · xl 20/28 · 2xl 24/32 · 3xl 30/36.
Weights 400 / 500 (labels, nav) / 600 (headings). Sentence case everywhere.

**Spacing** (4 px base): 2, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64. Table rows 40 px desktop, list rows
≥ 56 px mobile, touch targets ≥ 44 px. **Radius:** 3 (badges), 4 (inputs, buttons), 8 (panels),
12 (sheets, dialogs), full (dots, avatars). **Focus:** 2 px brass ring, 2 px offset.

**Shell — desktop (≥ 1024)**

```
┌──────────────┬──────────────────────────────────────────────────────────────┐
│ ♩ Novis      │ Platform › Organizations › Riverside Music School   ⌘K  ☾  NT│
│──────────────├──────────────────────────────────────────────────────────────┤
│ Overview     │ Riverside Music School           ● Active   [Edit] [⋯]      │
│ Organizations│ ═════════════════════════════════════════════  (stave rule)   │
│  · Riverside │ Overview  Admins  Teachers  Students  Courses  Invites  Lessons│
│ Freelance    │                                                              │
│ Lessons      │  content                                                     │
│              │                                                              │
│ ‹ collapse   │                                                              │
└──────────────┴──────────────────────────────────────────────────────────────┘
```

**Shell — mobile (375)**

```
┌────────────────────────────┐
│ ≡   Riverside Music …   NT │  top bar: drawer, breadcrumb tail, user menu
├────────────────────────────┤
│ Teachers (12)          [+] │
│ Overview Admins Teachers › │  tab strip scrolls horizontally
│ ┌────────────────────────┐ │
│ │ Ana Pop        ● Active│ │
│ │ ana@school.ro       ⋯  │ │  row ≥ 56 px, actions in a bottom sheet
│ └────────────────────────┘ │
│ ┌────────────────────────┐ │
│ │ …                      │ │
│ └────────────────────────┘ │
│        ‹  1 / 3  ›         │
└────────────────────────────┘
```

**List page — desktop**

```
Teachers (12)                                              [Add teacher]
[🔍 Search loaded rows…]  [Status ▾]                    1–20 of 42   ‹ ›
┌───────────────────────────────────────────────────────────────────────┐
│ Name ▲         Email                 Joined          Status         ⋯ │ sticky
├───────────────────────────────────────────────────────────────────────┤
│ Ana Pop        ana@school.ro         12 Oct 2026     ● Active       ⋯ │ 40 px
│ Mihai Rusu     mihai@school.ro       10 Oct 2026     ○ Disabled     ⋯ │
└───────────────────────────────────────────────────────────────────────┘
```

**Detail page — desktop**

```
← Teachers
Ana Pop                                    ● Active   [Edit]  [Actions ▾]
ana@school.ro · 3e340795-7fc4-42e5-925b-4113b2eb85fa ⧉
═══════════════════════════════════════════════════════════  (stave rule)
┌ Details ─────────────────────────┐ ┌ Memberships ──────────────────────┐
│ Id        3e340795-…-4113b2eb85fa⧉│ │ Riverside Music School   TEACHER  │
│ Email     ana@school.ro          │ │ Downtown Jazz            ADMIN    │
│ Name      Ana Pop                │ └───────────────────────────────────┘
│ Status    Active        (ACTIVE) │ ┌ Courses (3) ─────────── [New course]┐
│ Password  Yes                    │ │ Piano — beginners        ● Active  │
│ Freelance No                     │ │ Piano — intermediate     ● Active  │
│ Created   12 Oct 2026, 14:03 ⓘ   │ └───────────────────────────────────┘
└──────────────────────────────────┘ ┌ Danger zone ──────────────────────┐
                                     │ Remove from Riverside  [Remove]   │
                                     │ Delete account         [Delete]   │
                                     └───────────────────────────────────┘
```

On mobile the columns stack (details, memberships, courses, danger zone) and the header actions
collapse into one menu.

## 8. Responsive and accessibility rules

Breakpoints: 375 (phone), 768 (tablet: sidebar hidden, drawer), 1024 (sidebar collapsed to icons),
1280 / 1440 (full). No horizontal page scroll at any width; `min-width: 0` on flex children; long
ids wrap or truncate with a copy button. WCAG 2.2 AA: all controls labelled, visible focus,
Radix dialogs trap and restore focus, `aria-live` for toasts and step status, `prefers-reduced-motion`
respected, contrast checked in both themes, status conveyed by icon + text.

## 9. Testing plan

- **Unit (Vitest):** `client.ts` (refresh single-flight, both tokens replaced, queued retries, logout
  on `INVALID_REFRESH_TOKEN` / `ACCOUNT_UNAVAILABLE`, `ApiError` parsing), `tokenStore`,
  `deriveCapabilities` and lesson predicates, zod schemas (limits from API.md §1.7), formatters.
- **Component flows (RTL + MSW 3):** sign in → redirect per role; create organization; create admin /
  teacher (incl. course step and partial success); create student with course (incl. enrollment
  retry); edit / delete each entity with the right confirm copy; lesson create / close / toggle
  paid / delete rules; `403` and `404` handling.
- **e2e (Playwright) against the live backend:** one login per run (rate limit); super-admin creates
  an organization (unique slug) → admin → course → student with that course → lesson → close →
  mark paid; screenshots of the main screens at 1440 / 375 in light and dark, reviewed before each
  phase closes. If the backend cannot run, the summary says so.
- Gates per phase: `npm run typecheck && npm run lint && npm run test && npm run build`.

## 10. Phases

| #   | Phase                                       | Deliverables                                                                                                                                                     | Done when                           |
| --- | ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| 0   | Discovery                                   | `docs/BACKEND_GAPS.md`, `docs/PLAN.md`, `docs/DECISIONS.md`                                                                                                      | **checkpoint: you decide the gaps** |
| 0b  | Backend changes (if approved)               | per `../novis-backend/CLAUDE.md` recipe, tests green, API.md / README / CHANGELOG / CLAUDE.md updated                                                            | `cd api && ./mvnw test` passes      |
| 1   | Foundation                                  | tooling, tokens + themes, shell, API client + generated types, session + guards, public routes, `/no-access`, `/account`; README / CLAUDE.md / CHANGELOG started | gates pass, screenshots reviewed    |
| 2   | Organizations + org workspace (super-admin) | orgs list / create / overview / archive; admins, teachers, students, courses, invites tabs                                                                       | flows tested with MSW               |
| 3   | Freelance                                   | list, profile, students, courses                                                                                                                                 | same                                |
| 4   | Lessons                                     | ledger, agenda, detail, create, schedule, close, journal, payment, delete, prepaid, balances                                                                     | same                                |
| 5   | Org admin console                           | `/org/:orgId/*`, picker / switcher, admin capabilities                                                                                                           | same                                |
| 6   | Polish                                      | responsive + a11y pass with screenshots, states, dark theme                                                                                                      | same                                |
| 7   | Docs and wrap-up                            | README router + actions tables, CLAUDE.md, CHANGELOG, DECISIONS, BACKEND_GAPS; summary                                                                           | commit                              |

Each phase ends with a commit on `main`.

**Status (2026-10-16):** all phases delivered; see `CHANGELOG.md` for what each one landed and
`README.md` → Verification for how it was checked.
