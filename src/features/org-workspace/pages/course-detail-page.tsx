import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Archive,
  ArchiveRestore,
  ExternalLink,
  Pencil,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'
import { courseKeys, coursesApi } from '@/api/courses'
import { enrollmentKeys, enrollmentsApi } from '@/api/enrollments'
import { studentKeys } from '@/api/students'
import type { Course, Enrollment } from '@/api/types'
import { userKeys, usersApi } from '@/api/users'
import type { RouteHandle } from '@/app/route-handle'
import { PageSkeleton } from '@/app/shell/app-shell'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { columnHelper, DataTable } from '@/components/data/data-table'
import { EmptyState } from '@/components/data/empty-state'
import { ErrorState } from '@/components/data/error-state'
import { DetailHeader } from '@/components/detail/detail-header'
import {
  DetailField,
  DetailPanel,
  EntityValue,
  EnumValue,
  IdValue,
  TextValue,
  TimeValue,
} from '@/components/detail/detail-panel'
import { RowActions } from '@/components/row-actions'
import { StatusBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import { formatDate, formatDuration } from '@/lib/format'
import { useListParams } from '@/lib/use-list-params'
import { usePageTitle } from '@/lib/use-page-title'
import { CourseFormSheet } from '../components/course-form-sheet'
import { CourseCrumb } from '../components/crumbs'
import { EnrollStudentSheet } from '../components/enroll-student-sheet'
import { useWorkspaceScope } from '../use-org-workspace'

export const handle: RouteHandle = { crumb: (params) => <CourseCrumb courseId={params.courseId} /> }

const col = columnHelper<Enrollment>()

/** Course detail: `GET /courses/{id}`, its teacher, and the enrollments (`GET /courses/{id}/enrollments`). */
export function Component() {
  const scope = useWorkspaceScope()
  const { courseId = '' } = useParams<{ courseId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const params = useListParams({ sort: 'enrolledAt,desc' })
  const { basePath, capabilities } = scope
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [unenrolling, setUnenrolling] = useState<Enrollment | null>(null)

  const courseQuery = useQuery({
    queryKey: courseKeys.detail(courseId),
    queryFn: ({ signal }) => coursesApi.get(courseId, signal),
  })
  const teacherId = courseQuery.data?.teacherId
  const teacherQuery = useQuery({
    queryKey: userKeys.detail(teacherId ?? ''),
    queryFn: ({ signal }) => usersApi.get(teacherId ?? '', signal),
    enabled: !!teacherId,
    retry: false,
  })
  const enrollments = useQuery({
    queryKey: enrollmentKeys.list(courseId, params.pageParams),
    queryFn: ({ signal }) => enrollmentsApi.list(courseId, params.pageParams, signal),
    placeholderData: keepPreviousData,
  })
  usePageTitle(courseQuery.data?.title)

  const invalidate = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: courseKeys.all }),
      queryClient.invalidateQueries({ queryKey: enrollmentKeys.course(courseId) }),
      queryClient.invalidateQueries({ queryKey: studentKeys.all }),
    ])
  const setStatus = useMutation({
    mutationFn: (status: Course['status']) => coursesApi.update(courseId, { status }),
    onSuccess: async (_c, status) => {
      await invalidate()
      toast.success(status === 'ARCHIVED' ? 'Course archived' : 'Course reactivated')
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : 'Could not update the course'),
  })
  const remove = useMutation({
    mutationFn: () => coursesApi.remove(courseId),
    onSuccess: async () => {
      await invalidate()
      toast.success('Course deleted')
      navigate(`${basePath}/courses`)
    },
  })
  const unenroll = useMutation({
    mutationFn: (enrollment: Enrollment) => enrollmentsApi.unenroll(courseId, enrollment.studentId),
    onSuccess: async () => {
      await invalidate()
      toast.success('Student unenrolled')
    },
  })

  if (courseQuery.isPending) return <PageSkeleton />
  if (courseQuery.isError)
    return <ErrorState error={courseQuery.error} onRetry={() => void courseQuery.refetch()} />
  const course = courseQuery.data
  const teacher = teacherQuery.data
  const teacherHref = scope.kind === 'org' ? `${basePath}/teachers/${course.teacherId}` : basePath
  const studentHref = (studentId: string) => `${basePath}/students/${studentId}`
  const enrolling = params.filter('enrol') === '1'

  const columns = [
    col.accessor('studentName', {
      header: 'Student',
      enableSorting: false,
      cell: (info) => <span className="font-medium text-foreground">{info.getValue()}</span>,
    }),
    col.accessor('studentEmail', {
      header: 'Email',
      enableSorting: false,
      cell: (info) => <span className="text-muted-foreground">{info.getValue()}</span>,
    }),
    col.accessor('status', {
      header: 'Status',
      cell: (info) => <StatusBadge value={info.getValue()} />,
    }),
    col.accessor('enrolledAt', {
      header: 'Enrolled',
      cell: (info) => (
        <span className="text-muted-foreground tabular-nums">{formatDate(info.getValue())}</span>
      ),
      meta: { className: 'hidden w-36 lg:table-cell', headerClassName: 'hidden lg:table-cell' },
    }),
  ]

  return (
    <div className="flex flex-col gap-5">
      <DetailHeader
        backTo={`${basePath}/courses`}
        backLabel="Courses"
        title={course.title}
        badge={<StatusBadge value={course.status} />}
        meta={<IdValue value={course.id} />}
        actions={
          <>
            {capabilities.canManageCourses && scope.kind === 'org' ? (
              <Button variant="outline" onClick={() => setEditing(true)}>
                <Pencil aria-hidden />
                Edit
              </Button>
            ) : null}
            {capabilities.canManageCourses ? (
              <RowActions
                label="More actions"
                actions={[
                  course.status === 'ACTIVE'
                    ? {
                        label: 'Archive course',
                        icon: Archive,
                        onSelect: () => setStatus.mutate('ARCHIVED'),
                      }
                    : {
                        label: 'Reactivate course',
                        icon: ArchiveRestore,
                        onSelect: () => setStatus.mutate('ACTIVE'),
                      },
                  {
                    label: 'Delete course',
                    icon: Trash2,
                    destructive: true,
                    separatorBefore: true,
                    onSelect: () => setDeleting(true),
                  },
                ]}
              />
            ) : null}
          </>
        }
      />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <DetailPanel title="Details" description="Every field the API returns for this course.">
          <DetailField label="Id">
            <IdValue value={course.id} />
          </DetailField>
          <DetailField label="Title">{course.title}</DetailField>
          <DetailField label="Description">
            <TextValue value={course.description} />
          </DetailField>
          <DetailField label="Status">
            <EnumValue value={course.status} />
          </DetailField>
          <DetailField label="Teacher" hint="A course belongs to exactly one teacher.">
            <EntityValue
              to={teacherHref}
              label={teacher?.name ?? (teacherQuery.isPending ? '…' : 'Teacher')}
              id={course.teacherId}
            />
          </DetailField>
          <DetailField label="Organization">
            {course.organizationId ? (
              scope.kind === 'org' ? (
                <EntityValue to={basePath} label={scope.org.name} id={course.organizationId} />
              ) : (
                <IdValue value={course.organizationId} />
              )
            ) : (
              <span className="text-muted-foreground">None (freelance course)</span>
            )}
          </DetailField>
          <DetailField
            label="Default lesson length"
            hint="Given to new lessons of this course booked without their own length."
          >
            {course.defaultDurationMinutes ? (
              formatDuration(course.defaultDurationMinutes)
            ) : (
              <span className="text-muted-foreground">None (lessons last 60 min)</span>
            )}
          </DetailField>
          <DetailField label="Created">
            <TimeValue value={course.createdAt} />
          </DetailField>
          <DetailField label="Updated">
            <TimeValue value={course.updatedAt} />
          </DetailField>
        </DetailPanel>
        <section className="flex flex-col gap-3" aria-labelledby="enrollments-title">
          <div className="flex items-center justify-between gap-3">
            <h2 id="enrollments-title" className="text-sm font-semibold text-foreground">
              Enrolled students{' '}
              {enrollments.data ? (
                <span className="text-muted-foreground tabular-nums">
                  ({enrollments.data.totalElements})
                </span>
              ) : null}
            </h2>
            {capabilities.canManageCourses && course.status === 'ACTIVE' ? (
              <Button size="sm" onClick={() => params.setFlag('enrol', 1)}>
                <UserPlus aria-hidden />
                Enrol student
              </Button>
            ) : null}
          </div>
          <DataTable
            caption={`Students enrolled in ${course.title}`}
            columns={columns}
            data={enrollments.data?.content ?? []}
            total={enrollments.data?.totalElements ?? 0}
            page={params.page}
            size={params.size}
            onPageChange={params.setPage}
            sort={params.sort}
            onSortChange={params.setSort}
            getRowId={(e) => e.id}
            rowHref={(e) => studentHref(e.studentId)}
            isLoading={enrollments.isPending}
            isFetching={enrollments.isFetching}
            error={enrollments.error}
            onRetry={() => void enrollments.refetch()}
            renderMobileRow={(e) => (
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">{e.studentName}</p>
                  <p className="truncate text-sm text-muted-foreground">{e.studentEmail}</p>
                </div>
                <StatusBadge value={e.status} />
              </div>
            )}
            rowActions={(e) => (
              <RowActions
                label={`Actions for ${e.studentName}`}
                actions={[
                  {
                    label: 'Open student',
                    icon: ExternalLink,
                    onSelect: () => navigate(studentHref(e.studentId)),
                  },
                  {
                    label: 'Unenrol',
                    icon: Users,
                    destructive: true,
                    onSelect: () => setUnenrolling(e),
                    disabledReason: capabilities.canManageCourses
                      ? null
                      : 'Your role cannot change enrollments.',
                  },
                ]}
              />
            )}
            emptyState={
              <EmptyState
                icon={Users}
                title="No students enrolled"
                description="Enrol students of this organization so they can see the course."
                action={
                  capabilities.canManageCourses && course.status === 'ACTIVE' ? (
                    <Button size="sm" onClick={() => params.setFlag('enrol', 1)}>
                      <UserPlus aria-hidden />
                      Enrol student
                    </Button>
                  ) : null
                }
              />
            }
          />
        </section>
      </div>
      {scope.kind === 'org' ? (
        <CourseFormSheet open={editing} onOpenChange={setEditing} course={course} />
      ) : null}
      <EnrollStudentSheet
        course={course}
        open={enrolling}
        onOpenChange={(open) => params.setFlag('enrol', open ? 1 : null)}
      />
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title="Delete course"
        destructive
        confirmLabel="Delete course"
        description={
          <>
            <p>
              Soft-deletes <strong>{course.title}</strong>: it disappears from every list and
              enrolled students lose access to it.
            </p>
            <p>
              Lessons and payments linked to it are kept as history. To keep it visible but closed,
              archive it instead.
            </p>
          </>
        }
        onConfirm={() => remove.mutateAsync()}
      />
      {unenrolling ? (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && setUnenrolling(null)}
          title="Unenrol student"
          destructive
          confirmLabel="Unenrol"
          description={
            <p>
              <strong>{unenrolling.studentName}</strong> loses access to{' '}
              <strong>{course.title}</strong> immediately. Lessons are kept as history.
            </p>
          }
          onConfirm={async () => {
            await unenroll.mutateAsync(unenrolling)
            setUnenrolling(null)
          }}
        />
      ) : null}
    </div>
  )
}
