import { describe, expect, it } from 'vitest'
import type { Lesson, User, UserOrganization } from '@/api/types'
import { paid, unpaid } from '@/test/fixtures'
import {
  deriveCapabilities,
  hasConsoleAccess,
  homeFor,
  lessonRules,
  membershipRoleOf,
} from './permissions'

const org = 'org-1'
const other = 'org-2'

function place(id: string, overrides: Partial<UserOrganization> = {}): UserOrganization {
  return {
    id,
    name: 'School',
    slug: 'school',
    status: 'ACTIVE',
    membershipId: `m-${id}`,
    ...overrides,
  }
}

function user(overrides: Partial<User>): User {
  return {
    id: 'u-1',
    email: 'u@test',
    name: 'U',
    role: null,
    organization: null,
    status: 'ACTIVE',
    hasPassword: true,
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

const superAdmin = user({ id: 'root', role: 'SUPER_ADMIN' })
const admin = user({ id: 'admin', role: 'ADMIN', organization: place(org) })
const otherAdmin = user({ id: 'admin-2', role: 'ADMIN', organization: place(org) })
const teacherOnly = user({ id: 'teacher', role: 'TEACHER', organization: place(org) })
const studentHere = user({
  id: 'student',
  role: 'STUDENT',
  hasPassword: false,
  organization: place(org),
})
const teacherElsewhere = user({ id: 'teacher-2', role: 'TEACHER', organization: place(other) })
const freelancer = user({ id: 'free', role: 'FREELANCE_TEACHER' })
const roleless = user({ id: 'nobody' })

describe('console access and home', () => {
  it('admits the super-admin and admins of an active organization only', () => {
    expect(hasConsoleAccess(superAdmin)).toBe(true)
    expect(hasConsoleAccess(admin)).toBe(true)
    expect(hasConsoleAccess(teacherOnly)).toBe(false)
    expect(hasConsoleAccess(freelancer)).toBe(false)
    expect(hasConsoleAccess(studentHere)).toBe(false)
    expect(hasConsoleAccess(roleless)).toBe(false)
    expect(hasConsoleAccess(null)).toBe(false)
    const archivedAdmin = user({
      role: 'ADMIN',
      organization: place(org, { status: 'ARCHIVED' }),
    })
    expect(hasConsoleAccess(archivedAdmin)).toBe(false)
  })

  it('sends each role to its home', () => {
    expect(homeFor(superAdmin)).toBe('/platform')
    expect(homeFor(admin)).toBe(`/org/${org}`)
    expect(homeFor(teacherOnly)).toBe('/no-access')
    expect(homeFor(freelancer)).toBe('/no-access')
    expect(homeFor(roleless)).toBe('/no-access')
    expect(homeFor(user({ role: 'ADMIN', organization: place(org, { status: 'ARCHIVED' }) }))).toBe(
      '/no-access',
    )
  })

  it('reads the role of the one membership', () => {
    expect(membershipRoleOf(admin)).toBe('ADMIN')
    expect(membershipRoleOf(studentHere)).toBe('STUDENT')
    expect(membershipRoleOf(freelancer)).toBeNull()
    expect(membershipRoleOf(superAdmin)).toBeNull()
  })
})

describe('deriveCapabilities', () => {
  it('gives the super-admin everything', () => {
    const caps = deriveCapabilities(superAdmin, org)
    expect(caps.isSuperAdmin).toBe(true)
    expect(caps.adminOrgId).toBeNull()
    expect(caps.canManageOrganizations).toBe(true)
    expect(caps.canManageAdmins).toBe(true)
    expect(caps.canManageLessons).toBe(true)
    expect(caps.canManageStudentPayments).toBe(true)
    expect(caps.canManageTeacherPayouts).toBe(true)
    expect(caps.canManageHomework).toBe(true)
    expect(deriveCapabilities(superAdmin).canManageStudentPayments).toBe(true)
    expect(deriveCapabilities(superAdmin).canManageHomework).toBe(true)
    expect(caps.canManageFreelance).toBe(true)
    expect(caps.canEditStatus).toBe(true)
    expect(caps.canEditEmail(teacherOnly)).toBe(true)
    expect(caps.canDeleteAccount(teacherOnly)).toBe(true)
    expect(caps.canDeleteAccount(admin)).toBe(true)
    expect(caps.canDeleteAccount(freelancer)).toBe(true)
    expect(caps.canDeleteAccount(superAdmin)).toBe(false)
    expect(caps.deleteAccountDisabledReason(superAdmin)).toMatch(/own account/)
    expect(caps.inviteActionDisabledReason({ organizationId: org, role: 'ADMIN' })).toBeNull()
    expect(caps.inviteActionDisabledReason({ organizationId: null, role: 'TEACHER' })).toBeNull()
  })

  it('scopes an admin to their organization and hides platform-only actions', () => {
    const inOwnOrg = deriveCapabilities(admin, org)
    expect(inOwnOrg.isOrgAdmin).toBe(true)
    expect(inOwnOrg.adminOrgId).toBe(org)
    expect(inOwnOrg.canManageTeachers).toBe(true)
    expect(inOwnOrg.canManageAdmins).toBe(false)
    expect(inOwnOrg.canManageLessons).toBe(true)
    expect(inOwnOrg.canManageStudentPayments).toBe(true)
    expect(inOwnOrg.canManageTeacherPayouts).toBe(true)
    expect(inOwnOrg.canManageHomework).toBe(true)
    expect(inOwnOrg.canManageFreelance).toBe(false)
    expect(inOwnOrg.canEditStatus).toBe(false)
    expect(inOwnOrg.canEditEmail(teacherOnly)).toBe(false)
    expect(inOwnOrg.canEditUser(teacherOnly)).toBe(true)
    expect(inOwnOrg.canEditUser(studentHere)).toBe(true)
    expect(inOwnOrg.canDeleteAccount(teacherOnly)).toBe(true)
    expect(inOwnOrg.canEditUser(admin)).toBe(true)
    expect(inOwnOrg.canEditEmail(admin)).toBe(true)

    const elsewhere = deriveCapabilities(admin, other)
    expect(elsewhere.isOrgAdmin).toBe(false)
    expect(elsewhere.canManageTeachers).toBe(false)
    expect(elsewhere.canManageLessons).toBe(false)
    expect(elsewhere.canManageStudentPayments).toBe(false)
    expect(elsewhere.canManageTeacherPayouts).toBe(false)
    expect(elsewhere.canManageHomework).toBe(false)
  })

  it('leaves teacher payouts to the organization’s admins and the super-admin', () => {
    expect(deriveCapabilities(otherAdmin, org).canManageTeacherPayouts).toBe(true)
    expect(deriveCapabilities(teacherOnly, org).canManageTeacherPayouts).toBe(false)
    expect(deriveCapabilities(teacherElsewhere, org).canManageTeacherPayouts).toBe(false)
    expect(deriveCapabilities(roleless, org).canManageTeacherPayouts).toBe(false)
    expect(deriveCapabilities(freelancer, org).canManageTeacherPayouts).toBe(false)
  })

  it('shows the Finance tab to the organization’s admins and the super-admin, former teachers’ pages to the super-admin only', () => {
    expect(deriveCapabilities(superAdmin, org).canViewFinance).toBe(true)
    expect(deriveCapabilities(admin, org).canViewFinance).toBe(true)
    expect(deriveCapabilities(admin, other).canViewFinance).toBe(false)
    expect(deriveCapabilities(teacherOnly, org).canViewFinance).toBe(false)
    expect(deriveCapabilities(roleless, org).canViewFinance).toBe(false)
    expect(deriveCapabilities(freelancer, org).canViewFinance).toBe(false)
    expect(deriveCapabilities(superAdmin, org).canOpenFormerTeachers).toBe(true)
    expect(deriveCapabilities(admin, org).canOpenFormerTeachers).toBe(false)
    expect(deriveCapabilities(superAdmin, org).canOpenFormerStudents).toBe(true)
    expect(deriveCapabilities(admin, org).canOpenFormerStudents).toBe(false)
  })

  it('leaves other admins, other organizations and freelance teachers to the super-admin', () => {
    const caps = deriveCapabilities(admin, org)
    expect(caps.canEditUser(otherAdmin)).toBe(false)
    expect(caps.canDeleteAccount(otherAdmin)).toBe(false)
    expect(caps.deleteAccountDisabledReason(otherAdmin)).toMatch(/platform owner/)
    expect(caps.canEditUser(teacherElsewhere)).toBe(false)
    expect(caps.canDeleteAccount(teacherElsewhere)).toBe(false)
    expect(caps.canEditUser(freelancer)).toBe(false)
    expect(caps.canDeleteAccount(freelancer)).toBe(false)
    expect(caps.canEditUser(roleless)).toBe(false)
  })

  it('never removes the caller’s own ADMIN membership and leaves admin removal to the super-admin', () => {
    const caps = deriveCapabilities(admin, org)
    expect(
      caps.removeMembershipDisabledReason({ userId: 'admin', organizationId: org, role: 'ADMIN' }),
    ).toMatch(/your own admin/)
    expect(
      caps.removeMembershipDisabledReason({
        userId: 'admin-2',
        organizationId: org,
        role: 'ADMIN',
      }),
    ).toMatch(/platform owner/)
    expect(caps.canRemoveMembership({ userId: 'x', organizationId: org, role: 'TEACHER' })).toBe(
      true,
    )
    expect(caps.canRemoveMembership({ userId: 'x', organizationId: org, role: 'STUDENT' })).toBe(
      true,
    )
    expect(caps.canRemoveMembership({ userId: 'x', organizationId: other, role: 'TEACHER' })).toBe(
      false,
    )
    expect(
      deriveCapabilities(superAdmin, org).canRemoveMembership({
        userId: 'x',
        organizationId: other,
        role: 'ADMIN',
      }),
    ).toBe(true)
  })

  it('lets an admin act on teacher invitations of their organization only', () => {
    const caps = deriveCapabilities(admin, org)
    expect(caps.inviteActionDisabledReason({ organizationId: org, role: 'TEACHER' })).toBeNull()
    expect(caps.inviteActionDisabledReason({ organizationId: org, role: 'ADMIN' })).toMatch(
      /platform owner/,
    )
    expect(
      caps.inviteActionDisabledReason({ organizationId: other, role: 'TEACHER' }),
    ).not.toBeNull()
    expect(
      caps.inviteActionDisabledReason({ organizationId: null, role: 'TEACHER' }),
    ).not.toBeNull()
  })
})

describe('lessonRules', () => {
  const base: Pick<Lesson, 'status' | 'scheduledAt' | 'studentPayment'> = {
    status: 'PENDING',
    scheduledAt: '2030-01-01T10:00:00Z',
    studentPayment: unpaid,
  }

  it('maps statuses to display states', () => {
    expect(lessonRules.displayStatus(base)).toBe('upcoming')
    expect(lessonRules.displayStatus({ ...base, scheduledAt: null })).toBe('credit')
    expect(lessonRules.displayStatus({ ...base, status: 'PRESENT' })).toBe('held')
    expect(lessonRules.displayStatus({ ...base, status: 'CANCELED' })).toBe('canceled')
    expect(lessonRules.displayStatus({ ...base, status: 'CANCELED_LATE' })).toBe('canceled_late')
  })

  it('allows exactly the transitions the API accepts', () => {
    expect(lessonRules.canClose(base)).toBe(true)
    expect(lessonRules.closeDisabledReason({ ...base, scheduledAt: null })).toMatch(/Schedule/)
    expect(lessonRules.canClose({ ...base, status: 'PRESENT' })).toBe(false)
    expect(lessonRules.canEditJournal(base)).toBe(false)
    expect(lessonRules.canEditJournal({ ...base, status: 'PRESENT' })).toBe(true)
    expect(lessonRules.canDelete(base)).toBe(true)
    expect(lessonRules.canDelete({ ...base, studentPayment: paid() })).toBe(false)
    expect(lessonRules.deleteDisabledReason({ ...base, studentPayment: paid() })).toMatch(/Paid/)
    expect(lessonRules.deleteDisabledReason({ ...base, status: 'CANCELED' })).toMatch(/history/)
    expect(lessonRules.canSchedule({ status: 'CANCELED_LATE' })).toBe(false)
  })

  it('leaves a pending lesson whose payment is not shown to the server', () => {
    const hidden = { ...base, studentPayment: null }
    expect(lessonRules.canDelete(hidden)).toBe(true)
    expect(lessonRules.deleteDisabledReason(hidden)).toBeNull()
    expect(lessonRules.deleteDisabledReason({ ...hidden, status: 'PRESENT' })).toMatch(/history/)
  })
})
