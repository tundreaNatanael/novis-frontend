# Changelog

All notable changes to the Novis admin console. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); dates are the day the change landed on `main`.

## Student profiles on one email — Unreleased

### Breaking

- Student profiles on one email (backend `student_logins`, D-049): `POST /students` answers
  `StudentCreated` = `Student` + `profileCreated`, `PATCH /students/{id}` with a staff email answers
  `409 ROLE_CONFLICT` (was `CONFLICT`) and its `email` moves one profile only, and
  `POST /auth/student-login` answers `{ tokens, profileSelection }` (the console does not call it).
  `src/api/schema.d.ts` was regenerated (`npm run api:types`).

### Added

- **Siblings on one email** (D-049): the student page shows **Other profiles on this email**, the
  siblings who sign in with the same address inside this organization (or with this freelance
  teacher), each linked to their page, from `GET /students/{id}/profiles`; the server already keeps
  siblings elsewhere out, so the panel never hints at them. Add student explains that siblings can
  share one email (each name on it is its own profile; the same name links the existing student)
  and the toast reads "New profile created for <name>" when the API created one; Edit student's
  email hint says a change moves only this profile.

### Changed

- `ApiErrorCode` lists the two student sign-in codes of API.md §1.6, `STUDENT_LOGIN_FAILED` and
  `INVALID_SELECTION_TOKEN`, so the union matches the documented list again (types only: the
  console never signs students in).
- For the super-admin, **Other profiles on this email** says it lists every profile of the email,
  wherever it learns, and names each sibling's school (`GET /users/{id}`), linking into that school's
  workspace; a sibling without a school is listed without a link. It used to word them as this
  organization's and link them into the current workspace (D-049 update).

## Finance reports — Unreleased

### Added

- **Finance** (backend finance reports, API.md §9.7, D-048): a **Finance** tab in the organization
  workspace (both mounts, and the org admin's sidebar) for the new `canViewFinance` capability (the
  super-admin and the organization's admin). Counted in lessons, never money. A period picker
  (This month by default, Previous month, Custom days) keeps the period in the URL
  (`?period=previous-month`, `?period=custom&from=&to=`) and sends it as two instants computed in
  the browser's time zone. Four cards (`GET /orgs/{orgId}/reports/summary`): paid by students,
  used, paid to teachers, owed to teachers (with the all-time owed). A **Students** table
  (`/reports/students`: paid by student, used, prepaid left, unpaid due, last payment) and a
  **Teachers** table (`/reports/teachers`: taught, paid out, owed, owed all time, the two
  mismatches, last payout), each sorted and paged by the API with its own URL keys (`students*`,
  `teachers*`), stacked lists below `md`, empty states. Rows open the student's or the teacher's
  page; a teacher row has a **Payouts** link to `…/teachers/:id#payouts`. Mismatches are a badge
  with an icon and words. A teacher who left is marked "Former teacher" and linked only for the
  super-admin (gap G21). The reports refetch on every visit (`staleTime: 0`) instead of being
  invalidated by lesson, payment and payout writes. `src/api/reports.ts`, `src/features/finance`.

- **Former students** in the Students table: a student who left the organization (or whose account
  was deleted) is marked "Former student" and linked only for the super-admin
  (`canOpenFormerStudents`), from the reports' new `active` field. `src/api/schema.d.ts`
  regenerated (`npm run api:types`).

### Changed

- `src/api/schema.d.ts` regenerated (`npm run api:types`) after the finance reports (additions only:
  the three `/orgs/{orgId}/reports/*` routes and their rows), typed in `types.ts` as
  `StudentFinanceRow`, `TeacherFinanceRow`, `FinanceSummary` and `FinancePeriod`.
- A student's **Lesson balances** take their labels and hints from `src/features/lessons/lesson-counts.ts`,
  which the Finance tab shares: Prepaid left and Unpaid due are the same numbers under the same
  names in both places. The words did not change.
- The **Payouts** panel has the id `payouts` and scrolls into view once its lessons are in when
  the URL ends in `#payouts` (`payoutsPath`).
- `useListParams` takes an optional `prefix` (`students` → `studentsPage`, `studentsSort`, …) so
  two tables on one page keep apart URL state; `DataTable`'s `rowHref` may return `undefined` for
  a row that opens nothing.
- The third card reads **Paid out to teachers** (was "Paid to teachers"): a teacher payout is "paid
  out", never "paid", as everywhere else in the console.

## Teacher payouts — Unreleased

### Added

- **Teacher payouts** (backend teacher payouts, D-047): a **Payouts** panel on a teacher's page in
  both workspace mounts, for the new `canManageTeacherPayouts` capability (the super-admin and the
  organization's admin). It shows what the organization owes the teacher ("Owed: N lessons", the
  held and late-canceled lessons no payout covers, `GET /orgs/{orgId}/teachers/{teacherId}/payable-lessons`),
  a table of those lessons with checkboxes (50 per page, the selection survives paging, at most 500) and **Pay everything up to…**, which counts the lessons up to the picked day as it changes.
  The **Record payout** sheet takes the day the organization paid (today at the latest) and a note
  (`POST /orgs/{orgId}/teacher-payouts` with `lessonIds`, or `upTo` = the start of the next local
  day); a `409` (paid meanwhile) shows the server's sentence and refreshes the lists. **History**
  (`GET /orgs/{orgId}/teacher-payouts?teacherId=`, latest first, "Show voided") lists each payout's
  day, lessons, note and who recorded it, opens its lessons (`GET /teacher-payouts/{id}`) and voids
  it after a reason and typing `void` (`POST /teacher-payouts/{id}/void`); a voided payout shows
  who voided it and why, and frees its lessons. New `src/api/teacher-payouts.ts` and
  `src/features/teacher-payouts/`. Never the students' payments.
- Lesson detail shows a **Teacher payout** field on organization lessons: "Paid to the teacher on
  <day>" (`Lesson.teacherPayout`), "Not paid out yet" for a held or late-canceled lesson, or why
  the lesson is not paid out.

### Changed

- `src/api/schema.d.ts` regenerated (`npm run api:types`) after the teacher payouts and the teacher
  calendar: `Lesson` gained `teacherPayout` (`LessonTeacherPayout | null`, typed in `types.ts`),
  and some generated operation names moved (`create_2` → `create_3`…); nothing in the console
  refers to them.
- The checkbox shows a dash, not a tick, when it is indeterminate (some rows of a page selected).

## Teacher calendar — Unreleased

### Changed

- The teacher calendar (`GET /teacher/calendar`, `CalendarLessonResponse`) is in `schema.d.ts` but
  not called: it is for teachers only (admins and the super-admin get `403`), and the console keeps
  the lesson ledger and agenda (D-046).

## Lesson length and overlaps — Unreleased

### Breaking

- Lessons have a length and may not overlap (backend scheduling change, D-045): `Lesson` gained
  `durationMinutes` and `seriesId`, `Course` gained `defaultDurationMinutes`, and `POST /lessons` /
  `PATCH /lessons/{id}/schedule` answer `409 SCHEDULE_CONFLICT` when the time overlaps another
  lesson of the teacher or the student (new `ApiErrorCode`). `src/api/schema.d.ts` was regenerated
  (`npm run api:types`).

### Added

- **Lesson length** in **New lesson** and **Reschedule lesson**: a "Length (minutes)" field
  (15–240). In New lesson it follows the chosen course's default (else 60) until edited; in
  Reschedule it starts at the lesson's length and is sent only when it changed.
- **Overlapping lessons are confirmed** (D-045): a `409 SCHEDULE_CONFLICT` opens "This time is
  taken" with **Create anyway** / **Move anyway** / **Schedule anyway**, which sends the same request
  again with `allowOverlap: true`; Cancel goes back to the form as typed.
- **Default lesson length** on courses: a field in the course form (empty = none; emptying a set
  length sends `defaultDurationMinutes: null`) and a row on course detail.
- Lessons show **start–end times**: the ledger's When column and phone rows, the agenda, the lesson
  page title and header, a Length row (plus Series when a weekly series booked it) on lesson
  detail, and the next lesson on student detail (`formatTimeRange`, `formatDateTimeRange`,
  `formatDuration`).

## Optional fields removed with `null` (gap G18) — Unreleased

### Changed

- Rescheduling removes an emptied meeting link (backend `PATCH /lessons/{id}/schedule` now removes
  `meetingUrl` sent as `null`; gap G18 closed for the lesson link): the schedule sheet sends
  `meetingUrl: null` for a link it emptied, still leaves out an untouched one, and its hint no
  longer says the current link is kept. `ScheduleLessonRequest` takes `null` for `meetingUrl`
  (D-044).
- Edit course removes an emptied description or default meeting link (backend
  `PATCH /courses/{id}` now removes a field sent as `null`; gap G18 closed): the sheet sends `null`
  for a field it emptied and leaves out one that was and stays empty, and the link hint no longer
  says the current link is kept. `UpdateCourseRequest` takes `null` for `description` and
  `defaultMeetingUrl` (D-043). The backend also stores a blank description as `null`, on create
  too, so a course created with an empty description now has none instead of `""`.
- Edit homework can remove a due date (backend `PATCH /homework/{id}` now removes a field sent as
  `null`; gap G18 closed for homework): emptying the field, or its new **Clear** button, sends
  `dueAt: null`, and the field is no longer required once set. `UpdateHomeworkRequest` takes `null`
  for `lessonId`, `title`, `notes` and `dueAt` (D-042 update).

## Homework on its own — Unreleased

### Breaking

- Homework stands on its own (backend `POST /homework`, D-041): closing a lesson no longer sends
  `homework` (the API answers `400` if it does), and `LessonDetail.homework[]` is gone. The
  `Homework` type gained `title`, `dueAt`, `completedAt` and the labels `teacherName`,
  `studentName`, `courseTitle`, `lessonScheduledAt`. `src/api/schema.d.ts` was regenerated
  (`npm run api:types`).

### Added

- A **Homework** panel on lesson detail (`GET /homework?lessonId=`) and on student detail
  (`GET /homework?studentId=`, plus `teacherId` in a freelance workspace): open first, then by due
  date, with an Open / Overdue / Done badge, due date, teacher, course, lesson date, progress, notes
  and checklist.
- **Assign homework** (`POST /homework`, new `src/api/homework.ts` and
  `src/features/homework/`): teacher (fixed on a lesson or in a freelance workspace, picked from the
  organization's teachers otherwise), title, notes, due date (sent as the end of that local day),
  course (the student's active enrollments with that teacher, preselected from the lesson) and a
  checklist of at least one line. Gated by the new `canManageHomework` capability.
- **Edit homework** (each Homework row's ⋯ menu, `PATCH /homework/{id}`): the Assign sheet in an
  edit mode for title, notes, due date and checklist lines; the teacher, course and lesson stay as
  assigned. Only what changed is sent, and nothing at all when nothing changed. An emptied title
  clears it; an emptied due date (or **Clear**) removes it with `dueAt: null`. The API
  replaces the whole checklist with new item ids, so it is sent only when its lines changed, and
  then each kept line carries the tick the student has right before saving (`GET /homework/{id}`
  re-read); new lines start open (D-042).
- **Delete homework** (the same menu, `DELETE /homework/{id}`) after a confirmation naming the
  homework, the student and the ticks so far. On either action a `404` explains that the homework
  is gone or out of reach and refreshes the list, and a `403` disables that row's actions with the
  reason. Both follow `canManageHomework` (the panel's `assign` prop is now `manage`).

### Changed

- The close sheet asks for the outcome and the journal only (D-030 updated); the lesson's delete
  confirmation says homework is kept without the link.

## Payments belong to payment managers — Unreleased

### Breaking

- Payments belong to payment managers (backend payment change, D-040): `Lesson.paid` / `paidAt`
  were replaced by `studentPayment: { paid, paidAt, recordedById } | null`, and the balance counts
  of `LessonSummary` are nullable next to the new `toSchedule`. `src/api/schema.d.ts` was
  regenerated from the backend (`npm run api:types`).

### Added

- Org admins run their organization's lessons (D-040): a Lessons tab and sidebar entry at
  `/org/:orgId/lessons`, lesson detail at `/org/:orgId/lessons/:lessonId` with Mark paid / unpaid
  and Add prepaid lessons, and Add prepaid on the student detail. `useLessonPaths()` builds the
  lesson links for each role (no page hard-codes `/platform/lessons` any more).

### Changed

- Payment actions (Mark paid / unpaid, Add prepaid, the use-prepaid box, the Payment filter and
  column) follow the new `canManageStudentPayments` capability; payment display follows the data:
  `PaidBadge`, the Payment / Paid at fields and the balance counts render nothing when the API
  sends `null`, never "unpaid". The balance panels show "To schedule" (`BalanceFields`).

## One role per account — Unreleased

### Breaking

- One role per account (backend contract, gap G20, decision D-036): `User` lost `platformRole`,
  `freelanceTeacher` and `memberships[]` and gained `role` (`SUPER_ADMIN`, `ADMIN`, `TEACHER`,
  `FREELANCE_TEACHER`, `STUDENT` or `null`) and `organization`
  (`{ id, name, slug, status, membershipId }` or `null`). `src/api/schema.d.ts` was edited by
  hand to the contract at first and has been regenerated from the backend since (`npm run api:types`).

### Changed

- Capabilities read `role` / `organization`: the admin organization is the ADMIN membership's when
  that organization is active (an archived organization's admin gets `/no-access`); an admin covers
  the teachers and students of their organization, never another admin; admin accounts,
  memberships and invitations are the super-admin's (disabled with the reason).
- Staff and student details: one **Remove from organization** bound to `organization.membershipId`
  (the 500-row member scan `useUserMemberships` is gone), a Role / Organization field instead of
  "Platform role", "Freelance teacher" and the Memberships panel; remove / delete copy rewritten for
  single-place accounts (removing a student also drops their roster entries and enrollments there).
- Org invites: status filter (pending by default; expired, accepted, all) sent as `?status=`,
  **Resend** through `POST /invites/{id}/resend` (new link, old one stops working) instead of a new
  invitation, **Revoke** for any unused invitation; the overview counts pending invitations.
- `409 ROLE_CONFLICT` and `409 INVITE_PENDING` have fixed sentences in `errorMessage`, used by the
  invite, add-staff, add-student and freelance sheets; same-place `CONFLICT`s keep their sentences.
  Add staff explains an existing account without a role (invite it instead). The add-student hint
  no longer promises reuse. The accept-invite page explains `ROLE_CONFLICT`, a disabled account and
  an inactive organization, and its button reads "Accept invitation".
- API client: `freelance-teachers.ts` (`/freelance-teachers` list / get / create / update / delete)
  replaces `usersApi.createFreelanceTeacher`; `invitesApi.resend`; invite lists take filters.
- The account page shows the one role and organization; `/no-access` tells an archived
  organization's admin to ask for a restore.
- Freelance teachers section (super-admin only, D-037): the list is searched and filtered by
  status on the server (`GET /freelance-teachers?q=&status=`, search debounced by
  `useDebouncedValue`); Add explains `ROLE_CONFLICT` and an account without a role (invite it
  instead); Invite explains `ROLE_CONFLICT` / `INVITE_PENDING` / an existing freelance teacher;
  pending invitations come from `GET /invites?status=PENDING`, 10 per page, with **Resend**
  (`POST /invites/{id}/resend`) and **Revoke** after a confirmation. The teacher's workspace loads
  `GET /freelance-teachers/{id}` (breadcrumb included) and shows a not-found page for any other id.
  The profile edits name and email through `PATCH /freelance-teachers/{id}`, has explicit
  **Disable account** / **Re-enable account** actions (also in the list's row menu) with a
  confirmation, and **Delete freelance teacher** explains the cascade (students deleted and signed
  out, courses archived, lessons, homework and materials kept) and asks for the email.
- e2e `screens.spec.ts` finds a freelance teacher through `GET /freelance-teachers`.
- Error copy is chosen by `code`, never by `message` text (new backend codes for the one-role
  review fixes): `ApiErrorCode` in `src/api/errors.ts` lists every documented code and types `ApiError.is()`.
  `409 ACCOUNT_WITHOUT_ROLE` (add staff, add freelance teacher: an account without a role, invite
  it instead) has its sentence in `errorMessage`; a plain `409 CONFLICT` on add freelance teacher
  now reads "This person is already a freelance teacher." The accept-invite page maps
  `INVITE_PASSWORD_MISMATCH` to the password field ("enter its current password"),
  `INVITE_ACCOUNT_DISABLED` and `INVITE_ORGANIZATION_INACTIVE` to their own sentences, and says an
  existing account accepts with its current password and keeps its name.

### Removed

- The `/org` organization picker (now a redirect home for old links), the top-bar organization
  switcher, the "Choose an organization" sidebar state and their tests.
- Freelance profile: the "Organization memberships" panel and every sentence saying a freelance
  teacher may also teach in organizations; the Status select of the shared edit sheet (replaced by
  the explicit actions); the "no longer marked as a freelance teacher" alert; resending a freelance
  invitation by creating a new one.

### Fixed

- Add student (organization): the course's teacher is sent as roster teacher only while they are
  still a TEACHER of the organization; a removed teacher's course (still active as history) used to
  fail the whole create with `404 Teacher`. The course hint says the student is enrolled without a
  roster teacher. The course select waits for the teacher list.
- Removing or deleting a student from the members table (and deleting a freelance teacher's
  student) refreshes enrollment lists, since the backend drops the student's enrollments.
- Remove-student copy (members table, student detail, README) says every enrollment in the
  organization goes, completed ones included, not only the active ones; `docs/PLAN.md` no longer
  lists the removed `OrgSwitcher`, a memberships panel or the "Freelance" detail row.

### Added

- Tests: one-role capabilities (archived admin, other admins, freelance and role-less accounts,
  invite actions), org invites (status filter, resend, revoke, admin invites read-only, admin role
  for the super-admin only, 409 copy), staff / student removal by membership id, add-staff and
  add-student 409 copy, accept-invite errors, `/org` redirect and archived-admin refusal.
- Tests: freelance teachers (server-side search and status filter, create and invite with their
  `409` copy, edit through the freelance endpoint, disable / re-enable, cascade delete
  confirmation, pending invitations paged with resend and revoke, not-found page for other ids, no
  freelance navigation or requests for an org admin) and `useDebouncedValue`.
- Tests: `409`s by code on add staff (`ACCOUNT_WITHOUT_ROLE`, `ROLE_CONFLICT`, `INVITE_PENDING`, a
  plain `CONFLICT` keeps the server sentence) and add freelance teacher (`ACCOUNT_WITHOUT_ROLE`,
  existing freelance teacher); accept-invite `INVITE_PASSWORD_MISMATCH` on the password field and the
  two other `400` codes; add student without a roster teacher for a removed teacher's course;
  enrollment lists invalidated when a student (not a teacher) is removed.

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
