# Decisions — novis-admin

One entry per decision: date, decision, context, alternatives, consequences. Gap decisions
reference `BACKEND_GAPS.md`. Newest at the bottom.

## D-001 · 2026-10-16 · Build in `novis-frontend`, package name `novis-admin`

**Decision.** The console lives in the existing `novis-frontend/` repository (already a Vite + React +
TypeScript scaffold with one commit, opened as this session's working directory) instead of a new
`novis-admin/` sibling. The npm package is named `novis-admin`.
**Context.** The brief says "create the frontend in a new sibling folder `./novis-admin/`", but the
repository had already been created and scaffolded under `novis-frontend`.
**Alternatives.** Create `novis-admin/` and leave the scaffold unused; rename the folder.
**Consequences.** Docs refer to `novis-frontend/`; nothing is placed inside the backend. **Confirm or
override at the checkpoint** (renaming the folder later is a one-line change in the docs).

## D-002 · 2026-10-16 · TypeScript 6.0.x, not 7.0

**Decision.** Pin `typescript` 6.0.3.
**Context.** npm `latest` is 7.0.2 (2026-07), but `typescript-eslint` 8.71 declares `typescript <6.1.0`
and `openapi-typescript` 7.13 declares `^5.x`.
**Consequences.** Revisit when the toolchain supports 7. If `openapi-typescript` refuses 6, the
`api:types` script runs it with `npx -p typescript@5.9`.

## D-003 · 2026-10-16 · React Router 8 data mode with lazy route modules

**Decision.** `createBrowserRouter` + `RouterProvider` (from `react-router/dom`), route modules
loaded with `lazy`, loaders not used for data (TanStack Query owns server state), guards as layout
routes.
**Context.** v8 (2026-06) is ESM-only, drops `react-router-dom`, requires React ≥ 19.2.7; otherwise the
v7 API.
**Alternatives.** Declarative `<BrowserRouter>`; loaders for data.
**Consequences.** One place for route definitions (`src/app/router.tsx`); code-split per feature.

## D-004 · 2026-10-16 · TanStack Table v9 with explicit features

**Decision.** `useTable` with `tableFeatures({ rowSortingFeature, rowPaginationFeature, columnVisibilityFeature })`,
`manualSorting` / `manualPagination`; no `stockFeatures`, no `useLegacyTable`.
**Context.** v9 (2026-08) renamed the hook and made the feature list explicit; smaller bundle.
**Consequences.** Column helpers are typed with the features type; one `DataTable` wrapper hides it.

## D-005 · 2026-10-16 · Hand-written fetch client over generated types

**Decision.** `openapi-typescript` generates `src/api/schema.d.ts` (committed); a small hand-written
`src/api/types.ts` re-exports the schemas with `| null` added where API.md marks `?`; the HTTP
client is our own `fetch` wrapper (no `openapi-fetch`).
**Context.** The spec omits nullability and the `ApiError` schema; the refresh single-flight and
error mapping are easier to own than to bolt onto a generic client.
**Consequences.** `npm run api:types` + fixing `types.ts` is the recipe for a backend change.

## D-006 · 2026-10-16 · Session storage (gap G12, option A)

**Decision.** Access token in memory, refresh token in `localStorage`, both behind `src/auth/tokenStore.ts`;
silent refresh on load; sign-out revokes and clears.
**Alternatives.** `sessionStorage` (per tab, worse UX), a BFF with an `HttpOnly` cookie (out of scope).
**Consequences.** Documented XSS trade-off and mitigations (CSP, no third-party scripts, server-side
reuse detection). Requires `CORS_ALLOWED_ORIGINS` to include the console origin (backend `.env`).

## D-007 · 2026-10-16 · Own theme provider

**Decision.** A small provider sets `class="dark"` on `<html>` from the system preference or the
user's toggle (persisted in `localStorage`), instead of `next-themes`.
**Consequences.** One dependency less; tokens defined once in CSS for both themes.

## D-008 · 2026-10-16 · Typefaces

**Decision.** Inter Variable for UI text, JetBrains Mono Variable for ids and tokens, both
self-hosted via `@fontsource-variable/*`; tabular numerals in tables.
**Alternatives.** System font stack (inconsistent across OS), Google Fonts (third-party request).

## D-009 · 2026-10-16 · One lesson detail URL

**Decision.** Lesson detail lives only at `/platform/lessons/:lessonId`; the organization and
freelance ledgers link there.
**Consequences.** No duplicated detail route; breadcrumbs carry the origin via `?from=`.
**Update (D-040).** That is the super-admin's one URL; an org admin's lesson detail lives in their
workspace, `/org/:orgId/lessons/:lessonId`.

## D-010 · 2026-10-16 · Members endpoint as the source for org people lists

**Decision.** Admins / teachers / students tabs read `GET /orgs/{orgId}/members?role=…`, never the
global `GET /students`.
**Context.** Gap G4: the global lists have no organization filter; the members endpoint is scoped.
**Consequences.** Lists sort by "joined" only and show account status after detail fetch (G14).

## D-011 · 2026-10-16 · Student create rosters the student under the course's teacher

**Decision.** `POST /students` is sent with `teacherId = selectedCourse.teacherId` in addition to the
enrollment call.
**Context.** Gap G3. The roster row records the organization scope and lets the teacher see the
student in the mobile app at once; lessons without a course resolve their organization from it.
**Consequences.** Removing a student from the organization must mention the roster row stays.
**Update (D-039).** Only while that teacher is still a TEACHER of the organization.

## D-012 · 2026-10-16 · List and sheet state in the URL

**Decision.** Search, filters, sort, page and view live in the query string; create / edit sheets open
from `?new=1` / `?edit=<id>`.
**Consequences.** Every list state and form is shareable and survives reload.

## D-013 · 2026-10-16 · e2e logs in once per run

**Decision.** The Playwright suite authenticates once and reuses storage state.
**Context.** Gap G15: login is throttled to 5/min per email.

## D-014 · 2026-10-16 · Gap defaults proposed at the checkpoint

**Decision.** Recommended defaults per gap (see `BACKEND_GAPS.md` summary): B for G1, G4, G5, G6,
G13; A for G2, G3, G7, G8, G9, G10, G11, G12, G14, G15. Each becomes its own entry here once decided.
**Consequences.** Phase 0b (backend) runs only for approved B items, following
`../novis-backend/CLAUDE.md` → "Adding a feature".

## D-015 · 2026-10-16 · Gap decisions taken (checkpoint)

**Decision.** You chose the recommended defaults: **B** (backend change) for G1, G4, G5, G6 and
G13; **A** (adapt the UI) for G2, G3, G7, G8, G9, G10, G11, G14, G15; G12 as config (CORS origin
added to the backend `.env`). Build in `novis-frontend` (D-001 confirmed), TypeScript 6 (D-002).
**Consequences.** Backend commits `9366a80` and `fc41fd6` on `novis-backend/main` add the endpoints
and tests; `docs/BACKEND_GAPS.md` statuses updated. The running IntelliJ backend needs a restart to
pick up `CORS_ALLOWED_ORIGINS`; meanwhile development points `VITE_API_BASE_URL` at a second
instance on port 8090 started from the same checkout.

## D-016 · 2026-10-16 · shadcn/ui on Radix via the `radix-nova` style; `cn` package

**Decision.** `npx shadcn init -b radix -p nova` (style `radix-nova`, imports from `radix-ui`),
not the CLI default `base-nova` (Base UI). Class merging uses the `cn` package shadcn 4 generates
(`src/lib/utils.ts` re-exports it) instead of `clsx` + `tailwind-merge`.
**Context.** The brief asks for Radix primitives; shadcn 4 defaults to Base UI.
**Consequences.** `clsx`, `tailwind-merge`, `@base-ui/react`, `next-themes` and the Geist font the
CLI installed were removed; the toaster uses our theme provider.

## D-017 · 2026-10-16 · No `eslint-plugin-jsx-a11y`; axe in Playwright instead

**Decision.** Drop the a11y ESLint plugin (its peer range stops at ESLint 9) and add
`@axe-core/playwright` for accessibility checks in the e2e suite (Phase 6).
**Consequences.** Accessibility is verified on rendered pages (Radix semantics, labels, contrast)
rather than by static lint rules.

## D-018 · 2026-10-16 · `openapi-typescript` runs through `npx` with TypeScript 5

**Decision.** The generator declares a TypeScript 5 peer and refuses to install next to TypeScript 6,
so `npm run api:types` runs `npx -p typescript@5.9.3 -p openapi-typescript@7.13.0` in its own
sandbox; the output `src/api/schema.d.ts` is committed.

## D-019 · 2026-10-16 · Response types are made strict by hand (`src/api/types.ts`)

**Decision.** springdoc emits no `required` lists, so every generated field is optional. The overlay
makes response fields required (`Strict<T>`), re-adds `| null` where API.md marks `?`
(`Nullable<T, K>`), and hand-writes request bodies. Resource modules import only from `types.ts`.
**Consequences.** After `api:types`, compile errors in `types.ts` are the first thing to fix.

## D-021 · 2026-10-16 · Access token mirrored in `sessionStorage` (amends D-006)

**Decision.** The access token is kept in memory **and** per tab in `sessionStorage`; the refresh
token stays in `localStorage`.
**Context.** With the access token in memory only, every page load refreshed. A reload that
interrupted an in-flight refresh made the next load reuse the already-rotated token; the backend
treats reuse as theft and revoked every session (observed during the Phase 1 visual review; gap G17).
**Alternatives.** Keep memory-only and accept the race; a backend grace window for reuse (G17-B).
**Consequences.** Reloads and navigations no longer touch `/auth/refresh`; a short-lived token sits
in `sessionStorage` (same XSS exposure class as the refresh token, far shorter lifetime).

## D-020 · 2026-10-16 · Dark sidebar in both themes

**Decision.** The sidebar is ink (`#1B2432`) in the light theme too, with the brass active marker;
content areas stay paper / white. It is the one high-contrast surface and makes the shell
recognizable without decoration.

## D-022 · 2026-10-16 · Student create: course optional, roster under the course's teacher

**Decision.** The "Add student" form takes name, email and an optional course. With a course, the
student is created with `teacherId` = the course's teacher (roster row) and then enrolled.
**Context.** The brief says "email and a course"; the API requires a name, and an organization with
no course yet must still be able to add students.
**Consequences.** `409 already enrolled` counts as success; other enrollment failures keep the created
student and offer a retry.

## D-023 · 2026-10-16 · Detail layouts stack below 1280 px

**Decision.** Two-column detail pages (`xl:` grid) stack into one column below 1280 px.
**Context.** At 1024 px the side panels wrapped every value.

## D-024 · 2026-10-16 · Query devtools behind a local flag

**Decision.** The React Query devtools render in development only when
`localStorage['novis-admin.devtools'] === '1'`; the floating button otherwise covered sheet footers.

## D-025 · 2026-10-16 · Test harness over the real route tree

**Decision.** Flow tests render `createMemoryRouter(routes)` with the real providers and MSW handlers
instead of mounting components in isolation, so guards, breadcrumbs, lazy loading and navigation
after a create are tested too. Async timeouts are raised (8 s queries, 20 s tests) because lazy
route modules are transformed on first import.

## D-026 · 2026-10-16 · One scope type for shared detail pages

**Decision.** The organization and freelance workspaces provide a discriminated
`WorkspaceScope` (`kind: 'org' | 'freelance'`) through the router outlet; the student and course
detail pages, the add-student sheet and the course sheet branch on it instead of being duplicated.
**Consequences.** New scope-dependent behavior goes into those branches; a third scope would be one
more union member.

## D-027 · 2026-10-16 · No "remove from roster" for freelance students

**Decision.** The freelance students tab offers "Delete student account" only.
**Context.** The API has no endpoint for the super-admin to remove a single roster row;
`DELETE /students/{id}` as super-admin always deletes the account (gap G8). The dialog says so.

## D-028 · 2026-10-16 · Lesson names resolved per distinct id

**Decision.** `GET /lessons` rows carry ids only, so the ledger and the detail resolve teacher,
student, course and organization names with `useLessonNames`: one `useQueries` entry per distinct
id, cached five minutes, falling back to a short id while loading.
**Context.** Denormalizing the names into the row is a backend change (gap G19). One request per
entity (not per row) keeps a 20-row page at a handful of lookups that the detail pages reuse.

## D-029 · 2026-10-16 · One ledger component, scope fixed by the mount

**Decision.** `LessonLedger({ fixed })` renders the global ledger, the organization Lessons tab
(`organizationId` fixed, scope filter hidden) and the freelance Lessons tab (`teacherId` fixed,
scope and teacher filters hidden). Every filter, the view (`?view=agenda`) and the create sheet
(`?new=1`) live in the URL so a filtered view can be shared and the back button works.
**Context.** API.md §9 has one list endpoint with filters; three copies of the filters would drift.

## D-030 · 2026-10-16 · Close sheet sends journal and homework only for charged outcomes

**Decision.** For `CANCELED` the sheet hides the journal and homework fields and posts
`{ status }` alone; for `PRESENT` / `CANCELED_LATE` it posts the trimmed journal and, when
anything was typed, `homework { notes, items }`.
**Context.** The server discards journal and homework on an on-time cancellation (API.md §9.4);
asking for text it will throw away would be a form that pretends.
**Update (D-041).** The sheet sends `{ status }` plus the trimmed journal for charged outcomes
only: closing a lesson no longer hands out homework (the API answers `400` to a `homework` field).
Homework is assigned from the lesson's Homework panel.

## D-031 · 2026-10-16 · Paid toggle allowed on every status

**Decision.** "Mark paid / unpaid" is offered on pending and closed lessons alike, as an
optimistic update rolled back with the server's message.
**Context.** `PATCH /lessons/{id}/payment` has no status precondition in the service; admins fix
payment records after the fact. Deleting stays limited to pending + unpaid, as the server enforces.
**Update (D-040).** Offered only to payment managers (`canManageStudentPayments`), and only when
the lesson carries a `studentPayment`.

## D-032 · 2026-10-16 · Picker only for admins of several organizations (superseded by D-036)

**Decision.** `/org` lists ADMIN memberships as cards with live teacher / student counts; an admin
of one organization never sees it (`homeFor` → `/org/:orgId`), and the top-bar switcher appears
only with two or more. TEACHER memberships are not offered: the console is for administrators.
**Context.** Most admins run one school; a picker in their way would be a click for nothing.

## D-033 · 2026-10-16 · Playwright signs in through the API, once per worker

**Decision.** `e2e/fixtures.ts` calls `POST /auth/login` once per worker and seeds the console's
token stores (`sessionStorage` access token, `localStorage` refresh token) with an init script
before each page load, keeping the newest refresh token between tests. Specs that need the
anonymous state import Playwright's own `test`.
**Context.** Login is throttled 5/min per email and a page load without an access token would
refresh and rotate the token on every test; a leaked rotation is a reuse, which revokes every
session (gap G17).

## D-034 · 2026-10-16 · Tables drop their date column between md and lg

**Decision.** Between 768 and 1024 px the tables keep name, email / slug, status and the row
menu; Created / Joined / Sent / Enrolled (and the ledger's Course / Organization) are hidden with
`hidden lg:table-cell` on both the header and the cells. Below `md` the stacked list shows what
matters per row anyway; the detail page always has every field.
**Context.** At 768 px a fourth column pushed the table into a horizontal scroller inside its
card, which the design reserves for tab strips only.

## D-035 · 2026-10-16 · Icon rail by default on tablets

**Decision.** Between 768 and 1023 px the sidebar starts collapsed to its icon rail
(`useMediaQuery('(max-width: 1023px)')`); the user's toggle is stored and wins afterwards.
Phones keep the drawer, desktops the full sidebar.
**Context.** A 240 px sidebar left 496 px for a table at 768 px, which clipped the row menu even
after hiding the date column. The rail leaves 680 px, enough for every list at that width.

## D-036 · 2026-10-16 · One role per account: no picker, no switcher, single membership

**Decision.** The backend now gives every account one role in one place (`User.role` +
`User.organization`, gap G20). The console follows: `homeFor` sends the super-admin to `/platform`,
the ADMIN of an **active** organization to `/org/:orgId` and everyone else (an archived
organization's admin included) to `/no-access`. The `/org` picker page and the top-bar switcher are
gone; `/org` only redirects home for old links. Staff and student details offer one "Remove from
organization" bound to `organization.membershipId` (the member-list scan `useUserMemberships` is
gone). An org admin covers the teachers and students of their organization, never another admin:
admin accounts, admin memberships and admin invitations are the super-admin's (disabled with the
reason otherwise). Org invites list pending ones by default (`?status=`), resend through
`POST /invites/{id}/resend` and revoke any unused one. `409 ROLE_CONFLICT` / `INVITE_PENDING` get
fixed sentences in `errorMessage`; same-place `CONFLICT`s keep their form's own sentence.
**Context.** Supersedes D-032: an admin of several organizations can no longer exist, and the
membership id now comes with the user.
**Alternatives.** Keep the picker as a fallback for legacy rows — rejected, the backend's V7
migration refuses to start with such rows.
**Consequences.** `src/api/schema.d.ts` was edited by hand to the agreed contract while the backend
was being changed; regenerate it (`npm run api:types`) once the backend runs and fix any drift in
`src/api/types.ts` first.

## D-037 · 2026-10-16 · Freelance teachers: own resource, explicit status actions, typed delete

**Decision.** The super-admin's Freelance section works on `/freelance-teachers` only (list, get,
create, patch, delete); `GET /users?freelance=true` stays for the lesson pickers. The list is
searched and filtered by status **on the server** (`q`, `status`), the search debounced 300 ms
(`useDebouncedValue`) so typing sends one request per pause; it is the only list without the
"filters this page only" note. Status is not a field of the edit sheet: **Disable account** and
**Re-enable account** are their own actions, each behind a confirmation (disabling ends every
session). **Delete freelance teacher** spells out the cascade (students deleted and signed out,
courses archived, lessons, homework and materials kept) and asks for the teacher's email, as
archiving an organization asks for its slug. Pending invitations are only the usable ones
(`GET /invites?status=PENDING`, 10 per page), resent through `POST /invites/{id}/resend`. The
teacher's workspace shows a not-found page for any id `GET /freelance-teachers/{id}` refuses (an
org member, a student, a deleted account) instead of the old "no longer marked as freelance"
alert; its breadcrumb fetches for the super-admin only, because breadcrumbs render before the
guard redirects anyone else.
**Context.** One role per account (D-036, gap G20): a freelance teacher never belongs to an
organization, is managed by the super-admin only, and deleting one removes their students.
**Alternatives.** A Status select in the edit sheet (as for staff) — rejected, disabling ends
sessions and deserves its own confirmation; a plain confirm for delete — rejected, the cascade
deletes other people's accounts and cannot be undone.

## D-038 · 2026-10-16 · Error copy by code, never by message text

**Decision.** Forms choose their sentence from `ApiError.code` (`error.is(code)`, typed by
`ApiErrorCode` in `src/api/errors.ts`), never by matching `message`. Codes with a console sentence
live in `errorMessage` (`ROLE_CONFLICT`, `INVITE_PENDING`, `ACCOUNT_WITHOUT_ROLE`); a form maps a
code to its own sentence or field only when the meaning is form-specific (add freelance teacher:
plain `CONFLICT` = already a freelance teacher; accept-invite: `INVITE_PASSWORD_MISMATCH` on the
password field, `INVITE_ACCOUNT_DISABLED`, `INVITE_ORGANIZATION_INACTIVE`).
**Context.** The first one-role pass matched message text ("without a role", "disabled", "no
longer active") and assumed the add-freelance `CONFLICT` had one meaning; the backend then gave
those cases their own codes.
**Consequences.** A backend rewording cannot change the console's copy; a new case needs a code
in API.md §1.6 and in `ApiErrorCode`.

## D-039 · 2026-10-16 · Roster teacher only while they still teach in the organization

**Decision.** The organization's add-student sheet sends `teacherId = course.teacherId` only when
that teacher is in the organization's TEACHER members; otherwise the student is created without a
roster teacher and the enrollment alone links them. The course hint says so, and the course
select waits for the teacher list.
**Context.** Removing a TEACHER membership keeps their courses active as history, and the backend
answers an org admin's `teacherId` that is not a current TEACHER with `404 Teacher`, which failed
the whole create.
**Alternatives.** Hide such courses — rejected, enrolling in them still works and is useful until
the course is reassigned.
**Consequences.** The teacher list is the first 100 TEACHER members; a course owned by a teacher
beyond that is enrolled without a roster teacher too.

## D-040 · 2026-10-23 · Org admins run their lessons and record payments (amends D-009)

**Decision.** An org admin gets the organization's ledger as a Lessons tab and sidebar entry
(`/org/:orgId/lessons`, the same `LessonLedger`) and lesson detail inside their workspace
(`/org/:orgId/lessons/:lessonId`), where they mark lessons paid / unpaid and add prepaid lessons.
The super-admin keeps one detail URL, `/platform/lessons/:lessonId`, for every ledger.
`lessonPaths(me)` (`src/features/lessons/lesson-paths.ts`) builds the ledger, detail and workspace
links for the signed-in role; no page hard-codes `/platform/lessons` any more. Payment actions
(Mark paid, Add prepaid, the use-prepaid box, the Payment filter and column) follow the new
`canManageStudentPayments` capability; payment data on screen follows the response
(`studentPayment: null` and `null` balance counts render nothing, never "unpaid").
**Context.** The backend now lets only payment managers — the organization's admin, the
super-admin, a freelance teacher for their own lessons — record and see whether a student paid
(API.md §9). Org teachers lost it, so the org admin needs the screens that were super-admin only.
**Alternatives.** Detail routes under every workspace mount (`/platform/orgs/:orgId/lessons/:id`,
`/platform/freelance/:teacherId/lessons/:id`) — rejected: two URLs for one lesson for the
super-admin, against D-009. Opening `/platform/lessons/:id` to org admins — rejected: `/platform`
is the super-admin's area behind `RequireSuperAdmin`.
**Consequences.** An org admin's lesson detail renders under the workspace header and tabs, like
the other detail pages there, so its breadcrumb is organization › lesson. Each role has exactly one
detail URL per lesson.

## D-041 · 2026-10-24 · Homework panels with their own Assign sheet

**Decision.** Homework is listed in a **Homework** panel on lesson detail (`GET /homework?lessonId=`)
and student detail (`GET /homework?studentId=`, plus `teacherId` in a freelance workspace), open
first, then by due date. One **Assign homework** sheet (`POST /homework`) serves both: from a lesson
the teacher and the lesson are fixed and the lesson's course is preselected; from a student the
teacher comes from a picker of the organization's teachers (fixed in a freelance workspace).
Console users are admins, so the sheet always sends `teacherId`. The course select lists only the
student's ACTIVE enrollments in that teacher's active courses (anything else is a `400`) and has an
explicit "No course" option (a Radix select cannot go back to empty); a preselected course the
student left falls back to it. The due date is a day, sent as the last second of that local day,
so "overdue" (open and past `dueAt`, computed on the client) starts the next day.
**Context.** The backend made homework its own resource: one teacher, one student, course and
lesson as optional references, `completedAt` maintained by the server. The close sheet lost its
homework fields (D-030).
**Alternatives.** Keeping homework inside the close sheet — rejected, the API refuses it. A course
picker of all the teacher's courses — rejected, picking one the student is not enrolled in fails.
**Consequences.** `canManageHomework` (the super-admin and the organization's admin) gates the
button; the student page shows the teacher on each row, the lesson page does not repeat the lesson.
Editing and deleting homework stay API-only for now.
**Update (D-042).** Each row now has Edit homework and Delete homework.

## D-042 · 2026-10-24 · Editing homework: the lines are the teacher's, the ticks the student's

**Decision.** Each Homework row gets a ⋯ menu with **Edit homework** and **Delete homework**,
behind the same `canManageHomework` as Assign. Edit is the Assign sheet in an edit mode: title,
notes, due date and the checklist lines. The teacher and course are named in its description, not
offered (`PATCH` cannot change them), and `lessonId` is never sent (the sheet has no lesson picker).
Only the fields that changed go out, so an untouched field never overwrites a change made
elsewhere; with no change the sheet closes without a request. An emptied title clears it (the API
clears a blank title); a due date can be moved but not removed, so once set the field is required
and emptying it is refused with that sentence. `PATCH` replaces the whole checklist, gives every
item a new id and takes `done` as sent. So each line shows the student's tick read-only, the
checklist goes out only when its lines changed, and then the sheet first re-reads the homework
(`GET /homework/{id}`) and sends every kept line with the tick it has at that moment (matched by
item id); a new line starts open. Delete asks first and names the homework, the student and the
ticks so far. A `404` (gone, or out of the caller's reach) explains and refreshes the list; a `403`
disables that row's Edit and Delete with the reason.
**Context.** The API had `PATCH` / `DELETE /homework/{id}` all along (D-041 left them API-only).
A student ticks lines on their phone while an admin may be editing; a save built from the ticks the
sheet opened with would silently undo those.
**Alternatives.** Sending the checklist on every save — rejected: a title change would rewrite every
item id and tick. Ticks as the sheet opened — rejected, it loses ticks made meanwhile. Ticking or
unticking in the editor — not built: the ticks are the student's. A lesson picker — not built.
**Consequences.** One extra `GET` per save that rewrites the checklist; the window for a lost tick
shrinks to that round trip. Two admins rewriting the same checklist at once: the last save wins.

**Update (gap G18, homework fixed).** `PATCH /homework/{id}` now removes a field sent as `null`, so
the due date is optional in edit mode too: emptying it, or its **Clear** button (a native date
input is hard to empty by hand), sends `dueAt: null`. A lesson picker is still not built, although
the API could now unlink the lesson (`lessonId: null`).

## D-043 · 2026-10-24 · Editing a course removes an emptied description or link with `null`

**Decision.** The Edit course sheet sends `description: null` / `defaultMeetingUrl: null` for a
field that had a value and was emptied, so the API removes it; a field that was and stays empty is
left out, and a filled one goes out as typed (title and status as before, the teacher only when it
changed). The link hint now says that emptying the field removes the link and that lessons which
already have it keep it. Creating a course is unchanged.
**Context.** Gap G18, course part: `PATCH /courses/{id}` treated `null` like an omitted field, so the
sheet kept the current link when the field was emptied and said so. The backend now removes a field
sent as `null` (`title`, `status` or `teacherId` sent as `null` is a `400`; the sheet never sends it).
**Alternatives.** `null` for every empty field — rejected: a save would also remove a link someone
added after the sheet opened. A **Clear** button like the due date's (D-042) — not needed, a text
field empties by hand.
**Consequences.** Description and link can be removed from the console. The backend stores a blank
description as `null` (on create too), so a course created with an empty description has none;
courses saved earlier keep their `""` (shown as none) until edited.

## D-044 · 2026-10-24 · Rescheduling removes an emptied meeting link with `null`

**Decision.** The schedule sheet (lesson detail → ⋯ → Reschedule or unschedule) sends
`meetingUrl: null` when the lesson had a link and the field was emptied, so the API removes it. The
link goes out only when it changed: an untouched link, or an empty field on a lesson without one, is
left out; a changed one goes out as typed. The date always goes out, because the API reads a
missing `scheduledAt` as "unschedule". The hint says that emptying the field removes the link (on a
lesson that has one). Unschedule still sends `{ scheduledAt: null }` alone, so the lesson keeps its
link.
**Context.** Gap G18, lesson part: `PATCH /lessons/{id}/schedule` ignored `meetingUrl: null`, so the
sheet could change a link but not remove it, and its hint said "Leave as is to keep the current
one". The backend now removes the link sent as `null`; the course's default link is not touched.
**Alternatives.** Sending the link on every save, as the course sheet does (D-043) — rejected for
this sheet, which already left an unchanged link out, so a save never overwrites a link changed
elsewhere meanwhile. A **Clear** button — not needed, a text field empties by hand.
**Consequences.** A lesson's link can be removed from the console; the student's "Join lesson"
button goes with it.

## D-045 · 2026-10-24 · Lesson length and overlapping lessons: confirm, then book anyway

**Decision.** New lesson and the schedule sheet have a **Length (minutes)** field (15–240). In New
lesson it follows the chosen course's `defaultDurationMinutes` (else 60) until it is edited by hand;
in the schedule sheet it starts at the lesson's length and goes out only when it changed, like the
link (D-044). When the API answers `409 SCHEDULE_CONFLICT` (the time overlaps another lesson of the
teacher or the student), a confirmation, "This time is taken", offers **Create anyway** / **Move
anyway** / **Schedule anyway**, which sends the same request again with `allowOverlap: true`;
Cancel goes back to the form as typed. The course form gets a **Default lesson length** (empty =
none; emptying a set one sends `null`, as D-043 does for the link), and lessons show start–end
times wherever they showed a start time. Weekly series (`POST /lessons/series`) are not built here:
the console books one lesson at a time and only shows a lesson's series id.
**Context.** The backend's scheduling change gave every lesson a length, refuses overlaps per
teacher and per student unless the request sets `allowOverlap`, and added weekly series with a dry
run, which the task builds in the mobile app (teachers plan there); for the console the series was
optional ("mention it, don't build it").
**Alternatives.** Checking the slot before submitting (a dry run for one lesson) — rejected: the
check would race with other bookings anyway, and the 409 already says the same. A "Book anyway"
checkbox in the form — rejected: it would invite booking over lessons by default; the confirmation
appears only when there is an overlap. Showing which lesson is in the way — not possible: the `409`
carries no lesson, and the API never names another teacher's lesson.
**Consequences.** An admin can book or move a lesson over another one knowingly; the overlap stays
visible in the agenda as two lessons at the same time. Lessons booked before lengths existed show
60 minutes.

## D-046 · 2026-10-24 · The teacher calendar is the mobile app's

**Decision.** The console does not call `GET /teacher/calendar` and gets no calendar screen; its
lessons stay in the ledger and the agenda (D-040), filtered by teacher and date as before.
**Context.** The backend added a read model for the mobile app's new Calendar tab (API.md §12): a
teacher's dated lessons in a window, with the student's name and the course's title and without
payment data. It answers teachers only — organization admins and the super-admin get `403` — and
the console has no teacher users.
**Alternatives.** A week view in the console built on it — not possible for the console's users
(`403`), and `GET /lessons` already gives admins every lesson in their reach. Asking the backend to
open it to admins — rejected for now: it would repeat `GET /lessons` with other payment rules.
**Consequences.** `schema.d.ts` carries the route and `CalendarLessonResponse`, unused. Names on
lesson rows (gap G19) are still resolved in the console, since the calendar's names reach teachers
only.

## D-047 · 2026-10-24 · Teacher payouts: a panel on the teacher's page

**Decision.** Teacher payouts live in a **Payouts** panel at the bottom of a teacher's page (both
workspace mounts), behind `canManageTeacherPayouts` (the super-admin and the organization's
admin). The panel starts from what the organization owes: "Owed: N lessons" is the payable list's
`totalElements`, and the payable lessons (held or canceled late, in no live payout, oldest first,
50 per page) have checkboxes whose selection survives paging (at most 500, the API's limit).
**Record payout** opens a sheet for the ticked lessons; **Pay everything up to…** opens the same
sheet with a day instead and counts what it covers as the day changes (`size=1`, `totalElements`).
The day is turned into `upTo` = the start of the next local day, so the whole picked day is paid.
The sheet asks for the day the organization paid (today at the latest, as the API refuses a later
one) and an optional note; there is no amount field, the note carries it. The history lists live
payouts latest first ("Show voided" adds the voided ones with who voided them and why); a row opens
its lessons and voids the payout after a reason and typing `void`. Lesson detail shows the
lesson's payout in its own "Teacher payout" field, next to but apart from the student's payment.
**Context.** The backend added teacher payouts (API.md §9.6): batches of charged lessons the school
paid a teacher for, voided rather than deleted, counted in lessons. The task asked for the owed
count, a payable table with checkboxes or "Pay everything up to…", a Record payout sheet and a
history with a type-to-confirm void.
**Alternatives.** A payouts page of its own per organization — rejected: payouts are always about
one teacher, and the teacher's page is where an admin looks for them. Typing the payout's date to
confirm a void — rejected for `void`: two payouts may share a day, and the verb says what happens.
Showing a voided payout's lessons — not possible: voiding frees them, and the payout keeps only
their count.
**Consequences.** A teacher who left the organization has no page for its admin (gap G21), so
their history is paid out from the super-admin's console or through the API. A `409` (someone paid
some of the lessons meanwhile) shows the server's sentence and refreshes the lists rather than
retrying.

## D-048 · 2026-10-24 · Finance: a tab that sets students' payments against teachers' payouts

**Decision.** The organization workspace gets a **Finance** tab (both mounts, the org admin's
sidebar too), behind `canViewFinance` (the super-admin and the organization's admin). It counts
lessons, never money, with the backend's finance counts (API.md §9.7). A period picker offers This
month (the default, no URL key), Previous month and Custom days; the period lives in the URL and is
turned into two instants in the browser's time zone with calendar arithmetic (`finance-period.ts`):
the start of the first day to the start of the day after the last, so a month with a clock change
stays whole. Four cards (paid by students, used, paid to teachers, owed to teachers with the
all-time owed under it) come from `GET /orgs/{orgId}/reports/summary`. A Students and a Teachers
table follow, both sorted and paged by the API; each keeps its list state under its own URL prefix
(`useListParams({ prefix })`), and another period sends both back to their first page. A row opens
the person's page; a teacher row also links to `…/teachers/:id#payouts`, where the Payouts panel
scrolls itself into view once its lessons are in. The two mismatches (paid by the student but not
paid out, paid out but not paid by the student) are badges with an icon and words, "None" when
there is nothing to flag. A teacher who left is marked "Former teacher" and linked only for the
super-admin, since an org admin gets `404` on their page (gap G21). Prepaid left and unpaid due
share their names and hints with the student's Lesson balances (`lesson-counts.ts`): the same
numbers under the same words.
**Context.** The task asked for an admin overview of how many lessons students paid for against
how many the admin paid out to teachers, with the period computed by the client (an organization
has no time zone), summary cards, two server-sorted tables, mismatches that never rely on colour,
stacked lists on phones and the student's balances using the same numbers.
**Alternatives.** A Students | Teachers switch with one table at a time — rejected: the overview
is the point, and the cards already sum both sides. Sorting by name — not offered: the API sorts by
counts only (names come from one lookup per page that keeps deleted accounts). Invalidating the
reports from every lesson, payment and payout mutation — rejected for `staleTime: 0`: almost every
write changes them, and the tab refetches on each visit anyway. A teacher filter on the Students
table (the API has `teacherId`) — not asked for, left out.
**Consequences.** The numbers are only as fresh as the last visit or period change. An org admin
cannot open a former teacher's page from the tab (G21), nor a student who left. Custom days in the
wrong order show a field error and no request.
**Update (2026-10-24, verification).** Student rows carry `active` too: a student who left (or
whose account was deleted) is marked "Former student" and linked only for the super-admin
(`canOpenFormerStudents`), as former teachers are. The third card reads "Paid out to teachers",
the word teacher payouts always use.

## D-049 · 2026-10-24 · Student profiles on one email: shown only inside the workspace

**Decision.** A student is one _profile_ of the email it signs in with (backend V12): siblings
share an address, each with their own name, place and status, and each stays a full `Student`
row in the console. The student page gains **Other profiles on this email** from
`GET /students/{id}/profiles`, which the server limits to the profiles the caller may see — an
organization admin sees the siblings of their own organization, a freelance workspace those with
that teacher — so the console renders what comes back and never counts or names siblings elsewhere.
Add student keeps its one form: the hint says siblings can share one email and that the same name
links the existing student, and the success toast follows the API's `profileCreated` ("New profile
created for <name>" or "Student created"). Edit student's email hint says a change moves this
profile only. `POST /students` is typed `StudentCreated`.
**Context.** The backend task made one email hold several student profiles for a parent with two
children, with the privacy rule that staff never learn about a sibling at another school. The
console had to show the toast and hint and list the login's other profiles inside the admin's
organization.
**Alternatives.** A "Family" page grouping students by email — rejected: there is no family
entity, and an email's profiles may lie outside the organization. Filtering siblings in the browser
by comparing emails in the member list — rejected: the server's visibility is the rule, and a list
page would need every member to do it. A separate "linked" badge in the members table — not asked
for; the email column already shows the shared address.
**Consequences.** Two siblings in one school are two rows with one email in the members table and
the student lists, by design. A sibling who leaves the organization vanishes from the panel without
a trace. The panel refetches with every student invalidation (`studentKeys.all`).
**Update (2026-10-24, verification).** The API gives the super-admin every profile of the email,
wherever it learns, so for the super-admin the panel says so and names each sibling's school (from
`GET /users/{id}`), linking into that school's workspace; a sibling without a school (freelance or
no place yet) is listed without a link, since the API does not say whose roster it is on.

## D-050 · 2026-10-25 · Uploads are the mobile app's; the console opens uploaded files

**Decision.** The console does not upload materials. Teachers, who upload them, have no access to
the console (`/no-access`), and the backend's upload flow (a pending material, a signed `PUT`
straight to R2 with the content type signed in, then `POST /materials/{id}/complete`) is built
for the mobile app. The console only opens what was uploaded: on the lesson page an uploaded file
shows its title and file name with an **Open** button, which fetches a fresh signed URL
(`GET /materials/{id}/download-url`) and opens it in a new tab. The URL opens inline, so a video
plays in the browser's own player and a PDF or image shows. The tab is opened on the click, before
the request, so popup blockers allow it, and loses its opener, since it ends on the storage's
origin; a failed request closes it again and the toast says why. Links still open directly.
**Context.** The backend task that turned R2 uploads on (inline downloads, 6-hour video URLs,
pending uploads hidden until completed) asked the console for a way to open uploaded files and
nothing more.
**Alternatives.** An upload form for admins — rejected: no one asked for it, and it would need the
pending / complete / cancel flow and progress in the browser plus a CORS rule on the bucket. An
embedded `<video>` player on the lesson page — rejected for now: the browser's tab already plays the
inline URL with seeking, and an embedded player would have to refetch the URL when it expires.
Caching the download URL in the query cache — rejected: it expires, so it is fetched on every click.
**Consequences.** `src/api/materials.ts` has `materialsApi.downloadUrl` and no query keys. The
console never sees a pending upload (the API lists ready materials only). `Material` carries
`contentType` and `sizeBytes`, unused on screen for now.
