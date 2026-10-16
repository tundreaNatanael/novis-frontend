# novis-admin — the Novis admin console

The web console **super-admins** (platform owners) and **organization admins** use to run
[Novis](../novis-backend/README.md), a multi-tenant music-school ERP: organizations, admins,
teachers, students, courses, invites, freelance teachers and the lesson ledger. Teachers and
students do not use this console (they use the Novis app); a signed-in account without an admin
role sees a "This console is for administrators" screen.

Desktop first, phone proper: the same features with layouts that adapt (tables become stacked
lists, forms become full-screen sheets).

## Setup

**Prerequisites**

- Node.js ≥ 22.22 (24 recommended) and npm.
- The backend running locally: follow [`../novis-backend/README.md`](../novis-backend/README.md)
  (Postgres in Docker, JDK 21, `./mvnw spring-boot:run` → `http://localhost:8080`).

**Backend settings the console needs** (backend `.env`):

| Key                    | Why                                                                                                                                                                                                                                                                                                         |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CORS_ALLOWED_ORIGINS` | must include this app's origin: `http://localhost:5173` in development, the console's production origin in production. Without it every request fails at preflight.                                                                                                                                         |
| `APP_BASE_URL`         | the app that serves invite and password-reset links. Today it points at the Expo app (`http://localhost:8081`), which also implements `/invite/:token` and `/reset-password/:token`; this console implements both routes too, so either can be the target ([gap G11](docs/BACKEND_GAPS.md#g11-deep-links)). |

**Environment** — copy `.env.example` to `.env`:

| Variable            | Default                 | Meaning                                 |
| ------------------- | ----------------------- | --------------------------------------- |
| `VITE_API_BASE_URL` | `http://localhost:8080` | Base URL of the API, no trailing slash. |

**Dev login**: the seeded platform owner `admin@novis.local` / `ChangeMe123!`. Logins are throttled
(5 per minute per email), so sign in once and let the console refresh its own session.

```bash
npm install
npm run dev          # http://localhost:5173
```

## Scripts

| Script                                      | What it does                                                                                                                                                                                                                                         |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run dev`                               | Vite dev server on port 5173 (strict).                                                                                                                                                                                                               |
| `npm run build`                             | Type-check (`tsc -b`) and build to `dist/`.                                                                                                                                                                                                          |
| `npm run preview`                           | Serve `dist/` on port 4173.                                                                                                                                                                                                                          |
| `npm run typecheck`                         | `tsc -b` over the app, node and e2e projects.                                                                                                                                                                                                        |
| `npm run lint` / `lint:fix`                 | ESLint (TypeScript, React hooks, React Refresh, Prettier compatibility).                                                                                                                                                                             |
| `npm run format` / `format:check`           | Prettier.                                                                                                                                                                                                                                            |
| `npm test` / `test:watch` / `test:coverage` | Vitest + Testing Library + MSW (jsdom).                                                                                                                                                                                                              |
| `npm run e2e` / `e2e:ui`                    | Playwright against the dev server and a live API (`VITE_API_BASE_URL`).                                                                                                                                                                              |
| `npm run api:types`                         | Regenerates `src/api/schema.d.ts` from `${API_DOCS_URL:-http://localhost:8080/v3/api-docs}` (dev profile only). Runs `openapi-typescript` through `npx` with TypeScript 5 because the generator does not yet accept TypeScript 6. Commit the result. |

## Router

Guards are UX only (`RequireAuth`, `RequireSuperAdmin`, `RequireOrgAdmin`); the server stays the
authority and every `403` / `404` is handled in place. List state (search, filters, sort, page)
and open sheets live in the query string. Status: **done** = built, **phase n** = placeholder
page until that phase.

| Path                                                                                 | Who                      | Page                                                                                                      | Main API calls                                                                                                                                                          | Status  |
| ------------------------------------------------------------------------------------ | ------------------------ | --------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| `/login`                                                                             | public                   | Sign in                                                                                                   | `POST /auth/login`, `GET /users/me`                                                                                                                                     | done    |
| `/forgot-password`                                                                   | public                   | Request a reset link                                                                                      | `POST /auth/forgot-password`                                                                                                                                            | done    |
| `/reset-password/:token`                                                             | public                   | Choose a new password                                                                                     | `POST /auth/reset-password`                                                                                                                                             | done    |
| `/invite/:token`                                                                     | public                   | Accept an invitation (name + password)                                                                    | `POST /auth/accept-invite`, `GET /users/me`                                                                                                                             | done    |
| `/no-access`                                                                         | signed in, no admin role | "This console is for administrators" + sign out                                                           | `POST /auth/logout`                                                                                                                                                     | done    |
| `/`                                                                                  | signed in                | redirect: super-admin → `/platform`; one admin org → `/org/:orgId`; several → `/org`; none → `/no-access` | `GET /users/me`                                                                                                                                                         | done    |
| `/account`                                                                           | signed in                | Own name, email, password, memberships                                                                    | `PATCH /users/{me}`                                                                                                                                                     | done    |
| `/platform`                                                                          | super-admin              | Overview: counts and shortcuts                                                                            | `GET /orgs`, `/students`, `/courses`, `/lessons` (`size=1`)                                                                                                             | phase 2 |
| `/platform/orgs`                                                                     | super-admin              | Organizations list + create                                                                               | `GET /orgs`, `POST /orgs`                                                                                                                                               | phase 2 |
| `/platform/orgs/:orgId`                                                              | super-admin              | Organization overview (edit, archive / restore)                                                           | `GET /orgs/{id}`, `PATCH /orgs/{id}`, `DELETE /orgs/{id}`                                                                                                               | phase 2 |
| `/platform/orgs/:orgId/admins` (+ `/:userId`)                                        | super-admin              | Admins list, create, detail                                                                               | `GET /orgs/{id}/members?role=ADMIN`, `POST /orgs/{id}/staff`, `GET /users/{id}`                                                                                         | phase 2 |
| `/platform/orgs/:orgId/teachers` (+ `/:userId`)                                      | super-admin              | Teachers list, create (email, password, course), detail                                                   | members `role=TEACHER`, `POST /orgs/{id}/staff`, `POST /courses`, `GET /courses?organizationId&teacherId`                                                               | phase 2 |
| `/platform/orgs/:orgId/students` (+ `/:studentId`)                                   | super-admin              | Students list, create (name, email, course), detail with balances                                         | members `role=STUDENT`, `POST /students`, `POST /courses/{c}/enrollments`, `GET /students/{id}`, `GET /students/{id}/enrollments`, `GET /students/{id}/lessons/summary` | phase 2 |
| `/platform/orgs/:orgId/courses` (+ `/:courseId`)                                     | super-admin              | Courses list, create, detail with enrollments                                                             | `GET /courses?organizationId`, `POST /courses`, `PATCH /courses/{id}`, `DELETE /courses/{id}`, enrollments                                                              | phase 2 |
| `/platform/orgs/:orgId/invites`                                                      | super-admin              | Pending invites: revoke, resend                                                                           | `GET /orgs/{id}/invites`, `DELETE /invites/{id}`, `POST /orgs/{id}/invites`                                                                                             | phase 2 |
| `/platform/orgs/:orgId/lessons`                                                      | super-admin              | Organization ledger                                                                                       | `GET /lessons?organizationId`                                                                                                                                           | phase 4 |
| `/platform/freelance`                                                                | super-admin              | Freelance teachers list, create, invite                                                                   | `GET /users?freelance=true`, `POST /freelance-teachers`, `POST /invites`, `GET /invites`                                                                                | phase 3 |
| `/platform/freelance/:teacherId` (+ `/students`, `/courses`, `/lessons`)             | super-admin              | Profile, their students, courses, ledger                                                                  | `GET /users/{id}`, `GET /students?teacherId`, `GET /courses?teacherId`, `GET /lessons?teacherId`                                                                        | phase 3 |
| `/platform/lessons`                                                                  | super-admin              | Global ledger (table + agenda) with every filter                                                          | `GET /lessons?…`                                                                                                                                                        | phase 4 |
| `/platform/lessons/:lessonId`                                                        | super-admin              | Lesson detail and actions                                                                                 | `GET /lessons/{id}`, schedule / close / journal / payment / delete                                                                                                      | phase 4 |
| `/org`                                                                               | admin of several orgs    | Organization picker                                                                                       | `GET /users/me`                                                                                                                                                         | phase 5 |
| `/org/:orgId` (+ `/teachers`, `/students`, `/courses`, `/invites` and detail routes) | admin of that org        | The same organization workspace with admin capabilities                                                   | as above, minus admins and lessons                                                                                                                                      | phase 5 |
| `*`                                                                                  | any                      | Not found                                                                                                 | —                                                                                                                                                                       | done    |

## Actions for super-admins

| Entity                                                                                   | Action                               | Where                                    | Endpoint(s)                             | Rules and side effects                                               | Status    |
| ---------------------------------------------------------------------------------------- | ------------------------------------ | ---------------------------------------- | --------------------------------------- | -------------------------------------------------------------------- | --------- |
| Session                                                                                  | Sign in / out                        | `/login`, user menu                      | `POST /auth/login`, `POST /auth/logout` | Login throttled 5/min per email; sign-out revokes the refresh token. | done      |
| Account                                                                                  | Edit own name / email                | `/account`                               | `PATCH /users/{me}`                     | Email change changes the sign-in.                                    | done      |
| Account                                                                                  | Change own password                  | `/account`                               | `PATCH /users/{me} { password }`        | Revokes every session, including this one → sign in again.           | done      |
| Organizations, admins, teachers, students, courses, invites, freelance teachers, lessons | create / edit / archive / delete / … | org workspace, freelance section, ledger | see `docs/PLAN.md` §3                   | filled in as phases 2–4 land                                         | phase 2–4 |

## Actions for admins

| Entity                               | Action                 | Where           | Endpoint(s)           | Rules and side effects     | Status  |
| ------------------------------------ | ---------------------- | --------------- | --------------------- | -------------------------- | ------- |
| Session / Account                    | as above               | as above        | as above              | as above                   | done    |
| Teachers, students, courses, invites | create / edit / remove | `/org/:orgId/*` | see `docs/PLAN.md` §3 | filled in as phase 5 lands | phase 5 |

## Session and auth behavior

- Tokens come from `POST /auth/login` (or `/auth/accept-invite`). The **access token** (≈15 min)
  lives in memory only; the **refresh token** (90 days, rotating) lives in `localStorage` under
  `novis-admin.refreshToken`. Both go through `src/auth/tokenStore.ts`, the one module to replace
  if a cookie / BFF approach is adopted later ([gap G12](docs/BACKEND_GAPS.md#g12-web-session-storage-and-cors)).
- On load the console restores the session with one `POST /auth/refresh`, then `GET /users/me`.
- On `401 TOKEN_EXPIRED` the client runs **one** shared refresh (concurrent requests wait for it),
  stores **both** new tokens (refresh tokens rotate) and retries the requests once.
- `401 INVALID_REFRESH_TOKEN`, `ACCOUNT_UNAVAILABLE` or `INVALID_TOKEN`, or a rejected refresh,
  clear the session and send the user to `/login?reason=expired`.
- Signing out calls `POST /auth/logout` with the refresh token (best effort) and clears storage.
- Trade-off: a script injected into the page could read the refresh token. Mitigations: no
  third-party scripts, React's escaping, server-side reuse detection (reusing a rotated token
  revokes every session of the user), and the `tokenStore` seam.

## Project structure

```
src/
├── app/           providers (query client, theme, session), router, shell (sidebar, top bar, drawer, ⌘K)
├── api/           client.ts (fetch wrapper + refresh), errors.ts, types.ts (typed overlay), schema.d.ts (generated),
│                  one module per resource with its query-key factory (orgs, invites, members, users, students, courses, enrollments, lessons, auth)
├── auth/          tokenStore, session provider, route guards
├── features/      one folder per area: auth, account, platform, org-workspace, freelance, lessons
├── components/    shared UI (ui/ = shadcn primitives re-themed with our tokens, form/ = Field, FormError, server error mapping)
├── lib/           permissions (capabilities, lesson rules), format, schemas (zod), small hooks
└── test/          Vitest setup and the MSW server
docs/              PLAN.md, BACKEND_GAPS.md, DECISIONS.md
e2e/               Playwright smoke tests
```

## Known limitations

- Several screens are placeholders until their phase lands (see the Status columns above).
- Member lists sort by join date only and carry no account status (backend `Member` shape,
  [gap G14](docs/BACKEND_GAPS.md#g14-member-rows-carry-no-status-and-sort-only-by-membership-columns)).
- No `q` search parameter exists on the big lists; search filters the loaded page and says so.
- Closed lessons cannot be reopened or re-assigned; the UI shows the supported transitions only
  ([gap G9](docs/BACKEND_GAPS.md#g9-change-any-information-on-lessons)).
- Everything else that needs a backend change is tracked in [`docs/BACKEND_GAPS.md`](docs/BACKEND_GAPS.md).
