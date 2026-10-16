import { useQuery } from '@tanstack/react-query'
import { ArrowRight, Building2, CalendarDays, Plus, UserRound } from 'lucide-react'
import { Link } from 'react-router'
import { courseKeys, coursesApi } from '@/api/courses'
import { lessonKeys, lessonsApi } from '@/api/lessons'
import { orgKeys, orgsApi } from '@/api/orgs'
import { studentKeys, studentsApi } from '@/api/students'
import type { RouteHandle } from '@/app/route-handle'
import { useMe } from '@/auth/session'
import { PageHeader } from '@/components/page-header'
import { StatusBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDate } from '@/lib/format'
import { usePageTitle } from '@/lib/use-page-title'

export const handle: RouteHandle = { crumb: () => 'Overview', title: 'Overview' }

const ONE = { page: 0, size: 1 }
const RECENT = { page: 0, size: 5, sort: 'createdAt,desc' }

export function Component() {
  usePageTitle('Overview')
  const me = useMe()
  const orgs = useQuery({
    queryKey: orgKeys.list(ONE),
    queryFn: ({ signal }) => orgsApi.list(ONE, signal),
    select: (p) => p.totalElements,
  })
  const students = useQuery({
    queryKey: studentKeys.list({}, ONE),
    queryFn: ({ signal }) => studentsApi.list({}, ONE, signal),
    select: (p) => p.totalElements,
  })
  const courses = useQuery({
    queryKey: courseKeys.list({}, ONE),
    queryFn: ({ signal }) => coursesApi.list({}, ONE, signal),
    select: (p) => p.totalElements,
  })
  const lessons = useQuery({
    queryKey: lessonKeys.list({}, ONE),
    queryFn: ({ signal }) => lessonsApi.list({}, ONE, signal),
    select: (p) => p.totalElements,
  })
  const recent = useQuery({
    queryKey: orgKeys.list(RECENT),
    queryFn: ({ signal }) => orgsApi.list(RECENT, signal),
  })

  const counts = [
    { label: 'Organizations', query: orgs, to: '/platform/orgs' },
    { label: 'Students', query: students, to: '/platform/orgs' },
    { label: 'Courses', query: courses, to: '/platform/orgs' },
    { label: 'Lessons', query: lessons, to: '/platform/lessons' },
  ]

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`Welcome, ${me.name.split(' ')[0] ?? me.name}`}
        description="The platform at a glance. Counts come from the API's page totals."
        actions={
          <Button asChild>
            <Link to="/platform/orgs?new=1">
              <Plus aria-hidden />
              New organization
            </Link>
          </Button>
        }
      />
      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Platform counts">
        {counts.map((count) => (
          <li key={count.label}>
            <Link
              to={count.to}
              className="flex h-full flex-col gap-1 rounded-lg border border-border bg-card p-4 hover:border-primary/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <span className="text-xs text-muted-foreground">{count.label}</span>
              {count.query.isPending ? (
                <Skeleton className="h-8 w-12" />
              ) : count.query.isError ? (
                <span className="text-sm text-destructive">Unavailable</span>
              ) : (
                <span className="text-3xl font-semibold text-card-foreground tabular-nums">
                  {count.query.data}
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <section
          className="min-w-0 rounded-lg border border-border bg-card"
          aria-labelledby="recent-orgs"
        >
          <header className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 id="recent-orgs" className="text-sm font-semibold text-card-foreground">
              Recently created organizations
            </h2>
            <Button asChild variant="ghost" size="sm">
              <Link to="/platform/orgs">
                All organizations
                <ArrowRight aria-hidden />
              </Link>
            </Button>
          </header>
          {recent.isPending ? (
            <div className="flex flex-col gap-3 p-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-5 w-2/3" />
              ))}
            </div>
          ) : recent.isError || recent.data.content.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">
              No organizations yet. Create the first school to get started.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {recent.data.content.map((org) => (
                <li key={org.id}>
                  <Link
                    to={`/platform/orgs/${org.id}`}
                    className="flex min-h-11 items-center justify-between gap-3 px-4 py-2 text-sm hover:bg-accent/60"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-card-foreground">
                        {org.name}
                      </span>
                      <span className="block truncate font-mono text-xs text-muted-foreground">
                        {org.slug}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-3">
                      <StatusBadge value={org.status} />
                      <span className="hidden text-xs text-muted-foreground tabular-nums sm:inline">
                        {formatDate(org.createdAt)}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section
          className="min-w-0 rounded-lg border border-border bg-card"
          aria-labelledby="shortcuts"
        >
          <header className="border-b border-border px-4 py-3">
            <h2 id="shortcuts" className="text-sm font-semibold text-card-foreground">
              Shortcuts
            </h2>
          </header>
          <ul className="divide-y divide-border text-sm">
            {[
              {
                to: '/platform/orgs',
                icon: Building2,
                label: 'Organizations',
                hint: 'Schools, their admins, teachers, students and courses',
              },
              {
                to: '/platform/freelance',
                icon: UserRound,
                label: 'Freelance teachers',
                hint: 'Teachers without an organization and their students',
              },
              {
                to: '/platform/lessons',
                icon: CalendarDays,
                label: 'Lesson ledger',
                hint: 'Every lesson, with payment status',
              },
            ].map((item) => (
              <li key={item.to}>
                <Link
                  to={item.to}
                  className="flex min-h-11 items-center gap-3 px-4 py-2 hover:bg-accent/60"
                >
                  <item.icon className="size-4 text-muted-foreground" aria-hidden />
                  <span className="min-w-0">
                    <span className="block font-medium text-card-foreground">{item.label}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {item.hint}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  )
}
