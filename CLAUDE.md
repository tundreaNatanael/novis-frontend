# CLAUDE.md — novis-admin

Guide for AI agents and developers changing this repo. Keep it current when a convention changes.
It is a guide, not a changelog: history lives in `CHANGELOG.md`, decisions in `docs/DECISIONS.md`.

## What this is

The Novis **admin console** (React SPA) for super-admins and organization admins. The backend is
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
src/features    auth/ account/ platform/ org-workspace/ freelance/ lessons/ — pages are route modules
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
sentences live in `errorMessage`.

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
`src/api/schema.d.ts` is **hand-edited** to that contract until the backend change
lands: regenerate it with `npm run api:types` and fix `types.ts` first. Shared detail pages read
their scope with `useWorkspaceScope()` (`kind: 'org' | 'freelance'`). Lessons live in
`src/features/lessons`: `LessonLedger` takes a `FixedScope` and is mounted three times; every
filter is a URL param (`lessonFiltersFromParams`); names for id-only rows come from
`useLessonNames`; transitions and their disabled reasons are `lessonRules` in
`src/lib/permissions.ts`; the paid toggle is the only optimistic update. Tests: Vitest + MSW over
the real route tree (`src/test/render.tsx`), Playwright in `e2e/` (API sign-in fixture, live
smoke flow, phone checks, screenshots + axe). Open follow-ups are the **B** items in
`docs/BACKEND_GAPS.md` (G17 refresh grace window, G18 nullable PATCH fields, G19 names on lesson
rows) and the README's Known limitations.

## Don'ts

- No roles or organization ids sent as authorization; no reading raw roles in components.
- No server data in global stores (only TanStack Query).
- No hard-coded colors outside `src/index.css`; no `any` without a comment saying why.
- No UI that pretends: no password field the API ignores, no delete button that will `409`
  (disable it and show the reason instead).
- No editing `src/api/schema.d.ts` by hand; regenerate it.
- No merging the backend's docs and code mentally: when they differ, the code wins and the
  difference is recorded.
