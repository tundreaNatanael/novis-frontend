import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { CalendarDays, List, Plus } from 'lucide-react'
import { useNavigate } from 'react-router'
import { lessonKeys, lessonsApi } from '@/api/lessons'
import type { Lesson } from '@/api/types'
import { useMe } from '@/auth/session'
import { columnHelper, DataTable } from '@/components/data/data-table'
import { EmptyState } from '@/components/data/empty-state'
import { ErrorState } from '@/components/data/error-state'
import { Pagination } from '@/components/data/pagination'
import { Button } from '@/components/ui/button'
import { formatDateTime, shortId } from '@/lib/format'
import { deriveCapabilities } from '@/lib/permissions'
import { useListParams } from '@/lib/use-list-params'
import { cn } from '@/lib/utils'
import { useLessonNames, type LessonNames } from '../hooks/use-lesson-names'
import { useLessonPaths } from '../lesson-paths'
import { CreateLessonSheet } from './create-lesson-sheet'
import { LessonAgenda } from './lesson-agenda'
import { LessonStatusBadge, PaidBadge } from './lesson-badges'
import { lessonFiltersFromParams } from './lesson-filter-params'
import { LessonFilters, type FixedScope } from './lesson-filters'

const col = columnHelper<Lesson>()

function columns(names: LessonNames, fixed: FixedScope, showPayment: boolean) {
  return [
    col.accessor('scheduledAt', {
      header: 'When',
      cell: (info) =>
        info.getValue() ? (
          <span className="text-foreground tabular-nums">{formatDateTime(info.getValue())}</span>
        ) : (
          <span className="text-muted-foreground italic">Not scheduled</span>
        ),
      meta: { className: 'w-44' },
    }),
    col.accessor('status', {
      header: 'Status',
      cell: (info) => <LessonStatusBadge lesson={info.row.original} />,
    }),
    ...(showPayment
      ? [
          // The column id doubles as the server sort key (`sort=paidAt`, payment managers only).
          col.accessor((lesson) => lesson.studentPayment?.paidAt ?? null, {
            id: 'paidAt',
            header: 'Payment',
            cell: (info) => <PaidBadge lesson={info.row.original} />,
          }),
        ]
      : []),
    col.display({
      id: 'student',
      header: 'Student',
      cell: (info) => (
        <span className="font-medium text-foreground">
          {names.student(info.row.original.studentId)?.name ?? shortId(info.row.original.studentId)}
        </span>
      ),
    }),
    ...(fixed.teacherId
      ? []
      : [
          col.display({
            id: 'teacher',
            header: 'Teacher',
            cell: (info) => (
              <span className="text-muted-foreground">
                {names.teacher(info.row.original.teacherId)?.name ??
                  shortId(info.row.original.teacherId)}
              </span>
            ),
          }),
        ]),
    col.display({
      id: 'course',
      meta: { className: 'hidden lg:table-cell', headerClassName: 'hidden lg:table-cell' },
      header: 'Course',
      cell: (info) => {
        const id = info.row.original.courseId
        return (
          <span className="text-muted-foreground">
            {id ? (names.course(id)?.title ?? shortId(id)) : '—'}
          </span>
        )
      },
    }),
    ...(fixed.organizationId || fixed.teacherId
      ? []
      : [
          col.display({
            id: 'organization',
            meta: { className: 'hidden lg:table-cell', headerClassName: 'hidden lg:table-cell' },
            header: 'Organization',
            cell: (info) => {
              const id = info.row.original.organizationId
              return (
                <span className="text-muted-foreground">
                  {id ? (names.organization(id)?.name ?? shortId(id)) : 'Freelance'}
                </span>
              )
            },
          }),
        ]),
  ]
}

/**
 * The lesson ledger (`GET /lessons`) with every filter, as a table or a day-grouped agenda.
 * `fixed` pins an organization (org tab) or a teacher (freelance tab).
 */
export function LessonLedger({ fixed }: { fixed: FixedScope }) {
  const navigate = useNavigate()
  const paths = useLessonPaths()
  const { canManageStudentPayments } = deriveCapabilities(useMe(), fixed.organizationId)
  const params = useListParams({ sort: 'scheduledAt,asc' })
  const filters = lessonFiltersFromParams(params, fixed)
  const view = params.filter('view') === 'agenda' ? 'agenda' : 'table'

  const query = useQuery({
    queryKey: lessonKeys.list(filters, params.pageParams),
    queryFn: ({ signal }) => lessonsApi.list(filters, params.pageParams, signal),
    placeholderData: keepPreviousData,
  })
  const lessons = query.data?.content ?? []
  const names = useLessonNames(lessons)

  const create = (
    <Button onClick={() => params.setFlag('new', 1)}>
      <Plus aria-hidden />
      New lesson
    </Button>
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div
          className="inline-flex rounded-md border border-border bg-card p-0.5"
          role="group"
          aria-label="View"
        >
          {(
            [
              ['table', 'Table', List],
              ['agenda', 'Agenda', CalendarDays],
            ] as const
          ).map(([value, label, Icon]) => (
            <Button
              key={value}
              type="button"
              variant="ghost"
              size="sm"
              aria-pressed={view === value}
              onClick={() =>
                params.set({ view: value === 'table' ? null : value, page: params.page || null })
              }
              className={cn('gap-1.5', view === value && 'bg-accent text-accent-foreground')}
            >
              <Icon aria-hidden />
              {label}
            </Button>
          ))}
        </div>
        {create}
      </div>
      <LessonFilters params={params} fixed={fixed} showPayment={canManageStudentPayments} />
      {query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : view === 'table' ? (
        <DataTable
          caption="Lessons"
          columns={columns(names, fixed, canManageStudentPayments)}
          data={lessons}
          total={query.data?.totalElements ?? 0}
          page={params.page}
          size={params.size}
          onPageChange={params.setPage}
          onSizeChange={params.setSize}
          sort={params.sort}
          onSortChange={params.setSort}
          getRowId={(l) => l.id}
          rowHref={(l) => paths.detail(l.id)}
          isLoading={query.isPending}
          isFetching={query.isFetching}
          renderMobileRow={(l) => (
            <div className="flex flex-col gap-1">
              <div className="flex items-start justify-between gap-2">
                <p className="font-medium text-foreground tabular-nums">
                  {l.scheduledAt ? formatDateTime(l.scheduledAt) : 'Not scheduled'}
                </p>
                <LessonStatusBadge lesson={l} />
              </div>
              <p className="truncate text-sm text-muted-foreground">
                {names.student(l.studentId)?.name ?? shortId(l.studentId)} with{' '}
                {names.teacher(l.teacherId)?.name ?? shortId(l.teacherId)}
              </p>
              <PaidBadge lesson={l} />
            </div>
          )}
          emptyState={
            <EmptyState
              icon={CalendarDays}
              title="No lessons match"
              description="Change the filters, or create a lesson for a teacher and one of their students."
              action={create}
            />
          }
        />
      ) : (
        <div className="flex flex-col gap-4">
          {!query.isPending && lessons.length === 0 ? (
            <div className="rounded-lg border border-border bg-card">
              <EmptyState
                icon={CalendarDays}
                title="No lessons match"
                description="Change the filters, or create a lesson."
                action={create}
              />
            </div>
          ) : (
            <LessonAgenda lessons={lessons} names={names} isLoading={query.isPending} />
          )}
          {(query.data?.totalElements ?? 0) > 0 ? (
            <Pagination
              page={params.page}
              size={params.size}
              total={query.data?.totalElements ?? 0}
              onPageChange={params.setPage}
              onSizeChange={params.setSize}
            />
          ) : null}
        </div>
      )}
      <CreateLessonSheet
        open={params.filter('new') === '1'}
        onOpenChange={(open) => params.setFlag('new', open ? 1 : null)}
        fixed={fixed}
        onCreated={(id) => navigate(paths.detail(id))}
      />
    </div>
  )
}
