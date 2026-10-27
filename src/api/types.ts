/**
 * Domain types for the console, derived from the generated OpenAPI schema (`schema.d.ts`,
 * `npm run api:types`) with two corrections the spec cannot express (decision D-005):
 *
 * 1. springdoc emits no `required` lists, so every generated field is optional. The API always
 *    sends every field (API.md §1.4), so responses are made strict here.
 * 2. The spec does not mark nullability; `Nullable<T, K>` re-adds `| null` to the fields API.md
 *    marks `?`.
 *
 * Request bodies are small and written by hand so required fields stay required. When the
 * backend changes: regenerate the schema, then fix the compile errors in this file first.
 */
import type { components, operations } from './schema'

type S = components['schemas']

/** Every field present (the API never omits fields). */
type Strict<T> = { [K in keyof T]-?: T[K] }
/** Adds `null` to the fields API.md marks `T?`. */
type Nullable<T, K extends keyof T> = Omit<T, K> & { [P in K]: T[P] | null }

// --- enumerations (API.md §2) --------------------------------------------------------------

export type TokenScope = NonNullable<S['AuthTokensResponse']['scope']>
/** What an account is (API.md §3 `User.role`); `null` on `User` means an account without a role. */
export type AccountRole = NonNullable<S['UserResponse']['role']>
export type MembershipRole = NonNullable<S['MemberResponse']['role']>
export type StaffRole = Extract<MembershipRole, 'ADMIN' | 'TEACHER'>
export type UserStatus = NonNullable<S['UserResponse']['status']>
export type OrganizationStatus = NonNullable<S['OrganizationResponse']['status']>
export type CourseStatus = NonNullable<S['CourseResponse']['status']>
export type EnrollmentStatus = NonNullable<S['EnrollmentResponse']['status']>
export type LessonStatus = NonNullable<S['LessonResponse']['status']>
export type LessonOutcome = Exclude<LessonStatus, 'PENDING'>
export type MaterialType = NonNullable<S['MaterialResponse']['type']>
/** `?status=` of the homework lists: OPEN = not every item done yet, DONE = completed. */
export type HomeworkStatus = NonNullable<
  NonNullable<operations['listHomework']['parameters']['query']>['status']
>
/** `?status=` of the invite lists: PENDING = unused and unexpired, EXPIRED = unused and expired. */
export type InviteStatus = NonNullable<
  NonNullable<operations['listOrganizationInvites']['parameters']['query']>['status']
>
/** A weekly setting in force, or ended (API.md §9.8). */
export type RecurringLessonStatus = NonNullable<S['RecurringLessonResponse']['status']>
/** Why a recurring lesson ended: a person stopped it, an edit replaced it, or its parties came apart. */
export type RecurringLessonEndReason = NonNullable<S['RecurringLessonResponse']['endReason']>
export type Weekday = NonNullable<S['RecurringLessonResponse']['weekday']>

// --- paging (API.md §1.5) --------------------------------------------------------------------

export interface Page<T> {
  content: T[]
  page: number
  size: number
  totalElements: number
  totalPages: number
  last: boolean
}

export interface PageParams {
  /** 0-based. */
  page?: number
  /** ≤ 100. */
  size?: number
  /** `property,asc|desc`; repeatable. */
  sort?: string | string[]
}

// --- resources (API.md §3) -------------------------------------------------------------------

export type AuthTokens = Strict<S['AuthTokensResponse']>
export type Message = Strict<S['MessageResponse']>
/** The one organization a user belongs to, with the membership id for `DELETE /memberships/{id}`. */
export type UserOrganization = Strict<S['OrganizationSummary']>
/**
 * One role in one place: `role` is `null` for an account without a role (e.g. after its
 * membership was removed); `organization` is `null` unless the user holds a membership (it stays
 * present when that organization is archived). `whatsappNumber` (E.164) is set on teacher accounts
 * that share one, `null` otherwise.
 */
export type User = Nullable<
  Omit<Strict<S['UserResponse']>, 'organization'> & { organization: UserOrganization },
  'role' | 'organization' | 'whatsappNumber'
>
export type Organization = Strict<S['OrganizationResponse']>
export type Invite = Nullable<Strict<S['InviteResponse']>, 'organizationId' | 'usedAt'>
export type Member = Strict<S['MemberResponse']>
/** One profile of a student login: siblings sharing the email are separate students with the same `email`. */
export type Student = Strict<S['StudentResponse']>
/** `POST /students`: the student plus whether a new profile was created or the email's profile of that name linked. */
export type StudentCreated = Strict<S['StudentCreatedResponse']>
/**
 * One of a student's teachers and the meeting link of the two (API.md §7, V16): how the student
 * connects with that teacher; every lesson of the pair answers with it. `null` = none yet.
 */
/**
 * A teacher of the student and how the two meet (D-057): `meetingUrl` is the link to open, for a
 * WhatsApp call (`whatsapp`, D-058) the chat with the teacher's current number, `null` while they have
 * none. `teacherWhatsappNumber` says whether a WhatsApp call can be chosen.
 */
export type MeetingLink = Nullable<
  Strict<S['MeetingLinkResponse']>,
  'meetingUrl' | 'teacherWhatsappNumber'
>
/** `defaultDurationMinutes`: the length new lessons of the course get when booked without one; `null` = 60. */
export type Course = Nullable<
  Strict<S['CourseResponse']>,
  'description' | 'organizationId' | 'defaultDurationMinutes'
>
export type Enrollment = Strict<S['EnrollmentResponse']>
export type StudentEnrollment = Nullable<Strict<S['StudentEnrollmentResponse']>, 'organizationId'>
/**
 * Whether the student paid (API.md §3 `StudentPayment`). Only payment managers receive it: the
 * organization's admin, the super-admin, a freelance teacher for their own lessons.
 */
export type StudentPayment = Nullable<
  Strict<S['StudentPaymentResponse']>,
  'paidAt' | 'recordedById'
>
/**
 * The live payout in which the school paid the teacher for a lesson (API.md §9.6) — the teacher
 * payout, never the student's payment. `paidOn` is a calendar day (`2026-10-20`, no time zone).
 */
export type LessonTeacherPayout = Strict<S['LessonTeacherPayoutResponse']>
/**
 * One lesson. `studentPayment` (and `rolledOverFromLessonId`, which only a paid cancellation
 * sets) is `null` when the caller does not manage the lesson's payments — never read that as
 * "unpaid". `teacherPayout` is `null` when no live payout covers the lesson (and for freelance
 * lessons). A dated lesson runs from `scheduledAt` for `durationMinutes`; `seriesId` groups the
 * lessons one weekly series booked. `recurringLessonId` / `occurrenceOn` name the weekly lesson
 * (API.md §9.8) this lesson stands for an occurrence of, kept when it is moved or closed;
 * `followsRule` is `false` once someone moved, resized, re-linked or unscheduled it by hand (an
 * edit of the rule then leaves it alone), and always without a rule.
 */
export type Lesson = Nullable<
  Omit<Strict<S['LessonResponse']>, 'studentPayment' | 'teacherPayout'> & {
    studentPayment: StudentPayment
    teacherPayout: LessonTeacherPayout
  },
  | 'courseId'
  | 'organizationId'
  | 'scheduledAt'
  | 'seriesId'
  | 'recurringLessonId'
  | 'occurrenceOn'
  | 'studentPayment'
  | 'teacherPayout'
  | 'journal'
  | 'meetingUrl'
  | 'closedAt'
  | 'rolledOverFromLessonId'
>
export type HomeworkItem = Strict<S['HomeworkItemResponse']>
/**
 * One teacher's homework for one student (API.md §11); course and lesson are optional references
 * with their labels. `completedAt` is set once every item is done; open and past `dueAt` = overdue.
 */
export type Homework = Nullable<
  Omit<Strict<S['HomeworkResponse']>, 'items'> & { items: HomeworkItem[] },
  | 'courseId'
  | 'courseTitle'
  | 'lessonId'
  | 'lessonScheduledAt'
  | 'organizationId'
  | 'title'
  | 'notes'
  | 'dueAt'
  | 'completedAt'
>
/**
 * A link (`externalUrl`) or an uploaded file (`fileName`, `contentType`, `sizeBytes`); lists only
 * ever hold ready uploads (API.md §10).
 */
export type Material = Nullable<
  Strict<S['MaterialResponse']>,
  | 'courseId'
  | 'lessonId'
  | 'organizationId'
  | 'externalUrl'
  | 'fileName'
  | 'contentType'
  | 'sizeBytes'
>
/** `GET /materials/{id}/download-url`: `expiresAt` is `null` for links, which never expire. */
export type SignedUrl = Nullable<Strict<S['SignedUrlResponse']>, 'expiresAt'>
export interface LessonDetail {
  lesson: Lesson
  materials: Material[]
  /** The credit a paid cancellation produced; `null` for callers who do not manage payments. */
  rolledOverToLessonId: string | null
}
/**
 * A student's lesson counts. The three payment counts are `null` unless the caller manages
 * payments; `toSchedule` (pending lessons without a date, paid or not) is always set.
 */
export interface LessonSummary {
  prepaidRemaining: number | null
  unpaidDue: number | null
  upcomingUnpaid: number | null
  toSchedule: number
  nextLesson: Lesson | null
}
export interface PrepaidLessons {
  created: number
  lessons: Lesson[]
  summary: LessonSummary
}
/** A charged lesson as payouts list it: one a payout covers, or one still payable to the teacher. */
export type PayoutLesson = Nullable<Strict<S['PayoutLessonResponse']>, 'courseId' | 'courseTitle'>
/**
 * What a school paid one of its teachers for a batch of lessons on a day (API.md §9.6), counted in
 * lessons, never in money. A voided payout stays as history with its `lessonCount`; its lessons are
 * payable again.
 */
export type TeacherPayout = Nullable<
  Strict<S['TeacherPayoutResponse']>,
  'note' | 'voidedAt' | 'voidedById' | 'voidedByName' | 'voidReason'
>
export interface TeacherPayoutDetail {
  payout: TeacherPayout
  /** By date; empty once the payout is voided. */
  lessons: PayoutLesson[]
}
/**
 * One student's row of the finance report (API.md §9.7), counted in the organization's lessons:
 * paid and used in the period, the balances as they stand now. `lastPaymentAt` is the latest
 * payment, whatever the period; `active: false` for a student who left or whose account was deleted.
 */
export type StudentFinanceRow = Nullable<Strict<S['StudentFinanceRowResponse']>, 'lastPaymentAt'>
/**
 * One teacher's row of the finance report (API.md §9.7); `active: false` for a teacher who left
 * and has lessons there. `owedAllTime` is what their Payouts panel calls owed.
 */
export type TeacherFinanceRow = Nullable<Strict<S['TeacherFinanceRowResponse']>, 'lastPayoutOn'>
/** The organization's totals of both reports for the period (`students.used` = `teachers.taught`). */
export interface FinanceSummary {
  students: Strict<S['StudentFinanceTotals']>
  teachers: Strict<S['TeacherFinanceTotals']>
}
/**
 * One row of `GET /teacher/students` (API.md §12): the caller's roster plus the students enrolled
 * in their courses, each with the counts **with this teacher**. The three payment counts are `null`
 * for an org teacher (the school's admin manages payments) and set for a freelance teacher.
 */
export type RosterStudent = Nullable<
  Omit<Strict<S['RosterStudentResponse']>, 'nextLesson'> & { nextLesson: Lesson },
  'prepaidRemaining' | 'unpaidDue' | 'upcomingUnpaid' | 'nextLesson' | 'meetingUrl'
>
/**
 * One row of `GET /teacher/calendar` (API.md §12): a dated lesson of the caller with the names a
 * calendar shows and no payment data. `paidOut` is the school's payout to the teacher, never the
 * student's payment. A `projected` row is an occurrence of a weekly lesson beyond the dates the
 * generator has booked (API.md §9.8): the API sends it with `id: null`; the teacher workspace does
 * not handle such rows yet (gap G23), so `id` stays a string here.
 */
export type CalendarLesson = Nullable<
  Strict<S['CalendarLessonResponse']>,
  | 'courseId'
  | 'courseTitle'
  | 'meetingUrl'
  | 'closedAt'
  | 'seriesId'
  | 'recurringLessonId'
  | 'occurrenceOn'
>
/** `GET /teacher/earnings`: a teacher's charged lessons in a window, those a live payout covers, and the rest (API.md §9.6). */
export type TeacherEarnings = Nullable<Strict<S['TeacherEarningsResponse']>, 'lastPaidOn'>
/** `GET /teacher/lesson-totals`: the teacher's own lessons, all time — held (`PRESENT`), paid, and `paid − held` (API.md §3). */
export type LessonTotals = Strict<S['LessonTotalsResponse']>
/** One date of a weekly series' dry run; `conflictWithLessonId` only when the caller may open that lesson. */
export type SeriesOccurrence = Nullable<
  Strict<S['SeriesOccurrenceResponse']>,
  'conflictWithLessonId'
>
/** `POST /lessons/series` with `dryRun: true`: the dates it would book, nothing written. */
export interface LessonSeriesPlan {
  occurrences: SeriesOccurrence[]
}
/** `POST /lessons/series`: every lesson booked, in date order, with the shared `seriesId`. */
export interface LessonSeries {
  seriesId: string
  lessons: Lesson[]
}
/**
 * A **weekly setting** of one teacher and one student (API.md §9.8), not a lesson: every one or
 * two weeks on `weekday` at `localTime` (`HH:mm`) in `timeZone`, for `durationMinutes`, from
 * `startsOn` until `endsOn` (`null` while permanent); its lessons open the pair's meeting link. `generatedUntil` is the
 * last date lessons exist for (8 weeks ahead); `conflicts` are the dates the daily run could not
 * book because the slot was taken, for a person to settle; `replacesId` names the rule an edit
 * from a date split this one off. Never any payment data.
 */
export type RecurringLesson = Nullable<
  Omit<Strict<S['RecurringLessonResponse']>, 'conflicts'> & { conflicts: RecurringConflict[] },
  | 'courseId'
  | 'organizationId'
  | 'endsOn'
  | 'endReason'
  | 'endedAt'
  | 'endedById'
  | 'generatedUntil'
  | 'replacesId'
  | 'conflicts'
  | 'createdById'
>
/** A date of a weekly lesson the daily run could not book; `conflictWithLessonId` only when the caller may open that lesson. */
export type RecurringConflict = Nullable<
  Strict<S['RecurringConflictResponse']>,
  'conflictWithLessonId'
>
/** One date of a weekly lesson's dry run: as `SeriesOccurrence`, plus the local date it stands for. */
export type RecurringOccurrence = Nullable<
  Strict<S['RecurringOccurrenceResponse']>,
  'conflictWithLessonId'
>
/** `dryRun: true` on create or edit: the dates up to the horizon with their conflicts, nothing written. */
export interface RecurringLessonPlan {
  occurrences: RecurringOccurrence[]
}
/** A rule with the lessons standing for its occurrences from today on, by date. */
export interface RecurringLessonDetail {
  rule: RecurringLesson
  lessons: Lesson[]
}
/** `POST /materials/upload-url`: a pending material and the signed `PUT` URL for its bytes (API.md §10). */
export interface MaterialUpload {
  material: Material
  uploadUrl: string
  uploadUrlExpiresAt: string
}

// --- request bodies -------------------------------------------------------------------------

export interface LoginRequest {
  email: string
  password: string
}
export interface AcceptInviteRequest {
  token: string
  name: string
  password: string
}
export interface ForgotPasswordRequest {
  email: string
}
export interface ResetPasswordRequest {
  token: string
  password: string
}
export interface CreateOrganizationRequest {
  name: string
  slug: string
}
export interface UpdateOrganizationRequest {
  name?: string
  slug?: string
  status?: OrganizationStatus
}
export interface CreateInviteRequest {
  email: string
  role: StaffRole
}
export interface CreateFreelanceInviteRequest {
  email: string
}
export interface CreateStaffRequest {
  email: string
  name: string
  password: string
  role: StaffRole
}
export interface CreateFreelanceTeacherRequest {
  email: string
  name: string
  password: string
}
export interface UpdateFreelanceTeacherRequest {
  name?: string
  email?: string
  status?: UserStatus
  /** E.164 or with separators; `null` removes it. */
  whatsappNumber?: string | null
}
export interface AddMembershipRequest {
  userId: string
  role: MembershipRole
}
export interface UpdateUserRequest {
  name?: string
  email?: string
  status?: UserStatus
  password?: string
  /** Teacher accounts only (`409` otherwise); `null` removes it. */
  whatsappNumber?: string | null
}
export interface CreateStudentRequest {
  name: string
  email: string
  organizationId?: string
  teacherId?: string
}
export interface UpdateStudentRequest {
  name?: string
  email?: string
  status?: UserStatus
}
/** `PUT /students/{id}/meeting-links/{teacherId}`: the pair's link, absolute https (remove it with `DELETE`). */
/** A link, or a WhatsApp call on the teacher's number (`409` while they have none): exactly one. */
export type SetMeetingLinkRequest = { meetingUrl: string } | { whatsapp: true }
export interface CreateCourseRequest {
  title: string
  /** A blank one is stored as none. */
  description?: string
  organizationId?: string
  teacherId?: string
  /** 15–240 minutes. */
  defaultDurationMinutes?: number
}
/** An omitted field stays. Title, status and teacher are never `null` (the API answers `400`). */
export interface UpdateCourseRequest {
  title?: string
  /** `null` removes it, and so does a blank one. */
  description?: string | null
  status?: CourseStatus
  teacherId?: string
  /** `null` removes it (new lessons then last 60 minutes); lessons already booked keep theirs. */
  defaultDurationMinutes?: number | null
}
export interface EnrollRequest {
  studentId: string
}
export interface CreateLessonRequest {
  studentId: string
  teacherId?: string
  courseId?: string
  scheduledAt?: string
  /** 15–240; left out, the course's default length, else 60. */
  durationMinutes?: number
  usePrepaid?: boolean
  /** Book even if the time overlaps another lesson of the teacher or the student (else `409 SCHEDULE_CONFLICT`). */
  allowOverlap?: boolean
}
/** `POST /lessons/series` (API.md §9.5): the same dates every one or two weeks, in the given zone. */
export interface CreateLessonSeriesRequest {
  studentId: string
  teacherId?: string
  courseId?: string
  /** The first lesson, any ISO-8601 offset. */
  firstAt: string
  /** An IANA zone (`Europe/Bucharest`): the dates keep their local time across clock changes. */
  timeZone: string
  intervalWeeks: 1 | 2
  /** 1–52 dates. */
  count: number
  durationMinutes?: number
  allowOverlap?: boolean
  /** Plan only: answers the dates with their conflicts and writes nothing. */
  dryRun?: boolean
}
/**
 * `POST /recurring-lessons` (API.md §9.8): a permanent weekly lesson from `firstAt` (today or
 * later in `timeZone`), every one or two weeks at the same local time, until it is ended. The
 * length falls back to the course's default, copied once.
 */
export interface CreateRecurringLessonRequest {
  studentId: string
  /** Admins and the super-admin name the teacher, as on `POST /lessons/series`. */
  teacherId?: string
  courseId?: string
  /** The first lesson, any ISO-8601 offset; it sets the weekday, the local time and `startsOn`. */
  firstAt: string
  /** An IANA zone (`Europe/Bucharest`): 17:00 stays 17:00 across clock changes. */
  timeZone: string
  intervalWeeks: 1 | 2
  durationMinutes?: number
  /** Book the dates that overlap other lessons too (else `409 SCHEDULE_CONFLICT`, nothing written). */
  allowOverlap?: boolean
  /** Plan only: answers the dates up to the horizon with their conflicts and writes nothing. */
  dryRun?: boolean
}
/**
 * `PATCH /recurring-lessons/{id}`: a change from `effectiveFrom` (a local date in the rule's
 * zone, today or later). An omitted field keeps its value; nothing changed → `400`. When `effectiveFrom` is after the rule's start the rule splits and the
 * answer is a **new** rule holding the new settings.
 */
export interface UpdateRecurringLessonRequest {
  /** `yyyy-MM-dd` in the rule's zone. */
  effectiveFrom: string
  weekday?: Weekday
  /** `HH:mm`. */
  localTime?: string
  timeZone?: string
  intervalWeeks?: 1 | 2
  /** Never `null` (the API answers `400`). */
  durationMinutes?: number
  allowOverlap?: boolean
  dryRun?: boolean
}
/** `POST /recurring-lessons/{id}/end`: `endsOn` is the last day covered; left out, today in the rule's zone. */
export interface EndRecurringLessonRequest {
  endsOn?: string
}
/** `POST /materials`: a link-based material on a course and / or a lesson (API.md §10). */
export interface CreateMaterialRequest {
  title: string
  type: MaterialType
  externalUrl: string
  courseId?: string
  lessonId?: string
}
/** `POST /materials/upload-url`: declares the file; the server checks the type's content types and size limit. */
export interface CreateUploadRequest {
  title: string
  type: Exclude<MaterialType, 'LINK'>
  fileName: string
  contentType: string
  sizeBytes: number
  courseId?: string
  lessonId?: string
}
export interface ScheduleLessonRequest {
  /** `null` unschedules, and so does leaving it out: send the date even to change only the length. */
  scheduledAt: string | null
  /** Left out, the lesson keeps its length; never `null` (the API answers `400`). */
  durationMinutes?: number
  /** Move even if the new slot overlaps another lesson (else `409 SCHEDULE_CONFLICT`). */
  allowOverlap?: boolean
}
export interface CloseLessonRequest {
  status: LessonOutcome
  journal?: string
}
export interface UpdateJournalRequest {
  journal: string
}
export interface UpdatePaymentRequest {
  paid: boolean
}
export interface AddPrepaidLessonsRequest {
  count: number
  teacherId?: string
  courseId?: string
}
/** `POST /orgs/{orgId}/teacher-payouts`: exactly one of `lessonIds` and `upTo` (API.md §9.6). */
export interface CreateTeacherPayoutRequest {
  teacherId: string
  /** 1–500 lessons payable to the teacher. */
  lessonIds?: string[]
  /** ISO instant: every payable lesson dated before it. The console sends the start of the day after the picked one. */
  upTo?: string
  /** `yyyy-MM-dd`, the day the school paid; at most today. */
  paidOn: string
  /** ≤ 4000 characters; blank = none. */
  note?: string
}
export interface VoidTeacherPayoutRequest {
  /** 1–4000 characters. */
  reason: string
}
export interface CreateHomeworkRequest {
  studentId: string
  /** Admins and the super-admin name the teacher. */
  teacherId?: string
  courseId?: string
  lessonId?: string
  title?: string
  notes?: string
  /** ISO instant; the console sends the end of the chosen day. */
  dueAt?: string
  /** 1–100 lines; they start open. */
  items: { text: string }[]
}
/** Omitted fields stay; an explicit `null` removes one (API.md §11). */
export interface UpdateHomeworkRequest {
  /** `null` unlinks the lesson. The console never sends it (no lesson picker). */
  lessonId?: string | null
  /** `null` or blank clears it. */
  title?: string | null
  /** `null` or blank clears them. */
  notes?: string | null
  /** Moves the due date; `null` removes it. */
  dueAt?: string | null
  /** Replaces the whole checklist (every item gets a new id); `done` is taken as sent. Never `null`. */
  items?: { text: string; done: boolean }[]
}

// --- list filters -----------------------------------------------------------------------------

export interface UserFilters {
  freelance?: boolean
  q?: string
}
export interface FreelanceTeacherFilters {
  /** Name or email, case-insensitive. */
  q?: string
  status?: UserStatus
}
export interface InviteFilters {
  /** Omitted: every invite. */
  status?: InviteStatus
}
export interface StudentFilters {
  organizationId?: string
  teacherId?: string
}
export interface CourseFilters {
  organizationId?: string
  teacherId?: string
}
export interface HomeworkFilters {
  studentId?: string
  teacherId?: string
  courseId?: string
  lessonId?: string
  status?: HomeworkStatus
  /** ISO instant, inclusive. */
  dueFrom?: string
  /** ISO instant, exclusive. */
  dueTo?: string
}
export interface PayableLessonFilters {
  /** ISO instant, inclusive. */
  from?: string
  /** ISO instant, exclusive. */
  to?: string
}
/**
 * The period of the finance reports: ISO instants, `from` included, `to` excluded. The console
 * computes them in the admin's time zone (an organization has none).
 */
export interface FinancePeriod {
  from: string
  to: string
}
export interface TeacherPayoutFilters {
  teacherId?: string
  /** `yyyy-MM-dd`, inclusive, on `paidOn`. */
  from?: string
  /** `yyyy-MM-dd`, inclusive, on `paidOn`. */
  to?: string
  /** Omitted or `false`: live payouts only. */
  includeVoided?: boolean
}
export interface LessonFilters {
  studentId?: string
  teacherId?: string
  courseId?: string
  organizationId?: string
  status?: LessonStatus
  paid?: boolean
  /** ISO instant, inclusive. */
  from?: string
  /** ISO instant, exclusive. */
  to?: string
  unscheduled?: boolean
}
/** `GET /recurring-lessons`: visibility as `GET /lessons`, the filters only narrow it. */
export interface RecurringLessonFilters {
  studentId?: string
  teacherId?: string
  courseId?: string
  status?: RecurringLessonStatus
  organizationId?: string
}
/** `GET /teacher/calendar`: local midnights with their offsets, at most 42 days (and an hour) apart. */
export interface CalendarQuery {
  from: string
  to: string
}
/** `GET /teacher/earnings`: the local month's bounds with their offsets. */
export interface EarningsQuery {
  from?: string
  to?: string
}
