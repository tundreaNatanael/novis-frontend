# CLAUDE.md — novis-admin

Guide for AI agents and developers changing this repo. Keep it current when a convention changes.
It is a guide, not a changelog: history lives in `CHANGELOG.md`, decisions in `docs/DECISIONS.md`.

## What this is

The Novis **admin console** (React SPA) for super-admins and organization admins, and — apart from
it, at `/teach` — the **teacher workspace** (D-051): the mobile app's screens for a desktop, for a
teacher of a school or a freelance teacher, in English or Romanian. The backend is
the sibling repo `../novis-backend`: **`API.md` there is the HTTP contract**, and when its docs
and its Java code disagree, **the code wins** (record the discrepancy in `docs/BACKEND_GAPS.md`).
Requirements and screens: `docs/PLAN.md`. Gaps between requirements and API: `docs/BACKEND_GAPS.md`.

## Stack (pinned in package.json)

React 19.3 · TypeScript 6.0 (not 7: tooling peers) · Vite 8.3 · React Router 8.4 (data mode,
`RouterProvider` from `react-router/dom`, lazy route modules) · TanStack Query 5.104 · TanStack
Table 9.3 (`useTable` + explicit `features`) · react-hook-form 7.90 + zod 4.6 · Tailwind 4.3 +
shadcn/ui (`radix-nova` style on `radix-ui` 1.8, class merging via the `cn` package) · lucide-react ·
sonner · date-fns 4 · Vitest 5 + Testing Library + MSW 3 (`msw/http`, `msw/node`) · Playwright 1.64 ·
ESLint 10 + Prettier 3. Node ≥ 22.22.

## Commands

```bash
npm run start          # http://localhost:5173 (backend CORS must allow this origin)
npm run typecheck && npm run lint && npm test && npm run build   # the gate for every task
npm run e2e            # Playwright against the dev server + a live API (VITE_API_BASE_URL / .env); needs `npx playwright install chromium` once
npm run api:types      # regenerate src/api/schema.d.ts from the running backend's OpenAPI
```

Dev login: `admin@novis.local` / `ChangeMe123!` (throttled 5/min per email — sign in once).

## Layout

```
src/app         providers (queryClient.ts, theme.tsx, app.tsx), router.tsx, route-handle.ts, shell/ (sidebar, top bar, drawer, breadcrumbs, ⌘K)
src/api         client.ts · errors.ts · types.ts · schema.d.ts (generated) · paging.ts · <resource>.ts (api + query keys)
src/auth        tokenStore.ts · session.tsx (SessionProvider, useSession, useMe) · guards.tsx
src/features    auth/ account/ platform/ org-workspace/ freelance/ lessons/ homework/ teacher-payouts/ finance/ — pages are route modules (homework/, teacher-payouts/ and finance/ hold panels, sheets and tables those pages share)
src/features/teach  the teacher workspace (D-051): teach-layout.tsx (providers + shell), pages/, components/ (its own primitives), sheets/ (every form + sheet-host.tsx), calendar/, data/ (query and mutation hooks), i18n/ (en.ts, ro.ts, the provider), lib/ (dates, formatters, schemas, capabilities), lessons/ courses/ students/ materials/ (pure helpers)
src/components  ui/ (shadcn, re-themed) · form/ (Field, FormError, applyServerErrors) · page-header, brand-mark, …
src/lib         permissions.ts (capabilities + lessonRules) · format.ts · schemas.ts · use-*.ts hooks
src/test        setup.ts (jest-dom, MSW lifecycle, cleanup) · server.ts
e2e/            Playwright specs; playwright.config.ts at the root
docs/           PLAN.md · BACKEND_GAPS.md · DECISIONS.md
```

## Conventions

**API client and errors.** All HTTP goes through `request()` / `http` in `src/api/client.ts`:
bearer header, JSON, `ApiError` (`status`, `code`, `message`, `fieldErrors`) and `NetworkError`.
`401 TOKEN_EXPIRED` → one shared refresh, both tokens replaced, request retried once;
`INVALID_REFRESH_TOKEN` / `ACCOUNT_UNAVAILABLE` / `INVALID_TOKEN` → `expireSession()`. Never
send roles or organization ids as authorization input; the server derives them. Copy is chosen by
`error.is(code)` (typed by `ApiErrorCode`), never by matching `message` text (D-038); shared
sentences live in `errorMessage`. A `409 SCHEDULE_CONFLICT` (an overlapping lesson) is not an error
to show but a question: `OverlapConfirmDialog` asks, and confirming resends the same request with
`allowOverlap: true` (D-045).

**Types.** `src/api/schema.d.ts` is generated and never edited. `src/api/types.ts` is the typed
overlay: it makes response fields required (springdoc emits no `required`) and re-adds `| null`
where API.md marks `?`; request bodies are hand-written there. Resource modules import only from
`types.ts`.

**Query keys and invalidation.** Each resource module exports `xxxKeys` (`all`, `lists()`,
`list(filters, params)`, `detail(id)`, …) and `xxxApi`. A mutation invalidates exactly the keys
its module header lists. No server data in global stores or React state beyond the query cache.
The only optimistic update is the lesson paid / unpaid toggle.

**Capabilities, not roles.** Components call `deriveCapabilities(me, orgId)` from
`src/lib/permissions.ts` and read flags (`canManageTeachers`, `canEditEmail(user)`, …) or
`lessonRules` predicates (`canDelete`, `deleteDisabledReason`). Guards are UX only; handle `403`
(disable the action and explain) and `404` ("not found or not accessible") where they happen.

**Payments: actions from the capability, display from the data.** Mark paid / unpaid, Add
prepaid, the use-prepaid box and the Payment filter / column follow `canManageStudentPayments`
(the super-admin and the organization's admin). What is shown follows the response:
`studentPayment: null` and `null` balance counts render nothing, never "unpaid" (D-040). Teacher
payouts (what the organization paid its teachers) are a different thing with a different word: the
Payouts panel follows `canManageTeacherPayouts`, and `Lesson.teacherPayout` shows in its own field
(D-047). Never call a teacher payout a "payment" in copy.

**Forms.** react-hook-form + `zodResolver`; schemas come from `src/lib/schemas.ts` and mirror
API.md §1.7. Use `<Field>` for label / hint / error wiring and `applyServerErrors()` to map
`fieldErrors` onto fields; the remaining message goes into `<FormError>`. Multi-step creates
report each step and offer a retry for the failed one. Never show a field the API ignores.

**One org workspace, two mounts.** The organization workspace is built once under
`src/features/org-workspace` and mounted at `/platform/orgs/:orgId/*` and `/org/:orgId/*`
(`orgWorkspaceRoutes()` in `src/app/router.tsx`). Tabs and actions a role cannot use are not
rendered.

**Routing.** Pages are lazy route modules: `export function Component()` plus
`export const handle: RouteHandle = { crumb, title }` (breadcrumbs read `handle.crumb`). List state
and open sheets live in the query string (`?page=&sort=&new=1&edit=<id>`). Detail pages have
their own URLs.

**Styling.** Tokens live in `src/index.css` only (`:root` / `.dark`, mapped into Tailwind via
`@theme inline`); no hard-coded colors elsewhere. Semantic colors (`success`, `warning`, `danger`,
`info`, each with a `-soft` background) always pair with an icon or text. Flat surfaces, 1 px
borders, shadows only on floating layers, no gradients, no entrance animations. The stave motif
(`BrandMark`, `StaveRule`, `.stave-rail`) is the one decorative element.

**Responsive and accessibility.** Design at 1440 / 1280 / 1024 / 768 / 375. Tables become stacked
lists below `md`; sheets go full-screen; tab strips are the only horizontal scroller. Touch targets
≥ 44 px on phones, inputs 16 px on phones. WCAG 2.2 AA: labels for every control, visible focus,
Radix dialogs trap focus, `prefers-reduced-motion` respected, status never by color alone.

**Copy.** Sentence case, plain verbs, the user's vocabulary (organization, admin, teacher, student,
lesson, course). An action keeps its name through the flow ("Archive organization" → toast
"Organization archived"). Errors say what happened and what to do; they do not apologize.

**The teacher workspace (`/teach`, D-051) is its own app inside this one.** It reuses the API
modules, `tokenStore` / session, the shadcn primitives, `Field` / `SelectField` and the pure
homework helpers, and nothing of the console's pages or shell. Its rules: every string goes
through `useT()` from `src/features/teach/i18n` (add the key to `en.ts`, mirror it in `ro.ts`;
`i18n.test.ts` checks the parity) — no console component with English copy inside a teacher
screen; dates go through `useFormatters()` (the browser's locale and time zone, ISO with offset
to the API: `lib/dates.ts`); the look comes from the `teach` class the layout puts on `<html>`
(indigo tokens in `src/index.css`, so portals match), with the status tones of
`components/tone.ts`; forms are sheets opened through `useTeachSheets().open({ kind, … })` and
rendered once by `TeachSheetHost`, never mounted per page; lists are infinite queries under the
API modules' keys (`lessonKeys.infinite`, `teacherKeys.*`) and anything that changes a lesson
calls `useInvalidateLessons()` (lessons + students + everything under `teacherKeys`); actions
follow `teachCapabilities(me)` (`canManageStudentPayments` and `canManageCourses` for a freelance
teacher only: the Courses tab, New course, Edit, Archive; `canViewPayouts` for an org teacher
only), display follows the data (`studentPayment: null` and
`null` counts render nothing). The calendar keeps its view, day and segment in the URL
(`?view=&date=&segment=&focus=`), one `GET /teacher/calendar` per local-midnight window.

## Recipes

**Add a page.** Create `src/features/<area>/<name>-page.tsx` exporting `Component` and `handle`;
register it in `src/app/router.tsx` under the right guard; add the row to README → Router (and
Actions when it adds actions); add a test if it has logic.

**Add an endpoint call.** Add the function and, if new, the key to the resource module in
`src/api/`; document the invalidation in the module header; call it from a `useQuery` /
`useMutation`; add the endpoint to the README action tables.

**React to a backend API change.** Start the backend (dev profile), run `npm run api:types`,
fix compile errors in `src/api/types.ts` first, then the affected modules and pages; update
README tables and, if a gap status changed, `docs/BACKEND_GAPS.md`.

**Add a shadcn component.** `npx shadcn@4.21.5 add <name>`; keep it under `src/components/ui`
and let the tokens theme it (do not hard-code colors in it).

## Definition of done

`npm run typecheck`, `npm run lint`, `npm test` and `npm run build` pass; new logic has tests
(client, capabilities, schemas, key flows with MSW); screens were looked at on desktop and phone
widths in both themes; `CHANGELOG.md` updated; README / this file / `docs/DECISIONS.md` /
`docs/BACKEND_GAPS.md` updated whenever routes, actions, conventions, decisions or gap statuses
changed. **Every task ends with this documentation pass**, so a future conversation can continue
from the files alone.

## Current state

All seven phases of `docs/PLAN.md` §10 are delivered: discovery and the approved backend changes
(committed in `../novis-backend`), foundation, the organization workspace (mounted at
`/platform/orgs/:orgId/*` and `/org/:orgId/*`), the freelance-teacher workspace, lessons, the
admin console, the polish pass and the docs. **One role per account** (D-036, gap G20): `User`
has `role` + `organization` (with `membershipId`); an admin runs exactly one active organization,
so there is no picker or switcher; `ROLE_CONFLICT` / `INVITE_PENDING` / `ACCOUNT_WITHOUT_ROLE`
copy lives in `errorMessage`, and accept-invite maps its own codes (an existing account enters its
current password). The super-admin's Freelance section (D-037) runs on `/freelance-teachers`: the
list is searched on the server (`q` debounced with `useDebouncedValue`, the only list that does
not filter the loaded page), Disable / Re-enable are explicit confirmed actions, Delete asks for
the email and explains the cascade, and the teacher workspace shows a 404 page for any other id.
`src/api/schema.d.ts` is generated from the backend (`npm run api:types`, last run on 2026-10-25
after `MaterialResponse` gained `contentType` / `sizeBytes` and `POST /materials/{id}/complete`
appeared; before that, after `StudentFinanceRowResponse` gained `active`; before that, the student profiles on one email:
`StudentCreatedResponse`, `StudentLoginResponse`, `GET /students/{id}/profiles`, `GET /me/profiles`,
the select / switch auth routes); after a backend change regenerate it and fix `types.ts` first. **Siblings on one email** (D-049): a
student is one profile of its email; the student page lists the other profiles inside the
workspace from `GET /students/{id}/profiles` (the server filters by reach; the super-admin gets every
sibling and sees each one's school, linked into that school's workspace), Add student's toast
follows `profileCreated`, and `PATCH /students/{id}` `email` moves one profile only. Lessons have a length (New lesson follows the course's default until edited, the schedule
sheet sends it when changed) and show start–end times (`formatTimeRange` /
`formatDateTimeRange`); an overlap is confirmed and booked anyway on request (D-045); weekly series
are the mobile app's. Homework (D-041) is a
**Homework** panel on lesson and student detail (`src/features/homework`) with one **Assign
homework** sheet: teacher fixed on a lesson or picked, course from the student's active
enrollments with that teacher, due date sent as the end of the local day; the close sheet is
outcome + journal only (D-030). Each row's ⋯ menu edits the homework (the same sheet in edit
mode, D-042: only changed fields go out, an emptied due date goes out as `null`, the lines are the
teacher's and the ticks the student's, re-read with `GET /homework/{id}` before the checklist is
replaced; the pure helpers are in `homework-state.ts`) and deletes it after a confirmation; a
`404` refreshes the list, a `403` disables that row's actions. Shared detail pages read
their scope with `useWorkspaceScope()` (`kind: 'org' | 'freelance'`). Lessons live in
`src/features/lessons`: `LessonLedger` takes a `FixedScope` and is mounted for the platform, each
organization (both workspace mounts) and each freelance teacher; every
filter is a URL param (`lessonFiltersFromParams`); names for id-only rows come from
`useLessonNames`; links to lesson pages come from `useLessonPaths()` (the super-admin's
`/platform/lessons/…`, an org admin's `/org/:orgId/lessons/…`, D-040); transitions and their
disabled reasons are `lessonRules` in `src/lib/permissions.ts`; the paid toggle is the only
optimistic update. Org admins have the Lessons tab and lesson detail and record their
organization's payments (D-040). **Teacher payouts** (D-047) are a Payouts panel on a teacher's
page (`src/features/teacher-payouts`, `src/api/teacher-payouts.ts`, `canManageTeacherPayouts`): the
owed count and payable lessons with checkboxes (the selection survives paging) or "Pay everything
up to…" (`upTo` = the start of the next local day), one Record payout sheet, and the history with
"Show voided" and a type-`void` Void dialog; the pure helpers are in `payout-state.ts`; a link
ending in `#payouts` (`payoutsPath`) lands on the panel. Lesson
detail shows `teacherPayout` in its own field, and an uploaded material there has **Open**
(D-050): a fresh signed URL from `materialsApi.downloadUrl` opened inline in a new tab (pre-opened on
the click, opener cleared); uploading is the mobile app's. **Finance** (D-048) is a tab of the organization
workspace (`canViewFinance`; `src/features/finance`, `src/api/reports.ts`, page
`org-workspace/pages/finance-page.tsx`): a period in the URL turned into instants in the browser's
time zone (`finance-period.ts`), four cards from the summary, and a Students and a Teachers table
sorted and paged by the API under their own URL prefixes (`useListParams({ prefix })`); counted in
lessons with the names of `src/features/lessons/lesson-counts.ts`, which the Lesson balances share; a
teacher or student who left is marked "Former …" and linked for the super-admin only
(`canOpenFormerTeachers` / `canOpenFormerStudents`).
**The teacher workspace** (D-051, `src/features/teach`) gives teachers the mobile
app's feature set on the web: `homeFor` sends a `TEACHER` of an active organization or a
`FREELANCE_TEACHER` to `/teach` (`RequireTeacher`), where Today, Students, Calendar, Courses (a
freelance teacher's only: a school's admin assigns an org teacher's courses, D-053), a
lesson, Payments (org teachers) and Profile mirror the app's screens, with the app's sheets (book
one lesson or a weekly series with a dry run, schedule, finish, journal, attach a link or upload a
file behind `VITE_ENABLE_UPLOADS` (D-052), homework, students, credits, courses, enroll, password)
and its English / Romanian copy. Walked through in the browser against the dev backend as the demo
teacher (Today, calendar, a lesson, students, courses, profile, both themes and languages, desktop
and phone widths).
Tests: Vitest + MSW over
the real route tree (`src/test/render.tsx`), Playwright in `e2e/` (API sign-in fixture, live
smoke flow, phone checks, screenshots + axe; nothing for `/teach` yet). Open follow-ups are the **B** items in
`docs/BACKEND_GAPS.md` (G17 refresh grace window, G19 names on lesson rows, G21 a teacher who left
has no page for the organization's admin, G22 a CORS rule on the bucket for browser uploads) and
the README's Known limitations.

## Don'ts

- No roles or organization ids sent as authorization; no reading raw roles in components.
- No server data in global stores (only TanStack Query).
- No hard-coded colors outside `src/index.css`; no `any` without a comment saying why.
- No UI that pretends: no password field the API ignores, no delete button that will `409`
  (disable it and show the reason instead).
- No editing `src/api/schema.d.ts` by hand; regenerate it.
- No merging the backend's docs and code mentally: when they differ, the code wins and the
  difference is recorded.
