import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { Outlet, useParams } from 'react-router'
import { userKeys, usersApi } from '@/api/users'
import type { RouteHandle } from '@/app/route-handle'
import { PageSkeleton } from '@/app/shell/app-shell'
import { useMe } from '@/auth/session'
import { ErrorState } from '@/components/data/error-state'
import { IdValue } from '@/components/detail/detail-panel'
import { NavTabs } from '@/components/nav-tabs'
import { PageHeader } from '@/components/page-header'
import { StatusBadge, ToneBadge } from '@/components/status-badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { UserCrumb } from '@/features/org-workspace/components/crumbs'
import type { FreelanceWorkspaceContext } from '@/features/org-workspace/use-org-workspace'
import { deriveCapabilities } from '@/lib/permissions'
import { usePageTitle } from '@/lib/use-page-title'

export const handle: RouteHandle = { crumb: (params) => <UserCrumb userId={params.teacherId} /> }

/** The freelance-teacher workspace: profile, their students, courses and lessons (super-admin only). */
export function Component() {
  const { teacherId = '' } = useParams<{ teacherId: string }>()
  const me = useMe()
  const capabilities = useMemo(() => deriveCapabilities(me), [me])
  const basePath = `/platform/freelance/${teacherId}`
  const teacherQuery = useQuery({
    queryKey: userKeys.detail(teacherId),
    queryFn: ({ signal }) => usersApi.get(teacherId, signal),
  })
  usePageTitle(teacherQuery.data?.name)

  if (teacherQuery.isPending) return <PageSkeleton />
  if (teacherQuery.isError)
    return <ErrorState error={teacherQuery.error} onRetry={() => void teacherQuery.refetch()} />
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
        badge={
          <>
            <StatusBadge value={teacher.status} />
            {teacher.freelanceTeacher ? <ToneBadge tone="neutral">Freelance</ToneBadge> : null}
          </>
        }
        meta={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>{teacher.email}</span>
            <IdValue value={teacher.id} />
          </span>
        }
      />
      {!teacher.freelanceTeacher ? (
        <Alert>
          <AlertDescription>
            This account is no longer marked as a freelance teacher; the lists below show their
            freelance data only.
          </AlertDescription>
        </Alert>
      ) : null}
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
