import { useQueries } from '@tanstack/react-query'
import { ArrowRight, Building2 } from 'lucide-react'
import { Link, Navigate } from 'react-router'
import { memberKeys, membersApi } from '@/api/members'
import type { RouteHandle } from '@/app/route-handle'
import { useMe } from '@/auth/session'
import { BrandMark, StaveRule } from '@/components/brand-mark'
import { PageHeader } from '@/components/page-header'
import { adminOrganizations, homeFor } from '@/lib/permissions'
import { usePageTitle } from '@/lib/use-page-title'

export const handle: RouteHandle = {
  crumb: () => 'Choose an organization',
  title: 'Choose an organization',
}

const COUNT = { page: 0, size: 1 }

/**
 * `/org`: admins of several organizations pick one. A single-organization admin never lands here
 * (`homeFor` sends them straight to `/org/:orgId`); the super-admin uses `/platform`.
 */
export function Component() {
  const me = useMe()
  const orgs = adminOrganizations(me)
  usePageTitle('Choose an organization')
  const counts = useQueries({
    queries: orgs.flatMap((org) =>
      (['TEACHER', 'STUDENT'] as const).map((role) => ({
        queryKey: memberKeys.list(org.organizationId, role, COUNT),
        queryFn: ({ signal }: { signal: AbortSignal }) =>
          membersApi.list(org.organizationId, role, COUNT, signal),
        staleTime: 60_000,
        select: (page: { totalElements: number }) => page.totalElements,
      })),
    ),
  })

  if (orgs.length < 2) return <Navigate to={homeFor(me)} replace />

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <PageHeader
        title={`Welcome, ${me.name}`}
        description="You administer several schools. Choose the one to work in; you can switch at any time from the top bar."
      />
      <ul className="grid gap-3 sm:grid-cols-2" aria-label="Your organizations">
        {orgs.map((org, index) => {
          const teachers = counts[index * 2]?.data
          const students = counts[index * 2 + 1]?.data
          return (
            <li key={org.organizationId}>
              <Link
                to={`/org/${org.organizationId}`}
                className="group flex h-full flex-col gap-3 rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                <span className="flex items-center gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <Building2 className="size-5" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-card-foreground">
                      {org.organizationName}
                    </span>
                    <span className="block truncate font-mono text-xs text-muted-foreground">
                      {org.organizationSlug}
                    </span>
                  </span>
                  <ArrowRight
                    className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                    aria-hidden
                  />
                </span>
                <StaveRule className="opacity-60" />
                <span className="flex gap-4 text-sm text-muted-foreground">
                  <span>
                    <span className="font-medium text-foreground tabular-nums">
                      {teachers ?? '…'}
                    </span>{' '}
                    teachers
                  </span>
                  <span>
                    <span className="font-medium text-foreground tabular-nums">
                      {students ?? '…'}
                    </span>{' '}
                    students
                  </span>
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <span aria-hidden>
          <BrandMark className="size-4" />
        </span>
        Only organizations where you are an administrator are listed.
      </p>
    </div>
  )
}
