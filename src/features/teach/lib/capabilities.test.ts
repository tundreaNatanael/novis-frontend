import { describe, expect, it } from 'vitest'
import { freelanceTeacher, orgAdmin, superAdmin, user, userOrganization } from '@/test/fixtures'
import { hasAppAccess, homeFor, isTeacher, teacherPlace } from '@/lib/permissions'
import { teachCapabilities } from './capabilities'

describe('teacher access (D-051)', () => {
  it('opens the workspace to a teacher of an active organization and to a freelance teacher', () => {
    expect(isTeacher(user())).toBe(true)
    expect(teacherPlace(user())).toEqual({ kind: 'org', organization: userOrganization() })
    expect(isTeacher(freelanceTeacher())).toBe(true)
    expect(teacherPlace(freelanceTeacher())).toEqual({ kind: 'freelance', organization: null })
    expect(homeFor(user())).toBe('/teach')
    expect(homeFor(freelanceTeacher())).toBe('/teach')
  })

  it('keeps admins, students, role-less accounts and teachers of archived organizations out', () => {
    expect(isTeacher(superAdmin)).toBe(false)
    expect(isTeacher(orgAdmin('org-1'))).toBe(false)
    expect(isTeacher(user({ role: 'STUDENT', hasPassword: false }))).toBe(false)
    expect(isTeacher(user({ role: null, organization: null }))).toBe(false)
    const archived = user({ organization: userOrganization({ status: 'ARCHIVED' }) })
    expect(isTeacher(archived)).toBe(false)
    expect(hasAppAccess(archived)).toBe(false)
    expect(homeFor(archived)).toBe('/no-access')
    expect(homeFor(orgAdmin('org-1'))).toBe('/org/org-1')
  })
})

describe('teachCapabilities', () => {
  it('lets only a freelance teacher manage payments, and only an org teacher see payouts', () => {
    const freelance = teachCapabilities(freelanceTeacher())
    expect(freelance.canManageStudentPayments).toBe(true)
    expect(freelance.canViewPayouts).toBe(false)
    expect(freelance.place.kind).toBe('freelance')

    const org = teachCapabilities(user())
    expect(org.canManageStudentPayments).toBe(false)
    expect(org.canViewPayouts).toBe(true)
    expect(org.place).toEqual({ kind: 'org', organization: userOrganization() })
  })

  it('lets only a freelance teacher create and edit courses: a school’s admin assigns them', () => {
    expect(teachCapabilities(freelanceTeacher()).canManageCourses).toBe(true)
    expect(teachCapabilities(user()).canManageCourses).toBe(false)
  })
})
