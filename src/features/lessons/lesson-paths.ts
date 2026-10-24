import type { Lesson, User } from '@/api/types'
import { useMe } from '@/auth/session'
import { adminOrganization } from '@/lib/permissions'
import { FREELANCE } from './hooks/use-lesson-filter-options'

/**
 * Where the lesson pages live for the signed-in user (D-040). The super-admin has one ledger and
 * one detail URL for every organization and freelance teacher (`/platform/lessons`, D-009); an
 * org admin has both inside their organization (`/org/:orgId/lessons`).
 */
export interface LessonPaths {
  ledger: string
  detail: (lessonId: string) => string
  /** The ledger narrowed to one lesson's teacher and student. */
  ledgerOf: (lesson: Pick<Lesson, 'organizationId' | 'teacherId' | 'studentId'>) => string
  /** The workspace that holds the lesson's teacher, student and course pages. */
  workspace: (lesson: Pick<Lesson, 'organizationId' | 'teacherId'>) => string
}

export function lessonPaths(me: User | null | undefined): LessonPaths {
  const org = adminOrganization(me)
  const ledger = org ? `/org/${org.id}/lessons` : '/platform/lessons'
  return {
    ledger,
    detail: (lessonId) => `${ledger}/${lessonId}`,
    ledgerOf: (lesson) => {
      const filters = new URLSearchParams({
        teacherId: lesson.teacherId,
        studentId: lesson.studentId,
      })
      // An org admin's ledger is already scoped to their organization.
      if (!org) filters.set('org', lesson.organizationId ?? FREELANCE)
      return `${ledger}?${filters.toString()}`
    },
    workspace: (lesson) => {
      if (org) return `/org/${org.id}`
      return lesson.organizationId
        ? `/platform/orgs/${lesson.organizationId}`
        : `/platform/freelance/${lesson.teacherId}`
    },
  }
}

/** {@link lessonPaths} for the signed-in user. */
export function useLessonPaths(): LessonPaths {
  return lessonPaths(useMe())
}
