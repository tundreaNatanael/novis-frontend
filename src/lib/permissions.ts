import type { Invite, Lesson, MembershipRole, User, UserOrganization } from '@/api/types'

/**
 * What the signed-in user may do, derived from `GET /users/me` and the organization in the URL.
 * Components read these flags, never raw roles. The server stays the authority: every `403` and
 * `404` is still handled where it happens.
 *
 * One account holds one role in one place: the super-admin (platform only), an ADMIN or TEACHER
 * of exactly one organization, a freelance teacher (no organization) or a student. Only the
 * super-admin and an ADMIN of an active organization use the console. Admin accounts and
 * freelance teachers are managed by the super-admin only; org admins never manage
 * organizations or lessons here either.
 */
export interface Capabilities {
  isSuperAdmin: boolean
  /** ADMIN in the current organization (always true for the super-admin). */
  isOrgAdmin: boolean
  /** The active organization the user administers (`null` for the super-admin and everyone else). */
  adminOrgId: string | null
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
  /** Resend / revoke of one invitation. */
  inviteActionDisabledReason: (invite: InviteLike) => string | null
  canSendResetLink: (user: Pick<User, 'hasPassword' | 'status'>) => boolean
}

export type UserLike = Pick<User, 'id' | 'role' | 'organization'>
export interface MembershipLike {
  userId: string
  organizationId: string
  role: MembershipRole
}
export type InviteLike = Pick<Invite, 'organizationId' | 'role'>

export function isSuperAdmin(me: User | null | undefined): boolean {
  return me?.role === 'SUPER_ADMIN'
}

/** The organization an ADMIN runs, or `null` (not an admin, or the organization is archived). */
export function adminOrganization(me: User | null | undefined): UserOrganization | null {
  return me?.role === 'ADMIN' && me.organization?.status === 'ACTIVE' ? me.organization : null
}

/** The role the user's one membership grants (`null` without a membership). */
export function membershipRoleOf(user: Pick<User, 'role' | 'organization'>): MembershipRole | null {
  if (!user.organization) return null
  return user.role === 'ADMIN' || user.role === 'TEACHER' || user.role === 'STUDENT'
    ? user.role
    : null
}

/** The super-admin and the admin of an active organization may use the console. */
export function hasConsoleAccess(me: User | null | undefined): boolean {
  return isSuperAdmin(me) || adminOrganization(me) !== null
}

/** Where `/` sends the user. */
export function homeFor(me: User | null | undefined): string {
  if (isSuperAdmin(me)) return '/platform'
  const org = adminOrganization(me)
  return org ? `/org/${org.id}` : '/no-access'
}

export function deriveCapabilities(
  me: User | null | undefined,
  orgId?: string | null,
): Capabilities {
  const superAdmin = isSuperAdmin(me)
  const adminOrgId = adminOrganization(me)?.id ?? null
  const isOrgAdmin = superAdmin || (!!orgId && adminOrgId === orgId)
  const self = (user: UserLike) => !!me && user.id === me.id
  /** An admin covers the teachers and students of their own organization, never another admin. */
  const covers = (user: UserLike) =>
    adminOrgId !== null && user.organization?.id === adminOrgId && user.role !== 'ADMIN'

  const deleteAccountDisabledReason = (user: UserLike): string | null => {
    if (self(user)) return 'You cannot delete your own account.'
    if (user.role === 'SUPER_ADMIN') return 'The platform owner account cannot be deleted.'
    if (superAdmin) return null
    if (user.role === 'ADMIN') return 'Only the platform owner can delete an admin account.'
    if (!covers(user)) return 'Only an admin of this account’s organization can delete it.'
    return null
  }

  const removeMembershipDisabledReason = (membership: MembershipLike): string | null => {
    if (!superAdmin && membership.organizationId !== adminOrgId) {
      return 'Only an admin of this organization can remove members.'
    }
    if (!!me && membership.userId === me.id && membership.role === 'ADMIN') {
      return 'You cannot remove your own admin membership.'
    }
    if (!superAdmin && membership.role === 'ADMIN') {
      return 'Only the platform owner can remove an admin.'
    }
    return null
  }

  const inviteActionDisabledReason = (invite: InviteLike): string | null => {
    if (superAdmin) return null
    if (invite.organizationId === null || invite.organizationId !== adminOrgId) {
      return 'Only an admin of this organization can manage its invitations.'
    }
    if (invite.role === 'ADMIN') return 'Only the platform owner manages admin invitations.'
    return null
  }

  return {
    isSuperAdmin: superAdmin,
    isOrgAdmin,
    adminOrgId,
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
    inviteActionDisabledReason,
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
