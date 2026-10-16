import { useQuery } from '@tanstack/react-query'
import { courseKeys, coursesApi } from '@/api/courses'
import { memberKeys, membersApi } from '@/api/members'
import { orgKeys, orgsApi } from '@/api/orgs'
import { studentKeys, studentsApi } from '@/api/students'
import { userKeys, usersApi } from '@/api/users'
import type { SelectOption } from '@/components/form/select-field'

export const FREELANCE = 'freelance'
const LOOKUP = { page: 0, size: 100 }

/**
 * Options for the lesson filters and the create form, loaded in dependency order:
 * organization (or freelance) → teachers → students and courses of that teacher.
 */
export function useLessonFilterOptions(args: {
  org: string | undefined
  teacherId: string | undefined
  enabled?: boolean
}) {
  const enabled = args.enabled ?? true
  const orgId = args.org && args.org !== FREELANCE ? args.org : undefined
  const freelance = args.org === FREELANCE

  const orgs = useQuery({
    queryKey: orgKeys.list({ ...LOOKUP, sort: 'name,asc' }),
    queryFn: ({ signal }) => orgsApi.list({ ...LOOKUP, sort: 'name,asc' }, signal),
    enabled,
    staleTime: 60_000,
    select: (page): SelectOption[] =>
      page.content.map((o) => ({ value: o.id, label: o.name, description: o.slug })),
  })
  const orgTeachers = useQuery({
    queryKey: memberKeys.list(orgId ?? '', 'TEACHER', LOOKUP),
    queryFn: ({ signal }) => membersApi.list(orgId ?? '', 'TEACHER', LOOKUP, signal),
    enabled: enabled && !!orgId,
    staleTime: 60_000,
    select: (page): SelectOption[] =>
      page.content.map((m) => ({ value: m.userId, label: m.name, description: m.email })),
  })
  const freelancers = useQuery({
    queryKey: userKeys.list({ freelance: true }, { ...LOOKUP, sort: 'name,asc' }),
    queryFn: ({ signal }) =>
      usersApi.list({ freelance: true }, { ...LOOKUP, sort: 'name,asc' }, signal),
    enabled: enabled && freelance,
    staleTime: 60_000,
    select: (page): SelectOption[] =>
      page.content.map((u) => ({ value: u.id, label: u.name, description: u.email })),
  })
  const students = useQuery({
    queryKey: studentKeys.list(
      args.teacherId ? { teacherId: args.teacherId } : { organizationId: orgId },
      { ...LOOKUP, sort: 'name,asc' },
    ),
    queryFn: ({ signal }) =>
      studentsApi.list(
        args.teacherId ? { teacherId: args.teacherId } : { organizationId: orgId },
        { ...LOOKUP, sort: 'name,asc' },
        signal,
      ),
    enabled: enabled && (!!args.teacherId || !!orgId),
    staleTime: 60_000,
    select: (page): SelectOption[] =>
      page.content.map((s) => ({ value: s.id, label: s.name, description: s.email })),
  })
  const courses = useQuery({
    queryKey: courseKeys.list(
      args.teacherId ? { teacherId: args.teacherId } : { organizationId: orgId },
      { ...LOOKUP, sort: 'title,asc' },
    ),
    queryFn: ({ signal }) =>
      coursesApi.list(
        args.teacherId ? { teacherId: args.teacherId } : { organizationId: orgId },
        { ...LOOKUP, sort: 'title,asc' },
        signal,
      ),
    enabled: enabled && (!!args.teacherId || !!orgId),
    staleTime: 60_000,
    select: (page): SelectOption[] =>
      page.content.map((c) => ({
        value: c.id,
        label: c.title,
        description: c.status === 'ARCHIVED' ? 'Archived' : undefined,
      })),
  })

  const scopeOptions: SelectOption[] = [
    { value: FREELANCE, label: 'Freelance (no organization)' },
    ...(orgs.data ?? []),
  ]
  return {
    scopes: scopeOptions,
    scopesLoading: orgs.isPending,
    teachers: (freelance ? freelancers.data : orgTeachers.data) ?? [],
    teachersLoading: freelance ? freelancers.isPending : !!orgId && orgTeachers.isPending,
    teachersEnabled: freelance || !!orgId,
    students: students.data ?? [],
    studentsLoading: (!!args.teacherId || !!orgId) && students.isPending,
    studentsEnabled: !!args.teacherId || !!orgId,
    courses: courses.data ?? [],
    coursesLoading: (!!args.teacherId || !!orgId) && courses.isPending,
    coursesEnabled: !!args.teacherId || !!orgId,
  }
}
