import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { BookOpen, Pencil, Trash2, UserMinus } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'
import { enrollmentKeys, enrollmentsApi } from '@/api/enrollments'
import { isApiError } from '@/api/errors'
import { memberKeys, membersApi } from '@/api/members'
import { studentKeys, studentsApi } from '@/api/students'
import type { StudentEnrollment } from '@/api/types'
import { userKeys, usersApi } from '@/api/users'
import type { RouteHandle } from '@/app/route-handle'
import { PageSkeleton } from '@/app/shell/app-shell'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { ErrorState } from '@/components/data/error-state'
import { DetailHeader } from '@/components/detail/detail-header'
import {
  DetailField,
  DetailPanel,
  EnumValue,
  IdValue,
  TimeValue,
} from '@/components/detail/detail-panel'
import { RowActions } from '@/components/row-actions'
import { StatusBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import { enumLabel, formatDate, formatDateTime } from '@/lib/format'
import { usePageTitle } from '@/lib/use-page-title'
import { StudentCrumb } from '../components/crumbs'
import { EditStudentSheet } from '../components/edit-student-sheet'
import { useUserMemberships } from '../hooks/use-user-memberships'
import { useWorkspaceScope } from '../use-org-workspace'

export const handle: RouteHandle = {
  crumb: (params) => <StudentCrumb studentId={params.studentId} />,
}

const ENROLLMENTS = { page: 0, size: 100, sort: 'enrolledAt,desc' }

/**
 * Student detail: `GET /students/{id}` + `GET /users/{id}` (memberships), balances from
 * `GET /students/{id}/lessons/summary`, courses from `GET /students/{id}/enrollments`.
 */
export function Component() {
  const scope = useWorkspaceScope()
  const { studentId = '' } = useParams<{ studentId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { basePath, capabilities } = scope
  const orgId = scope.kind === 'org' ? scope.orgId : null
  const teacherFilter = scope.kind === 'freelance' ? scope.teacherId : null
  const [editing, setEditing] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [unenrolling, setUnenrolling] = useState<StudentEnrollment | null>(null)

  const studentQuery = useQuery({
    queryKey: studentKeys.detail(studentId),
    queryFn: ({ signal }) => studentsApi.get(studentId, signal),
  })
  const userQuery = useQuery({
    queryKey: userKeys.detail(studentId),
    queryFn: ({ signal }) => usersApi.get(studentId, signal),
    retry: false,
  })
  const summary = useQuery({
    queryKey: studentKeys.summary(studentId, teacherFilter),
    queryFn: ({ signal }) => studentsApi.summary(studentId, teacherFilter, signal),
  })
  const enrollments = useQuery({
    queryKey: studentKeys.enrollments(studentId, ENROLLMENTS),
    queryFn: ({ signal }) => studentsApi.enrollments(studentId, ENROLLMENTS, signal),
  })
  const memberships = useUserMemberships(orgId ?? '', studentId)
  usePageTitle(studentQuery.data?.name)

  const invalidate = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: studentKeys.all }),
      queryClient.invalidateQueries({ queryKey: userKeys.detail(studentId) }),
      queryClient.invalidateQueries({ queryKey: memberKeys.all }),
      queryClient.invalidateQueries({ queryKey: enrollmentKeys.all }),
    ])
  const removeMembership = useMutation({
    mutationFn: (membershipId: string) => membersApi.remove(membershipId),
    onSuccess: async () => {
      await invalidate()
      toast.success('Removed from organization')
      navigate(`${basePath}/students`)
    },
  })
  const deleteStudent = useMutation({
    mutationFn: () => studentsApi.remove(studentId),
    onSuccess: async () => {
      await invalidate()
      toast.success('Student account deleted')
      navigate(`${basePath}/students`)
    },
  })
  const unenroll = useMutation({
    mutationFn: (enrollment: StudentEnrollment) =>
      enrollmentsApi.unenroll(enrollment.courseId, studentId),
    onSuccess: async () => {
      await invalidate()
      toast.success('Student unenrolled')
    },
  })

  if (studentQuery.isPending) return <PageSkeleton />
  if (studentQuery.isError)
    return <ErrorState error={studentQuery.error} onRetry={() => void studentQuery.refetch()} />
  const student = studentQuery.data
  const user = userQuery.data ?? null
  const covers = user ? capabilities.canEditUser(user) : capabilities.isSuperAdmin
  const canEditIdentity = capabilities.isSuperAdmin || (scope.kind === 'org' && covers)
  const studentMembership = (memberships.data ?? []).find((m) => m.role === 'STUDENT')
  const orgName = scope.kind === 'org' ? scope.org.name : null
  const courseHref = (courseId: string) => `${basePath}/courses/${courseId}`

  return (
    <div className="flex flex-col gap-5">
      <DetailHeader
        backTo={`${basePath}/students`}
        backLabel="Students"
        title={student.name}
        badge={<StatusBadge value={student.status} />}
        meta={
          <>
            <span>{student.email}</span>
            <IdValue value={student.id} />
          </>
        }
        actions={
          <>
            {capabilities.canManageStudents ? (
              <Button variant="outline" onClick={() => setEditing(true)}>
                <Pencil aria-hidden />
                Edit
              </Button>
            ) : null}
            <RowActions
              label="More actions"
              actions={[
                ...(scope.kind === 'org'
                  ? [
                      {
                        label: `Remove from ${orgName}`,
                        icon: UserMinus,
                        destructive: true,
                        onSelect: () => setRemoving(true),
                        disabledReason: !studentMembership
                          ? memberships.isPending
                            ? 'Loading memberships…'
                            : 'No student membership of this organization was found for this account.'
                          : null,
                      },
                    ]
                  : []),
                {
                  label: 'Delete student account',
                  icon: Trash2,
                  destructive: true,
                  onSelect: () => setDeleting(true),
                },
              ]}
            />
          </>
        }
      />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="flex flex-col gap-5">
          <DetailPanel title="Details" description="Every field the API returns for this student.">
            <DetailField label="Id">
              <IdValue value={student.id} />
            </DetailField>
            <DetailField
              label="Email"
              hint="Students sign in with this address only; there is no password."
            >
              {student.email}
            </DetailField>
            <DetailField label="Name">{student.name}</DetailField>
            <DetailField label="Status">
              <EnumValue value={student.status} />
            </DetailField>
            <DetailField label="Created">
              <TimeValue value={student.createdAt} />
            </DetailField>
          </DetailPanel>
          <DetailPanel
            title="Courses"
            description={
              scope.kind === 'org'
                ? 'Enrollments in courses you manage.'
                : 'Enrollments in this teacher’s courses.'
            }
          >
            {enrollments.isPending ? (
              <DetailField label="Loading">…</DetailField>
            ) : enrollments.isError ? (
              <DetailField label="Error">Could not load enrollments.</DetailField>
            ) : enrollments.data.content.length === 0 ? (
              <DetailField label="None">
                <span className="inline-flex items-center gap-1 text-muted-foreground">
                  <BookOpen className="size-3.5" aria-hidden /> Not enrolled in any course yet.
                  Enrol from a course page.
                </span>
              </DetailField>
            ) : (
              enrollments.data.content.map((e) => (
                <DetailField key={e.id} label={enumLabel(e.status)}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link
                        to={courseHref(e.courseId)}
                        className="font-medium text-primary underline-offset-4 hover:underline"
                      >
                        {e.courseTitle}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        Enrolled {formatDate(e.enrolledAt)} · course{' '}
                        {enumLabel(e.courseStatus).toLowerCase()}
                      </p>
                    </div>
                    {capabilities.canManageCourses && e.status === 'ACTIVE' ? (
                      <Button variant="ghost" size="sm" onClick={() => setUnenrolling(e)}>
                        Unenrol
                      </Button>
                    ) : null}
                  </div>
                </DetailField>
              ))
            )}
          </DetailPanel>
        </div>
        <div className="flex flex-col gap-5">
          <DetailPanel
            title="Lesson balances"
            description={teacherFilter ? 'With this teacher.' : 'Across every teacher you can see.'}
          >
            {summary.isPending ? (
              <DetailField label="Loading">…</DetailField>
            ) : summary.isError ? (
              <DetailField label="Error">Could not load balances.</DetailField>
            ) : (
              <>
                <DetailField
                  label="Prepaid left"
                  hint="Paid lessons still pending (scheduled or not)."
                >
                  <span className="text-lg font-semibold tabular-nums">
                    {summary.data.prepaidRemaining}
                  </span>
                </DetailField>
                <DetailField label="Unpaid due" hint="Held or late-canceled lessons not paid yet.">
                  <span className="text-lg font-semibold tabular-nums">
                    {summary.data.unpaidDue}
                  </span>
                </DetailField>
                <DetailField label="Upcoming unpaid" hint="Dated pending lessons without payment.">
                  <span className="text-lg font-semibold tabular-nums">
                    {summary.data.upcomingUnpaid}
                  </span>
                </DetailField>
                <DetailField label="Next lesson">
                  {summary.data.nextLesson ? (
                    capabilities.canManageLessons ? (
                      <Link
                        to={`/platform/lessons/${summary.data.nextLesson.id}`}
                        className="font-medium text-primary underline-offset-4 hover:underline"
                      >
                        {formatDateTime(summary.data.nextLesson.scheduledAt)}
                      </Link>
                    ) : (
                      formatDateTime(summary.data.nextLesson.scheduledAt)
                    )
                  ) : (
                    <span className="text-muted-foreground">None scheduled</span>
                  )}
                </DetailField>
              </>
            )}
          </DetailPanel>
          <DetailPanel
            title="Memberships"
            description="Organizations where this student is enrolled."
          >
            {userQuery.isPending ? (
              <DetailField label="Loading">…</DetailField>
            ) : !user ? (
              <DetailField label="Unavailable">
                {isApiError(userQuery.error) && userQuery.error.isNotFound
                  ? 'Not accessible with your role.'
                  : 'Could not load memberships.'}
              </DetailField>
            ) : user.memberships.length === 0 ? (
              <DetailField label="None">
                No organization: a freelance teacher’s student.
              </DetailField>
            ) : (
              user.memberships.map((m) => (
                <DetailField key={`${m.organizationId}-${m.role}`} label={enumLabel(m.role)}>
                  {capabilities.isSuperAdmin ? (
                    <Link
                      to={`/platform/orgs/${m.organizationId}`}
                      className="font-medium text-primary underline-offset-4 hover:underline"
                    >
                      {m.organizationName}
                    </Link>
                  ) : (
                    m.organizationName
                  )}
                </DetailField>
              ))
            )}
          </DetailPanel>
        </div>
      </div>
      <EditStudentSheet
        student={student}
        canEditIdentity={canEditIdentity}
        open={editing}
        onOpenChange={setEditing}
      />
      {studentMembership ? (
        <ConfirmDialog
          open={removing}
          onOpenChange={setRemoving}
          title={`Remove from ${orgName}`}
          destructive
          confirmLabel="Remove from organization"
          description={
            <>
              <p>
                Removes <strong>{student.name}</strong>'s student membership in{' '}
                <strong>{orgName}</strong>. Their account and other organizations are not affected.
              </p>
              <p>
                Enrollments in this organization's courses and roster entries stay on record;
                lessons are kept as history.
              </p>
            </>
          }
          onConfirm={() => removeMembership.mutateAsync(studentMembership.membershipId)}
        />
      ) : null}
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title="Delete student account"
        destructive
        confirmLabel="Delete student account"
        description={
          capabilities.isSuperAdmin ? (
            <>
              <p>
                Deletes <strong>{student.name}</strong>'s account everywhere: every membership,
                roster entry and enrollment is removed, in every organization. The student can no
                longer sign in.
              </p>
              <p>Lessons and payments are kept as history.</p>
            </>
          ) : (
            <>
              <p>
                Removes <strong>{student.name}</strong> from every organization you administer, with
                their roster entries and enrollments there.
              </p>
              <p>
                The account is deleted only if nothing else links to it. Lessons and payments are
                kept as history.
              </p>
            </>
          )
        }
        onConfirm={() => deleteStudent.mutateAsync()}
      />
      {unenrolling ? (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && setUnenrolling(null)}
          title="Unenrol from course"
          destructive
          confirmLabel="Unenrol"
          description={
            <p>
              <strong>{student.name}</strong> loses access to{' '}
              <strong>{unenrolling.courseTitle}</strong> immediately. Lessons are kept as history.
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
