import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ExternalLink, GraduationCap, Plus, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { studentKeys, studentsApi } from '@/api/students'
import type { Student } from '@/api/types'
import type { RouteHandle } from '@/app/route-handle'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { columnHelper, DataTable } from '@/components/data/data-table'
import { EmptyState } from '@/components/data/empty-state'
import { ListToolbar, matchesQuery } from '@/components/data/list-toolbar'
import { RowActions } from '@/components/row-actions'
import { SectionHeader } from '@/components/section-header'
import { StatusBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import { AddStudentSheet } from '@/features/org-workspace/components/add-student-sheet'
import { formatDate } from '@/lib/format'
import { useListParams } from '@/lib/use-list-params'
import { useFreelanceWorkspace } from '../use-freelance-workspace'

export const handle: RouteHandle = { crumb: () => 'Students', title: 'Students' }

const col = columnHelper<Student>()
const columns = [
  col.accessor('name', {
    header: 'Name',
    cell: (info) => <span className="font-medium text-foreground">{info.getValue()}</span>,
  }),
  col.accessor('email', {
    header: 'Email',
    cell: (info) => <span className="text-muted-foreground">{info.getValue()}</span>,
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

/** `GET /students?teacherId=` (gap G5-B): the teacher's roster plus students enrolled in their courses. */
export function Component() {
  const { teacher, teacherId, basePath } = useFreelanceWorkspace()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const params = useListParams({ sort: 'name,asc' })
  const [deleting, setDeleting] = useState<Student | null>(null)

  const query = useQuery({
    queryKey: studentKeys.list({ teacherId }, params.pageParams),
    queryFn: ({ signal }) => studentsApi.list({ teacherId }, params.pageParams, signal),
    placeholderData: keepPreviousData,
  })
  const rows = useMemo(
    () =>
      (query.data?.content ?? []).filter((s) =>
        matchesQuery(s, params.q, [(r) => r.name, (r) => r.email]),
      ),
    [query.data, params.q],
  )

  const remove = useMutation({
    mutationFn: (student: Student) => studentsApi.remove(student.id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: studentKeys.all })
      toast.success('Student account deleted')
    },
  })

  const create = (
    <Button onClick={() => params.setFlag('new', 1)}>
      <Plus aria-hidden />
      Add student
    </Button>
  )

  return (
    <div className="flex flex-col gap-4">
      <SectionHeader
        title="Students"
        description={`Students on ${teacher.name}'s roster or enrolled in one of their courses. They sign in with their email only.`}
      />
      <ListToolbar
        query={params.q}
        onQueryChange={params.setQuery}
        searchPlaceholder="Filter students by name or email…"
        matched={rows.length}
        loaded={query.data?.content.length}
        actions={create}
      />
      <DataTable
        caption={`Students of ${teacher.name}`}
        columns={columns}
        data={rows}
        total={query.data?.totalElements ?? 0}
        page={params.page}
        size={params.size}
        onPageChange={params.setPage}
        onSizeChange={params.setSize}
        sort={params.sort}
        onSortChange={params.setSort}
        getRowId={(s) => s.id}
        rowHref={(s) => `${basePath}/students/${s.id}`}
        isLoading={query.isPending}
        isFetching={query.isFetching}
        error={query.error}
        onRetry={() => void query.refetch()}
        renderMobileRow={(s) => (
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate font-medium text-foreground">{s.name}</p>
              <p className="truncate text-sm text-muted-foreground">{s.email}</p>
            </div>
            <StatusBadge value={s.status} />
          </div>
        )}
        rowActions={(s) => (
          <RowActions
            label={`Actions for ${s.name}`}
            actions={[
              {
                label: 'Open',
                icon: ExternalLink,
                onSelect: () => navigate(`${basePath}/students/${s.id}`),
              },
              {
                label: 'Delete student account',
                icon: Trash2,
                destructive: true,
                separatorBefore: true,
                onSelect: () => setDeleting(s),
              },
            ]}
          />
        )}
        emptyState={
          <EmptyState
            icon={GraduationCap}
            title={params.q ? 'No students match this filter' : 'No students yet'}
            description={
              params.q
                ? 'Clear the filter or load another page.'
                : `Add the first student of ${teacher.name}.`
            }
            action={params.q ? null : create}
          />
        }
      />
      <AddStudentSheet
        open={params.filter('new') === '1'}
        onOpenChange={(open) => params.setFlag('new', open ? 1 : null)}
        onCreated={(s) => navigate(`${basePath}/students/${s.id}`)}
      />
      {deleting ? (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && setDeleting(null)}
          title="Delete student account"
          destructive
          confirmLabel="Delete student account"
          description={
            <>
              <p>
                Deletes <strong>{deleting.name}</strong>'s account everywhere: every roster entry,
                membership and enrollment is removed. The student can no longer sign in.
              </p>
              <p>
                Lessons and payments are kept as history. There is no way to remove a student from
                only this teacher's roster through the console.
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
