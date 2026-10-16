import type { Lesson, MembershipSummary, User } from '@/api/types'

/**
 * What the signed-in user may do, derived from `GET /users/me` and the organization in the URL.
 * Components read these flags, never raw roles. The server stays the authority: every `403` and
 * `404` is still handled where it happens.
 *
 * Console rules narrower than the API: org admins never manage other admins, organizations,
 * freelance teachers or lessons here (the API would allow some of it).
 */
export interface Capabilities {
  isSuperAdmin: boolean
  /** ADMIN in the current organization (always true for the super-admin). */
  isOrgAdmin: boolean
  /** Organizations where the user holds ADMIN. */
  adminOrgIds: string[]
  canManageOrganizations: boolean
  canChangeOrgStatus: boolean
  canEditOrganization: boolean
  canManageAdmins: boolean
  canManageTeachers: boolean
  canManageStudents: boolean
  canManageCourses: boolean
  canReassignCourse: boolean
  canManageInvites: boolean
  canManageLessons: boolean
  canManageFreelance: boolean
  canSearchUsers: boolean
  canEditStatus: boolean
  canEditUser: (user: UserLike) => boolean
  canEditEmail: (user: UserLike) => boolean
  canDeleteAccount: (user: UserLike) => boolean
  deleteAccountDisabledReason: (user: UserLike) => string | null
  canRemoveMembership: (membership: MembershipLike) => boolean
  removeMembershipDisabledReason: (membership: MembershipLike) => string | null
  canSendResetLink: (user: Pick<User, 'hasPassword' | 'status'>) => boolean
}

export type UserLike = Pick<User, 'id' | 'memberships' | 'platformRole'>
export interface MembershipLike {
  userId: string
  organizationId: string
  role: MembershipSummary['role']
}

export function adminOrganizations(me: User | null | undefined): MembershipSummary[] {
  return (me?.memberships ?? []).filter((m) => m.role === 'ADMIN')
}

export function isSuperAdmin(me: User | null | undefined): boolean {
  return me?.platformRole === 'SUPER_ADMIN'
}

/** Super-admins and users with at least one ADMIN membership may use the console. */
export function hasConsoleAccess(me: User | null | undefined): boolean {
  return isSuperAdmin(me) || adminOrganizations(me).length > 0
}

/** Where `/` sends the user. */
export function homeFor(me: User | null | undefined): string {
  if (isSuperAdmin(me)) return '/platform'
  const orgs = adminOrganizations(me)
  if (orgs.length === 1) return `/org/${orgs[0]!.organizationId}`
  if (orgs.length > 1) return '/org'
  return '/no-access'
}

export function deriveCapabilities(
  me: User | null | undefined,
  orgId?: string | null,
): Capabilities {
  const superAdmin = isSuperAdmin(me)
  const adminOrgIds = adminOrganizations(me).map((m) => m.organizationId)
  const isOrgAdmin = superAdmin || (!!orgId && adminOrgIds.includes(orgId))
  const self = (user: UserLike) => !!me && user.id === me.id
  /** An admin covers a user when every membership of that user is in an organization the admin administers. */
  const covers = (user: UserLike) =>
    user.memberships.length > 0 &&
    user.memberships.every((m) => adminOrgIds.includes(m.organizationId))

  const deleteAccountDisabledReason = (user: UserLike): string | null => {
    if (self(user)) return 'You cannot delete your own account.'
    if (user.platformRole === 'SUPER_ADMIN') return 'The platform owner account cannot be deleted.'
    if (superAdmin) return null
    if (!covers(user)) {
      return 'This account also belongs to an organization you do not administer; only the platform owner can delete it.'
    }
    return null
  }

  const removeMembershipDisabledReason = (membership: MembershipLike): string | null => {
    if (!superAdmin && !adminOrgIds.includes(membership.organizationId)) {
      return 'Only an admin of this organization can remove members.'
    }
    if (!!me && membership.userId === me.id && membership.role === 'ADMIN') {
      return 'You cannot remove your own admin membership.'
    }
    return null
  }

  return {
    isSuperAdmin: superAdmin,
    isOrgAdmin,
    adminOrgIds,
    canManageOrganizations: superAdmin,
    canChangeOrgStatus: superAdmin,
    canEditOrganization: isOrgAdmin,
    canManageAdmins: superAdmin,
    canManageTeachers: isOrgAdmin,
    canManageStudents: isOrgAdmin,
    canManageCourses: isOrgAdmin,
    canReassignCourse: isOrgAdmin,
    canManageInvites: isOrgAdmin,
    canManageLessons: superAdmin,
    canManageFreelance: superAdmin,
    canSearchUsers: superAdmin,
    canEditStatus: superAdmin,
    canEditUser: (user) => self(user) || superAdmin || covers(user),
    canEditEmail: (user) => self(user) || superAdmin,
    canDeleteAccount: (user) => deleteAccountDisabledReason(user) === null,
    deleteAccountDisabledReason,
    canRemoveMembership: (membership) => removeMembershipDisabledReason(membership) === null,
    removeMembershipDisabledReason,
    canSendResetLink: (user) => user.hasPassword && user.status === 'ACTIVE',
  }
}

// --- lessons (API.md §9.1): pure predicates of the lesson state ------------------------------

export type LessonDisplayStatus = 'upcoming' | 'credit' | 'held' | 'canceled' | 'canceled_late'

export const lessonRules = {
  displayStatus(lesson: Pick<Lesson, 'status' | 'scheduledAt'>): LessonDisplayStatus {
    switch (lesson.status) {
      case 'PRESENT':
        return 'held'
      case 'CANCELED':
        return 'canceled'
      case 'CANCELED_LATE':
        return 'canceled_late'
      default:
        return lesson.scheduledAt === null ? 'credit' : 'upcoming'
    }
  },
  canSchedule: (lesson: Pick<Lesson, 'status'>) => lesson.status === 'PENDING',
  scheduleDisabledReason: (lesson: Pick<Lesson, 'status'>) =>
    lesson.status === 'PENDING'
      ? null
      : 'Closed lessons keep their date; only pending lessons can be rescheduled.',
  canClose: (lesson: Pick<Lesson, 'status' | 'scheduledAt'>) =>
    lesson.status === 'PENDING' && lesson.scheduledAt !== null,
  closeDisabledReason: (lesson: Pick<Lesson, 'status' | 'scheduledAt'>) => {
    if (lesson.status !== 'PENDING') return 'This lesson is already closed.'
    if (lesson.scheduledAt === null) return 'Schedule the lesson before closing it.'
    return null
  },
  canEditJournal: (lesson: Pick<Lesson, 'status'>) => lesson.status !== 'PENDING',
  journalDisabledReason: (lesson: Pick<Lesson, 'status'>) =>
    lesson.status === 'PENDING' ? 'The journal is written when the lesson is closed.' : null,
  canDelete: (lesson: Pick<Lesson, 'status' | 'paid'>) =>
    lesson.status === 'PENDING' && !lesson.paid,
  deleteDisabledReason: (lesson: Pick<Lesson, 'status' | 'paid'>) => {
    if (lesson.status !== 'PENDING')
      return 'Closed lessons are kept as history and cannot be deleted.'
    if (lesson.paid)
      return 'Paid lessons cannot be deleted. Mark it unpaid first if it was never paid.'
    return null
  },
}
