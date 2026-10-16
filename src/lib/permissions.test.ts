import { describe, expect, it } from 'vitest'
import type { Lesson, User } from '@/api/types'
import { deriveCapabilities, hasConsoleAccess, homeFor, lessonRules } from './permissions'

const org = 'org-1'
const other = 'org-2'

function user(overrides: Partial<User>): User {
  return {
    id: 'u-1',
    email: 'u@test',
    name: 'U',
    platformRole: null,
    freelanceTeacher: false,
    status: 'ACTIVE',
    hasPassword: true,
    memberships: [],
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

const superAdmin = user({ id: 'root', platformRole: 'SUPER_ADMIN' })
const admin = user({
  id: 'admin',
  memberships: [
    { organizationId: org, organizationName: 'School', organizationSlug: 'school', role: 'ADMIN' },
  ],
})
const teacherOnly = user({
  id: 'teacher',
  memberships: [
    {
      organizationId: org,
      organizationName: 'School',
      organizationSlug: 'school',
      role: 'TEACHER',
    },
  ],
})

describe('console access and home', () => {
  it('admits super-admins and organization admins only', () => {
    expect(hasConsoleAccess(superAdmin)).toBe(true)
    expect(hasConsoleAccess(admin)).toBe(true)
    expect(hasConsoleAccess(teacherOnly)).toBe(false)
    expect(hasConsoleAccess(null)).toBe(false)
  })

  it('sends each role to its home', () => {
    expect(homeFor(superAdmin)).toBe('/platform')
    expect(homeFor(admin)).toBe(`/org/${org}`)
    expect(homeFor(teacherOnly)).toBe('/no-access')
    const twoOrgs = user({
      memberships: [
        { organizationId: org, organizationName: 'A', organizationSlug: 'a', role: 'ADMIN' },
        { organizationId: other, organizationName: 'B', organizationSlug: 'b', role: 'ADMIN' },
      ],
    })
    expect(homeFor(twoOrgs)).toBe('/org')
  })
})

describe('deriveCapabilities', () => {
  it('gives the super-admin everything', () => {
    const caps = deriveCapabilities(superAdmin, org)
    expect(caps.isSuperAdmin).toBe(true)
    expect(caps.canManageOrganizations).toBe(true)
    expect(caps.canManageAdmins).toBe(true)
    expect(caps.canManageLessons).toBe(true)
    expect(caps.canEditStatus).toBe(true)
    expect(caps.canEditEmail(teacherOnly)).toBe(true)
    expect(caps.canDeleteAccount(teacherOnly)).toBe(true)
    expect(caps.canDeleteAccount(superAdmin)).toBe(false)
    expect(caps.deleteAccountDisabledReason(superAdmin)).toMatch(/own account/)
  })

  it('scopes an admin to their organization and hides platform-only actions', () => {
    const inOwnOrg = deriveCapabilities(admin, org)
    expect(inOwnOrg.isOrgAdmin).toBe(true)
    expect(inOwnOrg.canManageTeachers).toBe(true)
    expect(inOwnOrg.canManageAdmins).toBe(false)
    expect(inOwnOrg.canManageLessons).toBe(false)
    expect(inOwnOrg.canManageFreelance).toBe(false)
    expect(inOwnOrg.canEditStatus).toBe(false)
    expect(inOwnOrg.canEditEmail(teacherOnly)).toBe(false)
    expect(inOwnOrg.canEditUser(teacherOnly)).toBe(true)
    expect(inOwnOrg.canDeleteAccount(teacherOnly)).toBe(true)

    const elsewhere = deriveCapabilities(admin, other)
    expect(elsewhere.isOrgAdmin).toBe(false)
    expect(elsewhere.canManageTeachers).toBe(false)
  })

  it('does not let an admin edit or delete a user who also belongs to another organization', () => {
    const shared = user({
      id: 'shared',
      memberships: [
        { organizationId: org, organizationName: 'A', organizationSlug: 'a', role: 'TEACHER' },
        { organizationId: other, organizationName: 'B', organizationSlug: 'b', role: 'TEACHER' },
      ],
    })
    const caps = deriveCapabilities(admin, org)
    expect(caps.canEditUser(shared)).toBe(false)
    expect(caps.canDeleteAccount(shared)).toBe(false)
    expect(caps.deleteAccountDisabledReason(shared)).toMatch(/do not administer/)
    expect(caps.canEditUser(admin)).toBe(true)
    expect(caps.canEditEmail(admin)).toBe(true)
  })

  it('never removes the caller’s own ADMIN membership', () => {
    const caps = deriveCapabilities(admin, org)
    expect(caps.canRemoveMembership({ userId: 'admin', organizationId: org, role: 'ADMIN' })).toBe(
      false,
    )
    expect(
      caps.canRemoveMembership({ userId: 'admin', organizationId: org, role: 'TEACHER' }),
    ).toBe(true)
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
})

describe('lessonRules', () => {
  const base: Pick<Lesson, 'status' | 'scheduledAt' | 'paid'> = {
    status: 'PENDING',
    scheduledAt: '2030-01-01T10:00:00Z',
    paid: false,
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
    expect(lessonRules.canDelete({ ...base, paid: true })).toBe(false)
    expect(lessonRules.deleteDisabledReason({ ...base, paid: true })).toMatch(/Paid/)
    expect(lessonRules.deleteDisabledReason({ ...base, status: 'CANCELED' })).toMatch(/history/)
    expect(lessonRules.canSchedule({ status: 'CANCELED_LATE' })).toBe(false)
  })
})
