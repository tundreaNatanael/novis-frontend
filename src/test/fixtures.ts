import type {
  Course,
  Enrollment,
  Lesson,
  LessonDetail,
  Member,
  Organization,
  Page,
  Student,
  StudentEnrollment,
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

export function course(overrides: Partial<Course> = {}): Course {
  return {
    id: 'c-1',
    title: 'Piano — beginners',
    description: null,
    status: 'ACTIVE',
    teacherId: 'u-1',
    organizationId: 'org-1',
    defaultMeetingUrl: null,
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

export const summary = { prepaidRemaining: 2, unpaidDue: 1, upcomingUnpaid: 0, nextLesson: null }

export function lesson(overrides: Partial<Lesson> = {}): Lesson {
  return {
    id: 'l-1',
    teacherId: 'u-1',
    studentId: 's-1',
    courseId: 'c-1',
    organizationId: 'org-1',
    status: 'PENDING',
    scheduledAt: '2026-10-20T15:00:00Z',
    paid: false,
    paidAt: null,
    journal: null,
    meetingUrl: null,
    closedAt: null,
    rolledOverFromLessonId: null,
    createdAt: '2026-10-14T10:00:00Z',
    updatedAt: '2026-10-14T10:00:00Z',
    ...overrides,
  }
}

export function lessonDetail(
  overrides: Partial<Lesson> = {},
  extra: Partial<Omit<LessonDetail, 'lesson'>> = {},
): LessonDetail {
  return {
    lesson: lesson(overrides),
    homework: [],
    materials: [],
    rolledOverToLessonId: null,
    ...extra,
  }
}
