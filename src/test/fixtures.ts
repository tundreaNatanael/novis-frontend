import type {
  Course,
  Enrollment,
  FinanceSummary,
  Homework,
  Lesson,
  LessonDetail,
  LessonSummary,
  Material,
  Member,
  Organization,
  Page,
  PayoutLesson,
  Student,
  StudentCreated,
  StudentEnrollment,
  StudentFinanceRow,
  StudentPayment,
  TeacherFinanceRow,
  TeacherPayout,
  TeacherPayoutDetail,
  User,
  UserOrganization,
} from '@/api/types'

export function page<T>(content: T[], overrides: Partial<Page<T>> = {}): Page<T> {
  return {
    content,
    page: 0,
    size: 20,
    totalElements: content.length,
    totalPages: 1,
    last: true,
    ...overrides,
  }
}

export const superAdmin: User = {
  id: 'root',
  email: 'admin@novis.local',
  name: 'Platform Owner',
  role: 'SUPER_ADMIN',
  organization: null,
  status: 'ACTIVE',
  hasPassword: true,
  createdAt: '2026-10-11T17:24:36Z',
}

/** `User.organization`: the one organization of a member, with its membership id. */
export function userOrganization(overrides: Partial<UserOrganization> = {}): UserOrganization {
  return {
    id: 'org-1',
    name: 'Riverside Music School',
    slug: 'riverside',
    status: 'ACTIVE',
    membershipId: 'm-1',
    ...overrides,
  }
}

export function orgAdmin(
  organizationId: string,
  organizationName = 'Riverside Music School',
): User {
  return {
    id: 'admin-1',
    email: 'admin@riverside.test',
    name: 'Riverside Admin',
    role: 'ADMIN',
    organization: userOrganization({
      id: organizationId,
      name: organizationName,
      membershipId: 'm-admin-1',
    }),
    status: 'ACTIVE',
    hasPassword: true,
    createdAt: '2026-10-12T10:00:00Z',
  }
}

export function organization(overrides: Partial<Organization> = {}): Organization {
  return {
    id: 'org-1',
    name: 'Riverside Music School',
    slug: 'riverside',
    status: 'ACTIVE',
    createdAt: '2026-10-11T17:24:41Z',
    updatedAt: '2026-10-11T17:24:41Z',
    ...overrides,
  }
}

export function member(overrides: Partial<Member> = {}): Member {
  return {
    membershipId: 'm-1',
    userId: 'u-1',
    organizationId: 'org-1',
    email: 'ana@riverside.test',
    name: 'Ana Pop',
    role: 'TEACHER',
    createdAt: '2026-10-12T10:00:00Z',
    ...overrides,
  }
}

/** A TEACHER of org-1 unless overridden. */
export function user(overrides: Partial<User> = {}): User {
  return {
    id: 'u-1',
    email: 'ana@riverside.test',
    name: 'Ana Pop',
    role: 'TEACHER',
    organization: userOrganization(),
    status: 'ACTIVE',
    hasPassword: true,
    createdAt: '2026-10-12T10:00:00Z',
    ...overrides,
  }
}

/** A freelance teacher: no organization, ever. */
export function freelanceTeacher(overrides: Partial<User> = {}): User {
  return user({
    id: 'f-1',
    name: 'Free Lancer',
    email: 'free@test.local',
    role: 'FREELANCE_TEACHER',
    organization: null,
    ...overrides,
  })
}

/** A student account (no password) as `GET /users/{id}` returns it; a STUDENT of org-1 by default. */
export function studentUser(overrides: Partial<User> = {}): User {
  return user({
    id: 's-1',
    email: 'kid@riverside.test',
    name: 'Kid Student',
    role: 'STUDENT',
    hasPassword: false,
    organization: userOrganization({ membershipId: 'm-s-1' }),
    ...overrides,
  })
}

export function student(overrides: Partial<Student> = {}): Student {
  return {
    id: 's-1',
    email: 'kid@riverside.test',
    name: 'Kid Student',
    status: 'ACTIVE',
    createdAt: '2026-10-13T10:00:00Z',
    ...overrides,
  }
}

/** The `POST /students` answer: a student plus whether a new profile was created (D-049). */
export function studentCreated(overrides: Partial<StudentCreated> = {}): StudentCreated {
  return { ...student(), profileCreated: true, ...overrides }
}

export function course(overrides: Partial<Course> = {}): Course {
  return {
    id: 'c-1',
    title: 'Piano — beginners',
    description: null,
    status: 'ACTIVE',
    teacherId: 'u-1',
    organizationId: 'org-1',
    defaultMeetingUrl: null,
    defaultDurationMinutes: null,
    createdAt: '2026-10-12T11:00:00Z',
    updatedAt: '2026-10-12T11:00:00Z',
    ...overrides,
  }
}

export function enrollment(overrides: Partial<Enrollment> = {}): Enrollment {
  return {
    id: 'e-1',
    courseId: 'c-1',
    studentId: 's-1',
    studentName: 'Kid Student',
    studentEmail: 'kid@riverside.test',
    status: 'ACTIVE',
    enrolledAt: '2026-10-13T11:00:00Z',
    ...overrides,
  }
}

export function studentEnrollment(overrides: Partial<StudentEnrollment> = {}): StudentEnrollment {
  return {
    id: 'e-1',
    courseId: 'c-1',
    courseTitle: 'Piano — beginners',
    courseStatus: 'ACTIVE',
    teacherId: 'u-1',
    organizationId: 'org-1',
    status: 'ACTIVE',
    enrolledAt: '2026-10-13T11:00:00Z',
    ...overrides,
  }
}

/** A student's counts as a payment manager (the console's users) gets them. */
export const summary: LessonSummary = {
  prepaidRemaining: 2,
  unpaidDue: 1,
  upcomingUnpaid: 0,
  toSchedule: 1,
  nextLesson: null,
}

export const unpaid: StudentPayment = { paid: false, paidAt: null, recordedById: null }

/** A payment recorded by the organization's admin (`orgAdmin`, `admin-1`). */
export function paid(paidAt = '2026-10-14T10:00:00Z'): StudentPayment {
  return { paid: true, paidAt, recordedById: 'admin-1' }
}

export function lesson(overrides: Partial<Lesson> = {}): Lesson {
  return {
    id: 'l-1',
    teacherId: 'u-1',
    studentId: 's-1',
    courseId: 'c-1',
    organizationId: 'org-1',
    status: 'PENDING',
    scheduledAt: '2026-10-20T15:00:00Z',
    durationMinutes: 60,
    seriesId: null,
    studentPayment: unpaid,
    teacherPayout: null,
    journal: null,
    meetingUrl: null,
    closedAt: null,
    rolledOverFromLessonId: null,
    createdAt: '2026-10-14T10:00:00Z',
    updatedAt: '2026-10-14T10:00:00Z',
    ...overrides,
  }
}

/** A held lesson of `u-1` (Ana Pop) as the payout endpoints list it. */
export function payoutLesson(overrides: Partial<PayoutLesson> = {}): PayoutLesson {
  return {
    id: 'l-held-1',
    scheduledAt: '2026-10-01T15:00:00Z',
    durationMinutes: 60,
    status: 'PRESENT',
    studentId: 's-1',
    studentName: 'Kid Student',
    courseId: 'c-1',
    courseTitle: 'Piano',
    ...overrides,
  }
}

/** A live payout to `u-1` (Ana Pop) recorded by the organization's admin (`admin-1`). */
export function teacherPayout(overrides: Partial<TeacherPayout> = {}): TeacherPayout {
  return {
    id: 'p-1',
    organizationId: 'org-1',
    teacherId: 'u-1',
    teacherName: 'Ana Pop',
    paidOn: '2026-10-20',
    lessonCount: 2,
    note: '1,200 RON, bank transfer',
    recordedById: 'admin-1',
    recordedByName: 'Riverside Admin',
    voidedAt: null,
    voidedById: null,
    voidedByName: null,
    voidReason: null,
    createdAt: '2026-10-20T09:00:00Z',
    updatedAt: '2026-10-20T09:00:00Z',
    ...overrides,
  }
}

export function teacherPayoutDetail(
  overrides: Partial<TeacherPayout> = {},
  lessons: PayoutLesson[] = [
    payoutLesson(),
    payoutLesson({ id: 'l-held-2', scheduledAt: '2026-10-08T15:00:00Z' }),
  ],
): TeacherPayoutDetail {
  return { payout: teacherPayout(overrides), lessons }
}

/** A student's row of the finance report (`s-1`, Kid Student), whose counts match `summary`. */
export function studentFinanceRow(overrides: Partial<StudentFinanceRow> = {}): StudentFinanceRow {
  return {
    studentId: 's-1',
    name: 'Kid Student',
    active: true,
    paidByStudent: 4,
    used: 3,
    prepaidRemaining: 2,
    unpaidDue: 1,
    lastPaymentAt: '2026-10-02T09:00:00Z',
    ...overrides,
  }
}

/** `u-1`'s (Ana Pop) row of the finance report: one mismatch of each kind. */
export function teacherFinanceRow(overrides: Partial<TeacherFinanceRow> = {}): TeacherFinanceRow {
  return {
    teacherId: 'u-1',
    name: 'Ana Pop',
    active: true,
    taught: 5,
    paidOut: 3,
    owed: 2,
    owedAllTime: 4,
    usedPaidNotPaidOut: 1,
    paidOutNotPaidByStudent: 1,
    lastPayoutOn: '2026-10-20',
    ...overrides,
  }
}

/** The organization's totals of the finance reports for a period. */
export function financeSummary(): FinanceSummary {
  return {
    students: { paidByStudent: 6, used: 5, prepaidRemaining: 2, unpaidDue: 1 },
    teachers: {
      taught: 5,
      paidOut: 3,
      owed: 2,
      owedAllTime: 4,
      usedPaidNotPaidOut: 1,
      paidOutNotPaidByStudent: 1,
    },
  }
}

export function lessonDetail(
  overrides: Partial<Lesson> = {},
  extra: Partial<Omit<LessonDetail, 'lesson'>> = {},
): LessonDetail {
  return {
    lesson: lesson(overrides),
    materials: [],
    rolledOverToLessonId: null,
    ...extra,
  }
}

/** An uploaded video on lesson l-1 (a link: `externalUrl` set, the file fields `null`). */
export function material(overrides: Partial<Material> = {}): Material {
  return {
    id: 'm-1',
    courseId: null,
    lessonId: 'l-1',
    teacherId: 'u-1',
    organizationId: 'org-1',
    title: 'Scales, slowly',
    type: 'VIDEO',
    externalUrl: null,
    fileName: 'scales.mp4',
    contentType: 'video/mp4',
    sizeBytes: 48_211_234,
    createdAt: '2026-10-20T15:00:00Z',
    ...overrides,
  }
}

export function homework(overrides: Partial<Homework> = {}): Homework {
  return {
    id: 'hw-1',
    teacherId: 'u-1',
    teacherName: 'Ana Pop',
    studentId: 's-1',
    studentName: 'Kid Student',
    courseId: null,
    courseTitle: null,
    lessonId: null,
    lessonScheduledAt: null,
    organizationId: 'org-1',
    title: 'Weekly practice',
    notes: null,
    dueAt: '2026-10-30T21:59:59Z',
    completedAt: null,
    items: [
      { id: 'hi-1', text: 'C major scale', done: true, position: 0 },
      { id: 'hi-2', text: 'Etude no. 3', done: false, position: 1 },
    ],
    createdAt: '2026-10-21T10:00:00Z',
    updatedAt: '2026-10-21T10:00:00Z',
    ...overrides,
  }
}
