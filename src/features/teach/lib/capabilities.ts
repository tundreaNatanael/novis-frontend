import type { User } from '@/api/types'
import { teacherPlace, type TeacherPlace } from '@/lib/permissions'

/**
 * What the signed-in teacher may do, derived from their role (roles are only read, never sent;
 * the mobile app's `capabilitiesOf`). Screens drive actions from these flags and display from the
 * data: payment fields the API sends as `null` render nothing, so a `null` never reads as "unpaid".
 */
export interface TeachCapabilities {
  /** Where the teacher works: their school, or freelance. */
  place: TeacherPlace
  /**
   * Mark lessons paid / unpaid, add prepaid credits, book without using a credit and list unpaid
   * lessons. Only freelance teachers, who have no admin: a school's payments are recorded by its
   * admin in the admin console, and the API answers an org teacher `403` / `400`.
   */
  canManageStudentPayments: boolean
  /**
   * See the payouts from the school (what it paid the teacher for their lessons): the Payments
   * page, Today's tile and the Profile row. Only a teacher of an organization: a freelance teacher
   * has no payer, and the API answers anyone else `404`.
   */
  canViewPayouts: boolean
  /**
   * Create, edit and archive courses: the Courses tab, New course, Edit and Archive. Only freelance
   * teachers, who have no admin: a school's admin creates its courses in the admin console and
   * assigns them, and the API answers an org teacher `403`. An org teacher still opens an assigned
   * course from a student's page to enroll students and add materials.
   */
  canManageCourses: boolean
}

export function teachCapabilities(me: User): TeachCapabilities {
  const place = teacherPlace(me) ?? { kind: 'freelance', organization: null }
  return {
    place,
    canManageStudentPayments: me.role === 'FREELANCE_TEACHER',
    canViewPayouts: me.role === 'TEACHER' && place.kind === 'org',
    canManageCourses: me.role === 'FREELANCE_TEACHER',
  }
}
