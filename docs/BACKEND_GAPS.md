# Backend gaps — novis-admin requirements vs. the current Novis API

Verified on 2026-10-16 against `../novis-backend` (commit state of that day) by reading the Java
code, with `API.md` as the contract. **When API.md and the code disagree, the code wins**; the
discrepancies found are listed in [G16](#g16-documentation--code-discrepancies).

Paths below are relative to `novis-backend/api/src/main/java/com/novis/api/`.

**Later the same day** the backend adopted "one role per account" ([G20](#g20-one-role-per-account)):
the notes below that assume several memberships per user, reuse of an existing student across
places or a student → staff conversion through an invite are superseded where they say
"Update (G20)".

Status legend: **open** · **adapted in UI** (option A, with the phase that builds it) ·
**fixed in backend** (option B, with the backend commit) · **deferred**. Decisions taken at the
Phase 0 checkpoint on 2026-10-16 (`docs/DECISIONS.md` D-015).

## Summary

| Gap                                                                         | Requirement                                           | Recommended default                                                                                                                                    | Effort      | Status                                                                                                                       |
| --------------------------------------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------- | ---------------------------------------------------------------------------------------------------------------------------- |
| [G1](#g1-staff-accounts-created-with-a-password)                            | Create admins / teachers with email + password        | **B** — `POST /orgs/{orgId}/staff` + `POST /freelance-teachers`                                                                                        | ½ day       | fixed in backend (`9366a80`)                                                                                                 |
| [G2](#g2-selecting-a-course-for-a-teacher)                                  | Teacher create form takes a course                    | **A** — create a new course for the teacher (or move an existing one, with a warning); needs G1-B to work at creation time                             | UI only     | adapted in UI (phase 2)                                                                                                      |
| [G3](#g3-student-form-fields)                                               | Student create form: email + course                   | **A** — name + email + course, two calls with partial-success handling                                                                                 | UI only     | adapted in UI (phase 2)                                                                                                      |
| [G4](#g4-missing-list-filters)                                              | Org panel lists its own courses / lessons / students  | **B** — `organizationId` / `teacherId` filters on `GET /courses`, `GET /students`, `GET /lessons`                                                      | ½ day       | fixed in backend (`9366a80`)                                                                                                 |
| [G5](#g5-freelance-teachers)                                                | Freelance teachers and their students                 | **B** — `GET /users?freelance=true`, `GET /invites`, `GET /students?teacherId=`, super-admin fix in `POST /students`                                   | 1 day       | fixed in backend (`9366a80`)                                                                                                 |
| [G6](#g6-a-students-courses)                                                | Student detail shows enrolled courses                 | **B** (small) — `GET /students/{id}/enrollments`; A fallback via the Courses tab                                                                       | ½ day       | fixed in backend (`9366a80`)                                                                                                 |
| [G7](#g7-editing-and-deleting-staff)                                        | Edit / delete admins and teachers                     | **A** — name / email / status per the server rules, two delete actions, reset-link action                                                              | UI only     | adapted in UI (phase 2)                                                                                                      |
| [G8](#g8-deleting-students)                                                 | Delete students                                       | **A** — "Remove from this organization" = membership delete; "Delete student account" = `DELETE /students/{id}` with exact copy                        | UI only     | adapted in UI (phase 2)                                                                                                      |
| [G9](#g9-change-any-information-on-lessons)                                 | Change any information on lessons                     | **A** — expose exactly the supported transitions; no override                                                                                          | UI only     | adapted in UI (phase 4)                                                                                                      |
| [G10](#g10-organization-info)                                               | Organization info                                     | **A** — name / slug / status only (B = migration for contact fields, if wanted)                                                                        | ½ day for B | adapted in UI (phase 2)                                                                                                      |
| [G11](#g11-deep-links)                                                      | `/invite/:token`, `/reset-password/:token`            | **A** — keep `APP_BASE_URL` on the Expo app; the console implements both routes too                                                                    | UI only     | adapted in UI (phase 1: both routes built)                                                                                   |
| [G12](#g12-web-session-storage-and-cors)                                    | Token storage, CORS                                   | **A** — access token in memory + refresh token in `localStorage` behind `tokenStore`; **`.env` must add the console origin to `CORS_ALLOWED_ORIGINS`** | config      | adapted (phase 1: `tokenStore`); CORS origin added to backend `.env` and `.env.example`                                      |
| [G13](#g13-no-user-list-or-search)                                          | Find a user by email / list users                     | **B** with G5 — `GET /users` (super-admin)                                                                                                             | with G5     | fixed in backend (`9366a80`)                                                                                                 |
| [G14](#g14-member-rows-carry-no-status-and-sort-only-by-membership-columns) | Member lists                                          | **A** — status on detail only; sort by "joined"                                                                                                        | UI only     | adapted in UI (phase 2)                                                                                                      |
| [G15](#g15-rate-limits-in-development)                                      | e2e against the live API                              | **A** — one login per run                                                                                                                              | tests       | adapted (e2e signs in once)                                                                                                  |
| [G17](#g17-refresh-token-rotation-has-no-reuse-grace-window)                | Reload during a refresh signs the user out everywhere | **B** (small) — accept the previous token for a few seconds after rotation; UI mitigates with a per-tab access token (D-021)                           | ½ day       | open (mitigated in UI)                                                                                                       |
| [G18](#g18-small-shape-gaps-found-while-building-phase-2)                   | Membership ids, clearing optional fields              | **B** (tiny) — add `id` to `MembershipSummary`; accept `null` for `description` / `defaultMeetingUrl` in `PATCH /courses/{id}`                         | hours       | fixed in backend: membership id (G20, `organization.membershipId`); `null` clears on `PATCH` homework, courses, lesson links |
| [G19](#g19-lesson-rows-carry-ids-only)                                      | Ledger rows need N name lookups                       | **B** (small) — add `teacherName`, `studentName`, `courseTitle`, `organizationName` to `LessonResponse`                                                | hours       | open (worked around)                                                                                                         |
| [G20](#g20-one-role-per-account)                                            | One role per account                                  | **B** — `User.role` + `User.organization`, `409 ROLE_CONFLICT` / `INVITE_PENDING`, `/freelance-teachers`, invite `?status=` + resend                   | backend     | adapted in UI (schema hand-edited to the contract; regenerate)                                                               |
| [G21](#g21-a-teacher-who-left-has-no-page-for-the-organizations-admin)      | Pay out the lessons of a teacher who left             | **B** — let the organization's admin read a former teacher's name (e.g. teachers with history next to the members)                                     | ½ day       | open (the super-admin's console reaches them; the Finance tab lists them, D-048)                                             |
| [G16](#g16-documentation--code-discrepancies)                               | Docs ≠ code                                           | record; no action in the console                                                                                                                       | —           | recorded                                                                                                                     |

Everything marked **B** keeps the backend's rules: authorization in the service, roles and
organization derived server-side, cross-tenant ids → 404, tenant isolation and RLS untouched.

---

## G1 Staff accounts created with a password

**Requirement.** Super-admins create admins and teachers inside an organization; org admins
create teachers. The teacher form takes **email, password and a course**.

**What the API offers today.**

- Staff are **invited**, never created: `POST /orgs/{orgId}/invites { email, role: ADMIN | TEACHER }`
  (`invite/InviteController.createOrganizationInvite`, `invite/InviteServiceImpl.createOrganizationInvite`).
  Rules: caller must administer the org (super-admin or `ADMIN`), archived org → `409`, `role: STUDENT`
  → `400`, user already holds the role → `409`. Freelance: `POST /invites { email }` (super-admin only,
  `InviteServiceImpl.createFreelanceTeacherInvite`; already freelance → `409`).
- The invitee sets **name and password** themselves: `POST /auth/accept-invite { token, name, password }`
  (`auth/AuthServiceImpl.acceptInvite` → `InviteServiceImpl.accept`). The raw token travels only by
  email (`invite/InviteMailer`: `${APP_BASE_URL}/invite/{token}`); while `EMAIL_WORKER_URL` is empty
  the email is logged (`infra/email/LoggingEmailSender`). Invites expire after 7 days
  (`novis.security.invite-ttl`).
- Nobody can set another user's password: `PATCH /users/{id}` accepts `password` **only for the user
  themself**, otherwise `400 BAD_REQUEST` (`user/UserServiceImpl.update`).
- An **existing** password account can be attached without an invite:
  `POST /orgs/{orgId}/memberships { userId, role }` (`membership/MembershipServiceImpl.add`;
  staff roles need a password account → `400`, duplicate → `409`). But there is no way to find a
  `userId` by email (see G13).
- `GET /orgs/{orgId}/invites` returns used invites too (`usedAt` set); "pending" must be derived
  client-side as `usedAt == null && expiresAt > now`. There is no resend; "resend" = create a new invite.

**Option A — adapt the UI.** The create form becomes _Invite admin_ / _Invite teacher_: email (+ role).
No password field, no name field; copy says "They will receive an email to choose a name and
password". A pending-invites list offers revoke (`DELETE /invites/{id}`) and resend (new invite).
Consequence: the teacher has no account until they accept, so no course can be assigned at
creation time (G2) and the stated requirement (email + password) is not met.

**Option B — extend the backend.** New endpoints, same authorization as invites:

- `POST /orgs/{orgId}/staff { email, name, password, role: ADMIN | TEACHER }` → `201 Member`
- `POST /freelance-teachers { email, name, password }` → `201 User` (super-admin only)

Service rules: `requireOrgAdmin` / `requireSuperAdmin`; organization must be active (`409`);
email must be free (`409` — a student account with that email is **not** upgraded here, the
invite flow already covers that case); creates `UserEntity.passwordAccount(...)`, the membership
(or `markFreelanceTeacher(true)`); `@UserScopeOnly` / `@SuperAdminOnly`. No migration needed.
Tests: service unit (forbidden, cross-tenant 404, archived 409, duplicate 409), controller slice,
extend `OnboardingFlowIT`. Update `API.md`, `README.md`, `CHANGELOG.md`, `CLAUDE.md`.

**Recommendation: B.** It is the only way to meet the requirement and it unlocks G2 (the teacher id
exists immediately). The invite flow stays available as a secondary "Invite by email" action.

**Effort.** ~½ day including tests and docs.

**Update (G20).** Any live account with the email is now `409`: `ROLE_CONFLICT` when it holds a
role elsewhere or is a student account, `ACCOUNT_WITHOUT_ROLE` when it is a password account without
a role (invite it instead: it accepts with its current password and keeps its name); a usable
invitation for the email is `INVITE_PENDING`. Student accounts are never turned into
staff any more. ADMIN staff and invites are the super-admin's only. Invite lists take
`?status=PENDING|USED|EXPIRED`; `POST /invites/{id}/resend` rotates the link and the expiry; a new
invite for the same email, place and role replaces the pending one, and one for another place is
`409 INVITE_PENDING`.

**Security.** The creating admin knows the initial password. Mitigations: the console shows a
"Send password reset link" action (public `POST /auth/forgot-password`), the account owner can
change the password (`PATCH /users/{id}` self), and the endpoint is authenticated and
tenant-scoped like invites. No weakening of "server derives role and organization": role comes
from the body but is validated against the caller's authority exactly as `POST /orgs/{orgId}/invites`
does today, and the organization comes from the path.

---

## G2 Selecting a course for a teacher

**Requirement.** The teacher create form includes "a course of that organization".

**What the API offers today.**

- A course has exactly one owner: `CourseEntity.teacherId` is required
  (`course/CourseEntity`, migration `V1` `courses.teacher_id not null`).
- Create for a teacher: `POST /courses { title, description?, organizationId?, teacherId?, defaultMeetingUrl? }`
  (`course/CourseServiceImpl.create`): naming another teacher needs `ADMIN` in the resolved org
  (`403`), the teacher must be an active password account (`400`) holding `TEACHER` in that org
  (`400`), the org must be active (`404`).
- Reassign: `PATCH /courses/{id} { teacherId }` (`CourseServiceImpl.reassign`): org course → org admin
  or super-admin; freelance course → super-admin only; **the course leaves its current teacher**.
- There is no "shared course": two teachers teaching "Piano" are two course rows.

**Domain answer.** A course is _one teacher's class_. Two teachers in one organization cannot teach
the same course row; each owns their own. The console models it that way (course lists are grouped
or filterable by teacher; the detail shows the owner as a link).

**Option A — adapt the UI.** The "Course" field of the teacher form offers:

1. **Create a new course for this teacher** (default): title → `POST /courses { title, teacherId, organizationId }`
   right after the account exists.
2. **Move an existing course** (secondary): pick a course of the organization →
   `PATCH /courses/{id} { teacherId }`, with the warning "This moves _Piano — beginners_ away from
   _Ana Pop_".
   Both are the second step of a multi-step create with partial-success handling and a retry.
   With G1-A (invites) the step cannot run at creation time; the form then says "You can assign a
   course once they accept the invite" and the action lives on the teacher detail page.

**Option B.** Not needed; the API already supports both paths.

**Recommendation: A**, relying on G1-B so the step runs immediately.

**Effort.** UI only.

**Security.** None beyond existing rules.

---

## G3 Student form fields

**Requirement.** Student create form takes **an email and a course**.

**What the API offers today.**

- `POST /students { name, email, organizationId?, teacherId? }` — `name` is `@NotBlank`
  (`student/dto/CreateStudentRequest`). For the super-admin (and multi-org admins) `organizationId`
  is **required** (`student/StudentServiceImpl.resolveOrganization` → `400 "organizationId is required"`);
  the org must be active (`404`). Email of an existing **student** → the account is reused and the
  membership added; email of a **staff** account → `409 "That email belongs to a staff account"`.
  Admins may roster the student under `teacherId` (teacher must hold `TEACHER` in the org, `400`).
- Course selection is a second call: `POST /courses/{courseId}/enrollments { studentId }`
  (`enrollment/EnrollmentServiceImpl.enroll`): the student must hold `STUDENT` in the course's
  organization (`404` otherwise — satisfied by the create call), already enrolled → `409`.

**Option A — adapt the UI.** Form = **name, email, course** (name is mandatory because the API
requires it). Submit runs: (1) `POST /students { name, email, organizationId, teacherId: course.teacherId }`,
(2) `POST /courses/{courseId}/enrollments { studentId }`. If (2) fails the sheet shows
"Student created. Enrollment in _Piano — beginners_ failed: <message>" with **Retry enrollment** and
**Skip**; a `409 already enrolled` on retry counts as success. Passing `teacherId` also puts the
student on the course teacher's roster, so the teacher sees them in the mobile app immediately
and lessons without a course resolve their organization from the roster row.

**Option B.** A combined `POST /students { …, courseId }` would save one round trip; not worth it.

**Recommendation: A.**

**Update (G20).** An existing student email is linked only when the student is already in the same
place (a STUDENT of this organization, or on this freelance teacher's roster) or has no place at
all; any other existing account is `409 ROLE_CONFLICT`, and a usable invitation for the email is
`409 INVITE_PENDING`. The form's hint says so instead of promising reuse.

---

## G4 Missing list filters

**Requirement.** An organization panel lists _this organization's_ admins, teachers, students,
courses and lessons; the super-admin's lists must not fetch the whole platform.

**What the API offers today.**

- `GET /students` takes only paging (`student/StudentController.list`); the super-admin gets **every
  student on the platform** (`UserDao.findAllStudents`), admins their orgs' students.
- `GET /courses` takes only paging (`course/CourseController.list`); super-admin → `courseDao.findAll`.
- `GET /lessons` filters: `studentId, teacherId, courseId, status, paid, from, to, unscheduled`
  (`lesson/LessonFilter`, `LessonQueriesImpl.predicates`) — **no `organizationId`**.
- Workaround for people: `GET /orgs/{orgId}/members?role=ADMIN|TEACHER|STUDENT`
  (`membership/MembershipController.listMembers`) — see G14 for its limits. No workaround for courses
  or lessons other than paging through everything (`size ≤ 100`) and filtering by `organizationId`
  client-side, or one `GET /lessons?teacherId=` call per teacher of the org.

**Option A — adapt the UI.** People from the members endpoint; courses and lessons by client-side
filtering of full pages (`size=100`, loop until `last`), with a visible "Loaded all N" note. Works for
the pilot scale (a handful of schools), degrades linearly after.

**Option B — extend the backend** (recommended):

- `GET /courses?organizationId=&teacherId=` — new `CourseDao` queries applied **after** the visibility
  predicate (admins asking for a foreign org simply get an empty page).
- `GET /students?organizationId=&teacherId=` — `teacherId` reuses `UserDao.findStudentsVisibleTo(teacherId, NONE)`
  (roster + enrolled); `organizationId` adds a membership predicate; same visibility-first rule.
- `GET /lessons?organizationId=` — one field in `LessonFilter`, one predicate in `LessonQueriesImpl`.
  Tests: DAO slice for the new queries, service unit for "filter never widens visibility", extend
  `TenantIsolationIT`. Docs: API.md §7–§9 filter tables.

**Recommendation: B.** Small change, removes an O(platform) hotspot from every org page.

**Effort.** ~½ day.

**Security.** Filters only narrow results that the caller may already see; cross-tenant ids yield
empty pages, never data. No RLS change.

---

## G5 Freelance teachers

**Requirement.** Super-admin creates, edits, deletes freelance teachers and their students, and sees
every field.

**What the API offers today.**

- **No endpoint lists freelance teachers** (or any users): `user/UserController` has only `GET /users/me`,
  `GET /users/{id}`, `PATCH`, `DELETE`; `UserDao` has no freelance query.
- **No endpoint lists pending freelance invites**: `InviteDao.findByOrganizationIdIsNull(Pageable)`
  exists but no controller route uses it; `GET /orgs/{orgId}/invites` is org-only.
- **No way to list a freelance teacher's students as super-admin**: `GET /teacher/students` is caller-only
  (`roster/RosterServiceImpl.listMyStudents` uses `caller.id()`); `GET /students` has no `teacherId`
  filter (G4).
- **The super-admin cannot create a freelance student**: `POST /students { name, email, teacherId }`
  without `organizationId` → `400 "organizationId is required"` (`StudentServiceImpl.resolveOrganization`
  only infers "no organization" for a caller who _is_ a freelance teacher). Sending a freelance
  teacher's id does not help because the scope is resolved before the teacher is looked at.
- What **does** work for the super-admin: inviting (`POST /invites`), `GET /users/{id}` for a known id,
  `POST /courses { title, teacherId }` for a freelance teacher (organization inferred as none,
  `CourseServiceImpl.resolveOrganization`), lessons and prepaid credits for freelance pairs
  (`lesson/LessonPartiesResolver` allows the super-admin and derives the null organization).

**Option A — adapt the UI.** Not viable for the lists: without a list endpoint the Freelance section
would be "Invite a freelance teacher" plus "paste a user id". Freelance students could not be
created from the console at all.

**Option B — extend the backend** (recommended):

1. `GET /users?freelance=true&q=` (super-admin only) → `Page<User>`; `q` matches name / email
   (case-insensitive). Also closes G13.
2. `GET /invites` (super-admin only) → pending freelance invites via the existing
   `InviteDao.findByOrganizationIdIsNull`.
3. `GET /students?teacherId=` (shared with G4-B): super-admin, or an admin of an org the teacher
   teaches in, gets the teacher's roster + enrolled students.
4. `POST /students`: when the caller is the super-admin, `organizationId` is omitted and `teacherId`
   is given, derive the scope from the teacher — freelance teacher → no organization; teacher of
   exactly one organization → that organization; otherwise keep `400`.
   Tests: unit for each authorization branch (admin → 403 on `GET /users`, cross-tenant → empty),
   extend `TeacherRosterIT` / `OnboardingFlowIT`.

**Recommendation: B.** Without it the Freelance section cannot exist.

**Effort.** ~1 day with tests and docs.

**Update (G20).** A teacher teaches in exactly one place, so item 4's "otherwise keep `400`" is
gone, and an org admin naming a teacher outside their organization gets `404`. Freelance
management moves to the super-admin-only `/freelance-teachers` (list with `q` / `status`, create,
get, patch, delete with cascade).

**Security.** All new reads are super-admin only (or admin-of-the-teacher's-org for item 3) and
return existing DTOs. Item 4 only lets the super-admin do what a freelance teacher can already do
for themself; the roster row still records the derived scope.

---

## G6 A student's courses

**Requirement.** The student detail page shows "enrolled in".

**What the API offers today.** Enrollments are listed per course only:
`GET /courses/{courseId}/enrollments` (`enrollment/EnrollmentController`). `EnrollmentDao.findByStudentId`
exists (used by delete flows) but no endpoint exposes it. `GET /me/dashboard` returns a student's
courses but only for the student's own token.

**Option A.** Student detail → "Courses" section computed from the organization's courses
(G4 filter) plus one `GET /courses/{id}/enrollments` per course, loaded lazily on open. O(courses)
requests; fine for small schools. Enrollment management (enrol / unenrol) lives on the course detail
page, which works today.

**Option B.** `GET /students/{id}/enrollments` → `Page<{ enrollment, course: { id, title, teacherId, organizationId, status } }>`,
authorization = student visible to the caller (`LessonAccess.requireStudentVisible` pattern) and
courses restricted to those the caller manages (`CourseAccess.canManage`).

**Recommendation: B** (small, and it makes "remove from organization" in G8 precise). Ship A if B is
declined.

**Effort.** ~½ day.

**Security.** Read-only; same visibility rules as the course endpoints.

---

## G7 Editing and deleting staff

**Requirement.** Edit and delete admins and teachers; see id and every field.

**What the API offers today** (`user/UserServiceImpl`):

- Visibility (`GET /users/{id}`): self, super-admin, an admin sharing an organization with the user,
  or the teacher of that student; otherwise `404`.
- `PATCH /users/{id}`: the caller must be self, super-admin, or an admin whose organizations cover
  **all** of the user's memberships (`403 "You may not modify this user"`). Then per field:
  `name` → anyone allowed to modify; `email` → self or super-admin (`403`); `status` → super-admin only
  (`403`); `password` → self only on a password account, otherwise **`400 BAD_REQUEST`** (API.md says
  "self only" without the status code).
- `DELETE /users/{id}`: never self (`403`), super-admin or covering admin (`403`), never the super-admin
  account (`403`). Soft-deletes and detaches everywhere (memberships, roster rows as teacher and as
  student, enrollments dropped, sessions revoked); lessons and payments stay.
- `DELETE /memberships/{id}`: admin of that organization (`404` otherwise); an admin cannot remove
  **their own ADMIN** membership (`403`). A user holding ADMIN _and_ TEACHER has two memberships.
- Password help without a backend change: `POST /auth/forgot-password { email }` (public, throttled,
  generic response, only acts on active password accounts).
- Listing: `GET /orgs/{orgId}/members?role=` rows have `membershipId, userId, organizationId, email, name, role, createdAt`
  (no `status`, see G14). Detail uses `GET /users/{id}` (memberships included).

**Option A — adapt the UI.**

- Edit sheet: **name** (everyone who may edit), **email** and **status** only when the capability says
  so (super-admin). An admin who gets `403` on a teacher with memberships elsewhere sees "This teacher
  also belongs to another organization; only the platform owner can edit their account".
- Two clearly separated actions: **Remove from this organization** (`DELETE /memberships/{id}`, per
  role) and **Delete account** (`DELETE /users/{id}`, danger zone, super-admin or covering admin;
  disabled with the reason for self and for the super-admin account). Copy states what each does.
- **Send password reset link** → `POST /auth/forgot-password`; toast "If that account exists, a reset
  email has been sent" (in dev: "the link is in the API log").

**Option B.** Admin-set passwords (`PATCH /users/{id} { password }` by admins) — not recommended; the
reset link covers the need without an admin ever knowing a password.

**Recommendation: A.**

**Update (G20).** One membership per user: the detail page has a single **Remove from
organization** (`organization.membershipId`), which leaves the account without a role (it can be
invited or added elsewhere later). An admin covers the teachers and students of their organization
only; another admin's account, membership or invitation is the super-admin's (`403`, disabled with
the reason in the console). Freelance teachers and accounts without a role are `404` to admins.
Disabling an account revokes its refresh tokens.

---

## G8 Deleting students

**Requirement.** Delete students from an organization panel.

**What the API offers today** (`student/StudentServiceImpl.delete`):

- **Super-admin:** detaches the student from **everything** (all memberships, all roster rows, all
  enrollments dropped) and therefore **always soft-deletes the account** and revokes its sessions —
  even if the student belongs to other organizations or freelance teachers.
- **Admin:** detaches from everything the caller controls: own roster row and own courses (as a
  teacher) **plus all administered organizations** (STUDENT memberships, roster rows, enrollments in
  those orgs' courses) — not just the organization currently open; the account is soft-deleted only
  if no link remains anywhere.
- `DELETE /memberships/{id}` on a STUDENT membership removes only that membership. Enrollments in
  the organization's courses and roster rows in that organization **stay** (no cascade); the student
  loses access to the org's courses anyway (`CourseAccess.canRead` requires membership; RLS agrees),
  and lessons stay as history.

**Option A — adapt the UI.**

- Org panel row action **Remove from this organization** = `DELETE /memberships/{membershipId}` (from
  the members list). Confirm text: "Removes _Ana_ from _Riverside_. Enrollments in Riverside's courses
  stay on record; lessons are kept as history. Her account and other organizations are not affected."
  With G6-B the dialog can also offer "and unenrol from N Riverside courses" (one `DELETE
/courses/{c}/enrollments/{studentId}` each).
- Danger zone **Delete student account** = `DELETE /students/{id}`. Copy for the super-admin: "Deletes
  the account everywhere and removes every membership, roster entry and enrollment. Lessons and
  payments are kept." Copy for an admin: "Removes _Ana_ from every organization you administer; the
  account is deleted only if nothing else links to it."

**Option B.** `DELETE /orgs/{orgId}/students/{id}` — detach within one organization (membership,
roster rows, enrollments of that org) in one call. Nice to have.

**Recommendation: A** (B optional later).

**Update (G20).** A student belongs to one organization or one freelance teacher. Removing a
STUDENT membership now also deletes that organization's roster rows and drops all the student's
enrollments in its courses (completed ones included) (option B's effect, through `DELETE /memberships/{id}`); the account
stays without a place. An admin's `DELETE /students/{id}` therefore leaves no link and deletes the
account. The console copy says exactly that.

---

## G9 "Change any information" on lessons

**Requirement.** Super-admin can change any information about a lesson.

**What the API offers today** (`lesson/LessonServiceImpl`, invariants in `lesson/LessonEntity`):

| Action                                                  | Endpoint                                        | Allowed when                                                                         | Otherwise                                           |
| ------------------------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------ | --------------------------------------------------- |
| Create                                                  | `POST /lessons`                                 | parties valid (`LessonPartiesResolver`)                                              | `400` / `404` / `403`                               |
| Schedule / reschedule / unschedule, change meeting link | `PATCH /lessons/{id}/schedule`                  | `PENDING`                                                                            | `409`                                               |
| Close                                                   | `POST /lessons/{id}/close`                      | `PENDING` **and** `scheduledAt != null`; status ∈ `PRESENT, CANCELED, CANCELED_LATE` | `409` / `400`                                       |
| Edit journal                                            | `PATCH /lessons/{id}/journal`                   | closed (not `PENDING`)                                                               | `409`                                               |
| Mark paid / unpaid                                      | `PATCH /lessons/{id}/payment`                   | any state; payment managers only (org admin, super-admin)                            | `403` for the lesson's org teacher                  |
| Delete                                                  | `DELETE /lessons/{id}`                          | `PENDING` **and** unpaid                                                             | `409 "Only pending, unpaid lessons can be deleted"` |
| Prepaid credits                                         | `POST /students/{id}/lessons/prepaid`           | parties valid, `count` 1–50; payment managers only                                   | `400` / `403`                                       |
| Balances                                                | `GET /students/{id}/lessons/summary?teacherId=` | student visible; payment counts `null` for non-managers, `toSchedule` always         | `404`                                               |

Since the backend's payment change (D-040) only payment managers record or see a student's
payment; the console's users (the super-admin and org admins) always are, and display still
follows the data (`studentPayment: null` shows nothing).

Not supported: changing a lesson's **teacher, student or course** (the course changes only implicitly
when a generic credit is consumed), **reopening** or changing the status of a closed lesson,
**deleting** a closed or paid lesson, editing the date or meeting link after closing. The CHANGELOG
lists "reopening closed lessons" as deliberately deferred.

**Option A — adapt the UI.** The lesson detail shows exactly the supported actions, each enabled by a
pure predicate of the lesson state with the reason shown when disabled ("Closed lessons cannot be
deleted — mark it unpaid or edit the journal instead"). "Change teacher / student / course" is
explained as "delete this pending lesson and create a new one" (offered as a shortcut when deletable).

**Option B — super-admin override.** `PATCH /lessons/{id}` (parties, date, status) and
`POST /lessons/{id}/reopen`. Contradicts the ledger invariants (closed lessons are history, credits
were consumed or rolled over) and needs compensating logic for credits and rollovers.

**Recommendation: A.** Revisit B only with a concrete operational need.

**Effort.** UI only (B: 1–2 days with invariants and tests).

**Security / integrity.** A keeps the ledger consistent; B would allow rewriting financial history.

---

## G10 Organization info

**Requirement.** Create, edit, delete organizations "and their info"; see every field.

**What the API offers today.** `organizations` has `name` (≤ 200), `slug` (2–100, `^[a-z0-9]+(?:-[a-z0-9]+)*$`,
unique → `409`), `status` (`ACTIVE | ARCHIVED`), `createdAt`, `updatedAt` (`organization/OrganizationEntity`,
`dto/*`). `DELETE /orgs/{id}` **archives** (`OrganizationServiceImpl.delete` → `archive()`, idempotent,
super-admin). Restore = `PATCH /orgs/{id} { status: ACTIVE }` (super-admin only, `403` for admins).
No hard delete. Effects of archiving: memberships grant nothing at the API and RLS layers (`V4`),
invites and memberships into it → `409`, creating students / courses in it → `404`.

**Option A.** Show and edit exactly these fields; "Archive organization" requires typing the slug;
"Restore organization" on archived ones; the detail explains the consequences.

**Option B.** Migration `V7__organization_contact_info.sql` adding `contact_email`, `phone`,
`address`, `notes` (nullable) + DTO/mapper fields. ~½ day. No security impact.

**Recommendation: A** now; B only if you want those fields — say so at the checkpoint.

---

## G11 Deep links

**Requirement.** The console implements `/invite/:token` and `/reset-password/:token`.

**What the API offers today.** Links are built from one base URL for every role:
`invite/InviteMailer` → `${baseUrl}/invite/{token}`, `auth/AuthMailer` → `${baseUrl}/reset-password/{token}`,
`baseUrl = novis.app.base-url = ${APP_BASE_URL:http://localhost:8081}` (`config/AppProperties`,
`application.yml`). The dev `.env` does not set it, so links point to **`http://localhost:8081`** =
the Expo web app (`../novis-mobile`), which already implements both routes
(`src/app/invite/[token].tsx`, `src/app/reset-password/[token].tsx`). Production passes
`APP_BASE_URL` through `docker-compose.prod.yml`.

**Option A.** Keep `APP_BASE_URL` on the Expo app (teachers are most invitees; reset links work for
everyone there). The console still implements both routes, so the super-admin can paste a dev token
into either app and production can switch later. After accepting an invite in the console, a user
without an admin role lands on `/no-access` with "Open the Novis app".

**Option B.** `ADMIN_APP_BASE_URL` used by `InviteMailer` for `ADMIN` invites (reset links keep the
shared base URL because the mailer cannot know which app the user prefers). ~1 hour.

**Recommendation: A** now; B when the console has a production URL.

---

## G12 Web session storage and CORS

**Requirement.** A static SPA must store tokens somewhere; the API must accept its origin.

**What the API offers today.**

- Bearer tokens only; the API never sets cookies (`config/CorsConfig`: `allowCredentials(false)`;
  `API.md §1.1`). Access token ≈ 15 min, refresh token 90 days sliding and **rotating**; reuse of a
  rotated token revokes every session of the user (`401 INVALID_REFRESH_TOKEN`); disabled accounts
  → `401 ACCOUNT_UNAVAILABLE` (`security/filter/JwtAuthenticationFilter`).
- CORS origins = `CORS_ALLOWED_ORIGINS`, default **`http://localhost:8081` only** (`application.yml`);
  the dev `.env` does not override it, so the console's dev origin `http://localhost:5173` is
  **rejected at preflight today**. Allowed headers: `Authorization, Content-Type, Accept`.

**Option A.** `tokenStore` module: access token in memory, refresh token in `localStorage`; on load the
app silently refreshes to get an access token; sign-out revokes (`POST /auth/logout`) and clears.
Trade-off: a successful XSS could read the refresh token. Mitigations: no third-party scripts, a
strict CSP in `index.html`, React's default escaping, the server's reuse detection, and the
`tokenStore` seam so a BFF can replace it later.

**Option B.** A small BFF that holds the refresh token in an `HttpOnly` cookie. Out of scope.

**Recommendation: A.** **Required config change (not code):** add the console origin to the backend
`.env`: `CORS_ALLOWED_ORIGINS=http://localhost:8081,http://localhost:5173` (and the production origin
in the server `.env`). Approve at the checkpoint and I will make the one-line edit, or make it yourself.

---

## G13 No user list or search

**Found during verification.** There is no `GET /users`; the only user reads are `/users/me` and
`/users/{id}`. Consequences: "Add an existing user as admin / teacher" (`POST /orgs/{orgId}/memberships`)
cannot find the `userId`; freelance teachers cannot be listed (G5); the command palette cannot
search people. **Recommendation: B with G5** — `GET /users?q=&freelance=&platformRole=` for the
super-admin (admins keep using the members endpoint).

## G14 Member rows carry no `status` and sort only by membership columns

**Found during verification.** `MemberResponse` has no `status`; `GET /orgs/{orgId}/members` pages
`MembershipEntity`, so `sort` accepts `createdAt` / `role` only (not `name` / `email`).
**Adapt in UI:** lists sort by "joined"; disabled accounts are shown on the detail page
(`GET /users/{id}`) and marked in lists only after the detail was fetched. Optional B: add `status`
to `MemberResponse` (a few lines, no migration).

## G15 Rate limits in development

`POST /auth/login` and `/auth/forgot-password` are throttled 30/min per IP and **5/min per email**
(`auth/ratelimit/Bucket4jLoginRateLimiter`). The Playwright smoke suite logs in **once per run** and
reuses the tokens; unit tests use MSW.

## G16 Documentation ≠ code discrepancies

Recorded for the backend maintainers; none blocks the console.

| Where                                          | Docs say                                                                          | Code does                                                                                                                                                                                                                               |
| ---------------------------------------------- | --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `API.md §4` `POST /auth/student-login`         | `401 INVALID_CREDENTIALS`                                                         | `401 STUDENT_LOGIN_FAILED` (`AuthServiceImpl.studentLogin`)                                                                                                                                                                             |
| `API.md §5` `PATCH /users/{id}` `password`     | "self only"                                                                       | non-self → **`400 BAD_REQUEST`**, not `403` (`UserServiceImpl.update`)                                                                                                                                                                  |
| `API.md §7` `POST /students`                   | `organizationId` optional for freelance / single-org callers                      | correct, but the super-admin can never omit it, even with a freelance `teacherId` (G5)                                                                                                                                                  |
| `architecture.md` → Authentication → Endpoints | `POST /orgs/{orgId}/invite`, `POST /teacher/students/invite`, `POST /auth/invite` | stale design table; real routes are `API.md §6`                                                                                                                                                                                         |
| OpenAPI (`/v3/api-docs`)                       | —                                                                                 | no `ApiError` schema; nullable fields are not marked (`T?` in API.md is plain `T`); `Pageable` is Spring's object, not the `page/size/sort` query params. The generated types get a hand-written nullable overlay (see `docs/PLAN.md`). |

## G17 Refresh-token rotation has no reuse grace window

**Found during the Phase 1 visual review.** `auth/token/DefaultRefreshTokenService.rotate` revokes
**every** session of the user as soon as a rotated refresh token is presented again (API.md §1.2,
by design against theft). A browser that reloads while `POST /auth/refresh` is in flight receives
no response, keeps the old token, and its next load reuses it — the user is signed out everywhere.
With the access token in memory only this happened on the second quick reload.

**Option A (done, D-021).** Mirror the access token per tab in `sessionStorage`, so reloads do not
refresh at all; refreshes happen only when the access token expires (~15 min) or in a new tab.

**Option B.** Keep the last rotated token valid for a short grace window (e.g. 10 s) and answer a
reuse inside that window with the **same** new pair instead of revoking (common practice for SPAs);
reuse outside the window keeps revoking everything. Service change plus a column or an in-memory
cache; tests for both branches.

**Recommendation.** A now; B when the console goes to production. **Status: open (mitigated in UI).**

## G18 Small shape gaps found while building Phase 2

- ~~`User.memberships[]` (`MembershipSummary`) carries no membership **id**, so "remove from this
  organization" on a detail page must find the id by scanning `GET /orgs/{orgId}/members`
  (`useUserMemberships`, up to 500 rows).~~ **Fixed with G20:** `User.organization.membershipId`;
  the scan is gone.
- ~~`PATCH /courses/{id}` cannot **clear** `description` or `defaultMeetingUrl` (omitted = unchanged;
  an empty string fails `@AbsoluteHttpsUrl`). The edit form keeps the current link when the field is
  emptied and says so.~~ **Fixed in the backend:** an explicit `null` removes `description` or
  `defaultMeetingUrl` (an omitted field stays; `title`, `status` or `teacherId` sent as `null` is a
  `400`), and a blank description is stored as `null`, on create too. The edit sheet sends `null`
  for a field it emptied (D-043).
- `Member` rows carry no `status` (see G14).
- ~~`PATCH /homework/{id}` cannot **remove** `dueAt` or unlink `lessonId` (`null` = omitted =
  unchanged), and blank `notes` are stored as `""`.~~ **Fixed in the backend:** an explicit `null`
  removes `lessonId`, `title`, `notes` or `dueAt` (an omitted field stays), blank notes are stored
  as `null`. The edit sheet removes an emptied due date with `dueAt: null` (D-042).
- ~~`PATCH /lessons/{id}/schedule` cannot **remove** `meetingUrl` (`null` = omitted = unchanged).
  The schedule sheet keeps the current link when the field is emptied and says so.~~ **Fixed in the
  backend:** an explicit `meetingUrl: null` removes the lesson's link (an omitted one stays;
  `scheduledAt` is unchanged, `null` or omitted unschedules). The schedule sheet sends `null` for a
  link it emptied (D-044).

**Status: fixed in backend (membership id with G20; homework, course and lesson-link fields). The
`Member` status stays with G14.**

## G19 Lesson rows carry ids only

**Found during Phase 4.** `LessonResponse` has `teacherId`, `studentId`, `courseId` and
`organizationId` but no names, so a ledger page of 20 rows needs one `GET /users/{id}`,
`GET /students/{id}`, `GET /courses/{id}` and `GET /orgs/{id}` per distinct id before it reads as
"Ana with Maria · Piano". The console does this client-side (`useLessonNames`, one cached query
per distinct id, D-028) and shows short ids while loading.

**Option A (done).** Resolve names in the console. **Option B.** Add `teacherName`,
`studentName`, `courseTitle` and `organizationName` to `LessonResponse` (a join in
`LessonQueriesImpl`, mapper change, no migration). **Status: open (worked around in the UI).** The
teacher calendar (`GET /teacher/calendar`, 2026-10-24) returns `studentName` and `courseTitle` per
row, but to teachers only, so it does not help the console (D-046).

## G20 One role per account

**Backend change (contract "one user = one role in one place", 2026-10-16).** Every account holds
one role in one place: the super-admin (platform only), an ADMIN or TEACHER of exactly one
organization, a freelance teacher (never in an organization) or a student of exactly one
organization or one freelance teacher. Removing a membership leaves an account without a role,
which may later be invited or added elsewhere; there is no path from freelance teacher to an
organization and no student → staff conversion.

- `User` drops `platformRole`, `freelanceTeacher` and `memberships[]` for
  `role: SUPER_ADMIN | ADMIN | TEACHER | FREELANCE_TEACHER | STUDENT | null` and
  `organization: { id, name, slug, status, membershipId } | null` (present even when the
  organization is archived).
- New `409` codes: `ROLE_CONFLICT` (the email or account has a role elsewhere, or is the wrong kind
  of account) and `INVITE_PENDING` (a usable invitation exists for another place or role); same-place
  duplicates stay `CONFLICT`. Review fixes added `409 ACCOUNT_WITHOUT_ROLE` (direct create of staff
  or a freelance teacher for an account without a role) and three accept-invite `400`s:
  `INVITE_PASSWORD_MISMATCH` (an existing account must enter its current password),
  `INVITE_ACCOUNT_DISABLED`, `INVITE_ORGANIZATION_INACTIVE`.
- Admin accounts (create, invite, add, remove, edit, delete) and freelance teachers are managed by
  the super-admin only.
- New endpoints: `GET/POST /freelance-teachers`, `GET/PATCH/DELETE /freelance-teachers/{id}`,
  `POST /invites/{id}/resend`; `?status=PENDING|USED|EXPIRED` on `GET /orgs/{orgId}/invites` and
  `GET /invites`.

**Console (D-036).** Capabilities read `role` / `organization` (the admin organization is the
ADMIN membership's when that organization is active; otherwise `/no-access`); the `/org` picker and
the switcher are gone; detail pages remove the one membership by `organization.membershipId`; org
screens show nothing freelance; org invites filter by status (pending by default), resend and
revoke; `ROLE_CONFLICT` / `INVITE_PENDING` / `ACCOUNT_WITHOUT_ROLE` have fixed sentences
(`src/api/errors.ts`, chosen by code, never by message text), and the accept-invite page maps its
codes (the current-password mismatch onto the password field). The super-admin's Freelance section (D-037) runs on
`/freelance-teachers` (server-side `q` / `status`, create, edit, disable / re-enable, cascade
delete, a not-found page for non-freelance ids) and lists pending freelance invitations with
`GET /invites?status=PENDING`, resending through `POST /invites/{id}/resend`.

**Schema.** `src/api/schema.d.ts` was edited **by hand** to the contract while the backend was
being changed in parallel. Regenerate it with `npm run api:types` against the updated backend and
fix any drift in `src/api/types.ts` first (operation ids of the new routes will differ).

**Status: adapted in UI.**

## G21 A teacher who left has no page for the organization's admin

**Found while building teacher payouts (D-047).** The API keeps the history of a teacher who left
an organization payable there: its admin lists their payable lessons and records payouts naming
their `teacherId`. The console reaches a teacher through the Teachers tab and `GET /users/{id}`,
which answers `404` to an org admin once the membership is gone (the account is out of their reach),
so the Payouts panel of a former teacher only opens for the super-admin
(`/platform/orgs/:orgId/teachers/:userId`).

**Option B.** Let the organization's admin read the name of a teacher who has lessons there (for
example former teachers listed next to the members, or `GET /orgs/{orgId}/teacher-payouts` without
`teacherId` plus a list of teachers owed).

**Update (D-048).** The finance reports now list every teacher with lessons in the organization,
a teacher who left included (`active: false`, with their name and what is owed to them), so the
admin sees them on the Finance tab. Their page, and so their Payouts panel, still answers `404` to
the org admin: the tab marks them "Former teacher" and does not link them. **Status: open.**
