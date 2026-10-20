import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { Link, Outlet, useParams } from 'react-router'
import { isApiError } from '@/api/errors'
import { freelanceTeacherKeys, freelanceTeachersApi } from '@/api/freelance-teachers'
import type { RouteHandle } from '@/app/route-handle'
import { PageSkeleton } from '@/app/shell/app-shell'
import { useMe } from '@/auth/session'
import { ErrorState } from '@/components/data/error-state'
import { IdValue } from '@/components/detail/detail-panel'
import { NavTabs } from '@/components/nav-tabs'
import { PageHeader } from '@/components/page-header'
import { StatusBadge } from '@/components/status-badge'
import type { FreelanceWorkspaceContext } from '@/features/org-workspace/use-org-workspace'
import { deriveCapabilities } from '@/lib/permissions'
import { usePageTitle } from '@/lib/use-page-title'
import { FreelanceTeacherCrumb } from './components/freelance-teacher-crumb'

export const handle: RouteHandle = {
  crumb: (params) => <FreelanceTeacherCrumb teacherId={params.teacherId} />,
}

/**
 * The freelance-teacher workspace (super-admin only): profile, their students, courses and
 * lessons. It loads `GET /freelance-teachers/{id}`, which answers `404` for any id that is not a
 * live freelance teacher (an org member, a student, a deleted account): that is a not-found page.
 */
export function Component() {
  const { teacherId = '' } = useParams<{ teacherId: string }>()
  const me = useMe()
  const capabilities = useMemo(() => deriveCapabilities(me), [me])
  const basePath = `/platform/freelance/${teacherId}`
  const teacherQuery = useQuery({
    queryKey: freelanceTeacherKeys.detail(teacherId),
    queryFn: ({ signal }) => freelanceTeachersApi.get(teacherId, signal),
  })
  usePageTitle(teacherQuery.data?.name ?? (teacherQuery.isError ? 'Not found' : undefined))

  if (teacherQuery.isPending) return <PageSkeleton />
  if (teacherQuery.isError) {
    if (isApiError(teacherQuery.error) && teacherQuery.error.isNotFound) return <TeacherNotFound />
    return <ErrorState error={teacherQuery.error} onRetry={() => void teacherQuery.refetch()} />
  }
  const teacher = teacherQuery.data
  const context: FreelanceWorkspaceContext = {
    kind: 'freelance',
    teacher,
    teacherId,
    basePath,
    capabilities,
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={teacher.name}
        badge={<StatusBadge value={teacher.status} />}
        meta={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>{teacher.email}</span>
            <IdValue value={teacher.id} />
          </span>
        }
      />
      <NavTabs
        label="Freelance teacher sections"
        items={[
          { label: 'Profile', to: basePath, end: true },
          { label: 'Students', to: `${basePath}/students` },
          { label: 'Courses', to: `${basePath}/courses` },
          { label: 'Lessons', to: `${basePath}/lessons` },
        ]}
      />
      <Outlet context={context} />
    </div>
  )
}

function TeacherNotFound() {
  return (
    <section
      aria-labelledby="freelance-not-found"
      className="flex flex-col items-center justify-center gap-3 rounded-lg border border-border bg-card px-6 py-12 text-center"
    >
      <p className="font-mono text-sm text-muted-foreground">404</p>
      <h1 id="freelance-not-found" className="text-xl font-semibold text-foreground">
        No freelance teacher here
      </h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        This account does not exist, was deleted, or is not a freelance teacher. Organization staff
        and students are found in their organization.
      </p>
      <Link
        to="/platform/freelance"
        className="mt-2 rounded-sm bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
      >
        Back to freelance teachers
      </Link>
    </section>
  )
}
