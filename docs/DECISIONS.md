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

## D-031 · 2026-10-16 · Paid toggle allowed on every status

**Decision.** "Mark paid / unpaid" is offered on pending and closed lessons alike, as an
optimistic update rolled back with the server's message.
**Context.** `PATCH /lessons/{id}/payment` has no status precondition in the service; admins fix
payment records after the fact. Deleting stays limited to pending + unpaid, as the server enforces.
