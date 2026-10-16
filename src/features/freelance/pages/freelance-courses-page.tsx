import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Archive, ArchiveRestore, BookOpen, ExternalLink, Pencil, Plus, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { courseKeys, coursesApi } from '@/api/courses'
import type { Course } from '@/api/types'
import type { RouteHandle } from '@/app/route-handle'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { columnHelper, DataTable } from '@/components/data/data-table'
import { EmptyState } from '@/components/data/empty-state'
import { ListToolbar, matchesQuery } from '@/components/data/list-toolbar'
import { RowActions } from '@/components/row-actions'
import { SectionHeader } from '@/components/section-header'
import { StatusBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import { CourseFormSheet } from '@/features/org-workspace/components/course-form-sheet'
import { formatDate } from '@/lib/format'
import { useListParams } from '@/lib/use-list-params'
import { useFreelanceWorkspace } from '../use-freelance-workspace'

export const handle: RouteHandle = { crumb: () => 'Courses', title: 'Courses' }

const col = columnHelper<Course>()
const columns = [
  col.accessor('title', {
    header: 'Title',
    cell: (info) => <span className="font-medium text-foreground">{info.getValue()}</span>,
  }),
  col.accessor('status', {
    header: 'Status',
    cell: (info) => <StatusBadge value={info.getValue()} />,
  }),
  col.accessor('createdAt', {
    header: 'Created',
    cell: (info) => (
      <span className="text-muted-foreground tabular-nums">{formatDate(info.getValue())}</span>
    ),
    meta: { className: 'w-36' },
  }),
]

/** `GET /courses?teacherId=` (gap G4-B): the freelance teacher's courses (no organization). */
export function Component() {
  const { teacher, teacherId, basePath } = useFreelanceWorkspace()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const params = useListParams({ sort: 'title,asc' })
  const [editing, setEditing] = useState<Course | null>(null)
  const [deleting, setDeleting] = useState<Course | null>(null)

  const query = useQuery({
    queryKey: courseKeys.list({ teacherId }, params.pageParams),
    queryFn: ({ signal }) => coursesApi.list({ teacherId }, params.pageParams, signal),
    placeholderData: keepPreviousData,
  })
  const rows = useMemo(
    () => (query.data?.content ?? []).filter((c) => matchesQuery(c, params.q, [(r) => r.title])),
    [query.data, params.q],
  )

  const setStatus = useMutation({
    mutationFn: ({ course, status }: { course: Course; status: Course['status'] }) =>
      coursesApi.update(course.id, { status }),
    onSuccess: async (_c, { status }) => {
      await queryClient.invalidateQueries({ queryKey: courseKeys.all })
      toast.success(status === 'ARCHIVED' ? 'Course archived' : 'Course reactivated')
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : 'Could not update the course'),
  })
  const remove = useMutation({
    mutationFn: (course: Course) => coursesApi.remove(course.id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: courseKeys.all })
      toast.success('Course deleted')
    },
  })

  const create = (
    <Button onClick={() => params.setFlag('new', 1)}>
      <Plus aria-hidden />
      New course
    </Button>
  )

  return (
    <div className="flex flex-col gap-4">
      <SectionHeader
        title="Courses"
        description={`Courses owned by ${teacher.name}. Freelance courses belong to no organization.`}
      />
      <ListToolbar
        query={params.q}
        onQueryChange={params.setQuery}
        searchPlaceholder="Filter by title…"
        matched={rows.length}
        loaded={query.data?.content.length}
        actions={create}
      />
      <DataTable
        caption={`Courses of ${teacher.name}`}
        columns={columns}
        data={rows}
        total={query.data?.totalElements ?? 0}
        page={params.page}
        size={params.size}
        onPageChange={params.setPage}
        onSizeChange={params.setSize}
        sort={params.sort}
        onSortChange={params.setSort}
        getRowId={(c) => c.id}
        rowHref={(c) => `${basePath}/courses/${c.id}`}
        isLoading={query.isPending}
        isFetching={query.isFetching}
        error={query.error}
        onRetry={() => void query.refetch()}
        renderMobileRow={(c) => (
          <div className="flex items-start justify-between gap-3">
            <p className="truncate font-medium text-foreground">{c.title}</p>
            <StatusBadge value={c.status} />
          </div>
        )}
        rowActions={(c) => (
          <RowActions
            label={`Actions for ${c.title}`}
            actions={[
              {
                label: 'Open',
                icon: ExternalLink,
                onSelect: () => navigate(`${basePath}/courses/${c.id}`),
              },
              { label: 'Edit', icon: Pencil, onSelect: () => setEditing(c) },
              c.status === 'ACTIVE'
                ? {
                    label: 'Archive course',
                    icon: Archive,
                    separatorBefore: true,
                    onSelect: () => setStatus.mutate({ course: c, status: 'ARCHIVED' }),
                  }
                : {
                    label: 'Reactivate course',
                    icon: ArchiveRestore,
                    separatorBefore: true,
                    onSelect: () => setStatus.mutate({ course: c, status: 'ACTIVE' }),
                  },
              {
                label: 'Delete course',
                icon: Trash2,
                destructive: true,
                onSelect: () => setDeleting(c),
              },
            ]}
          />
        )}
        emptyState={
          <EmptyState
            icon={BookOpen}
            title={params.q ? 'No courses match this filter' : 'No courses yet'}
            description={
              params.q
                ? 'Clear the filter or load another page.'
                : `Create the first course of ${teacher.name}.`
            }
            action={params.q ? null : create}
          />
        }
      />
      <CourseFormSheet
        open={params.filter('new') === '1'}
        onOpenChange={(open) => params.setFlag('new', open ? 1 : null)}
        onSaved={(c) => navigate(`${basePath}/courses/${c.id}`)}
      />
      <CourseFormSheet
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        course={editing ?? undefined}
      />
      {deleting ? (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && setDeleting(null)}
          title="Delete course"
          destructive
          confirmLabel="Delete course"
          description={
            <>
              <p>
                Soft-deletes <strong>{deleting.title}</strong>: it disappears from every list and
                enrolled students lose access to it.
              </p>
              <p>
                Lessons and payments linked to it are kept as history. To keep it visible but
                closed, archive it instead.
              </p>
            </>
          }
          onConfirm={async () => {
            await remove.mutateAsync(deleting)
            setDeleting(null)
          }}
        />
      ) : null}
    </div>
  )
}
