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
import type { components } from './schema'

type S = components['schemas']

/** Every field present (the API never omits fields). */
type Strict<T> = { [K in keyof T]-?: T[K] }
/** Adds `null` to the fields API.md marks `T?`. */
type Nullable<T, K extends keyof T> = Omit<T, K> & { [P in K]: T[P] | null }

// --- enumerations (API.md §2) --------------------------------------------------------------

export type TokenScope = NonNullable<S['AuthTokensResponse']['scope']>
export type PlatformRole = NonNullable<S['UserResponse']['platformRole']>
export type MembershipRole = NonNullable<S['MembershipSummary']['role']>
export type StaffRole = Extract<MembershipRole, 'ADMIN' | 'TEACHER'>
export type UserStatus = NonNullable<S['UserResponse']['status']>
export type OrganizationStatus = NonNullable<S['OrganizationResponse']['status']>
export type CourseStatus = NonNullable<S['CourseResponse']['status']>
export type EnrollmentStatus = NonNullable<S['EnrollmentResponse']['status']>
export type LessonStatus = NonNullable<S['LessonResponse']['status']>
export type LessonOutcome = Exclude<LessonStatus, 'PENDING'>
export type MaterialType = NonNullable<S['MaterialResponse']['type']>

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
export type MembershipSummary = Strict<S['MembershipSummary']>
export type User = Nullable<
  Omit<Strict<S['UserResponse']>, 'memberships'> & { memberships: MembershipSummary[] },
  'platformRole'
>
export type Organization = Strict<S['OrganizationResponse']>
export type Invite = Nullable<Strict<S['InviteResponse']>, 'organizationId' | 'usedAt'>
export type Member = Strict<S['MemberResponse']>
export type Student = Strict<S['StudentResponse']>
export type Course = Nullable<
  Strict<S['CourseResponse']>,
  'description' | 'organizationId' | 'defaultMeetingUrl'
>
export type Enrollment = Strict<S['EnrollmentResponse']>
export type StudentEnrollment = Nullable<Strict<S['StudentEnrollmentResponse']>, 'organizationId'>
export type Lesson = Nullable<
  Strict<S['LessonResponse']>,
  | 'courseId'
  | 'organizationId'
  | 'scheduledAt'
  | 'paidAt'
  | 'journal'
  | 'meetingUrl'
  | 'closedAt'
  | 'rolledOverFromLessonId'
>
export type HomeworkItem = Strict<S['HomeworkItemResponse']>
export type Homework = Nullable<
  Omit<Strict<S['HomeworkResponse']>, 'items'> & { items: HomeworkItem[] },
  'courseId' | 'lessonId' | 'organizationId' | 'notes'
>
export type Material = Nullable<
  Strict<S['MaterialResponse']>,
  'courseId' | 'lessonId' | 'organizationId' | 'externalUrl' | 'fileName'
>
export interface LessonDetail {
  lesson: Lesson
  homework: Homework[]
  materials: Material[]
  rolledOverToLessonId: string | null
}
export interface LessonSummary {
  prepaidRemaining: number
  unpaidDue: number
  upcomingUnpaid: number
  nextLesson: Lesson | null
}
export interface PrepaidLessons {
  created: number
  lessons: Lesson[]
  summary: LessonSummary
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
export interface AddMembershipRequest {
  userId: string
  role: MembershipRole
}
export interface UpdateUserRequest {
  name?: string
  email?: string
  status?: UserStatus
  password?: string
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
export interface CreateCourseRequest {
  title: string
  description?: string
  organizationId?: string
  teacherId?: string
  defaultMeetingUrl?: string
}
export interface UpdateCourseRequest {
  title?: string
  description?: string
  status?: CourseStatus
  teacherId?: string
  defaultMeetingUrl?: string
}
export interface EnrollRequest {
  studentId: string
}
export interface CreateLessonRequest {
  studentId: string
  teacherId?: string
  courseId?: string
  scheduledAt?: string
  meetingUrl?: string
  usePrepaid?: boolean
}
export interface ScheduleLessonRequest {
  /** `null` unschedules. */
  scheduledAt: string | null
  meetingUrl?: string
}
export interface CloseLessonRequest {
  status: LessonOutcome
  journal?: string
  homework?: { notes?: string; items?: string[] }
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

// --- list filters -----------------------------------------------------------------------------

export interface UserFilters {
  freelance?: boolean
  q?: string
}
export interface StudentFilters {
  organizationId?: string
  teacherId?: string
}
export interface CourseFilters {
  organizationId?: string
  teacherId?: string
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
