import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { BookOpen, CalendarDays, Pencil, Ticket, Trash2, UserMinus, Users } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'
import { enrollmentKeys, enrollmentsApi } from '@/api/enrollments'
import { isApiError } from '@/api/errors'
import { memberKeys, membersApi } from '@/api/members'
import { studentKeys, studentsApi } from '@/api/students'
import type { Student, StudentEnrollment } from '@/api/types'
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
import { enumLabel, formatDate, formatDateTimeRange } from '@/lib/format'
import { usePageTitle } from '@/lib/use-page-title'
import { StudentCrumb } from '../components/crumbs'
import { HomeworkPanel } from '@/features/homework/components/homework-panel'
import { AddPrepaidSheet } from '@/features/lessons/components/add-prepaid-sheet'
import { BalanceFields } from '@/features/lessons/components/balance-fields'
import { useLessonPaths } from '@/features/lessons/lesson-paths'
import { WeeklyLessonsPanel } from '@/features/recurring/components/weekly-lessons-panel'
import { EditStudentSheet } from '../components/edit-student-sheet'
import { useWorkspaceScope } from '../use-org-workspace'

export const handle: RouteHandle = {
  crumb: (params) => <StudentCrumb studentId={params.studentId} />,
}

const ENROLLMENTS = { page: 0, size: 100, sort: 'enrolledAt,desc' }

/**
 * Student detail: `GET /students/{id}` + `GET /users/{id}` (the one organization, with the
 * membership id, or none for a freelance teacher's student), balances from
 * `GET /students/{id}/lessons/summary`, courses from `GET /students/{id}/enrollments`, homework
 * from `GET /homework?studentId=` with Assign, Edit and Delete, the weekly lessons from
 * `GET /recurring-lessons?studentId=` with Set up, Change from a date, Stop and the dates to settle
 * (D-054), and the siblings sharing the email inside this workspace from
 * `GET /students/{id}/profiles` (the server filters by reach, D-049).
 */
export function Component() {
  const scope = useWorkspaceScope()
  const { studentId = '' } = useParams<{ studentId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { basePath, capabilities } = scope
  const lessonPaths = useLessonPaths()
  const orgId = scope.kind === 'org' ? scope.orgId : null
  const teacherFilter = scope.kind === 'freelance' ? scope.teacherId : null
  const [editing, setEditing] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [unenrolling, setUnenrolling] = useState<StudentEnrollment | null>(null)
  const [addingPrepaid, setAddingPrepaid] = useState(false)

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
  const profiles = useQuery({
    queryKey: studentKeys.profiles(studentId),
    queryFn: ({ signal }) => studentsApi.profiles(studentId, signal),
  })
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
  const orgName = scope.kind === 'org' ? scope.org.name : null
  // One place per student: `organization` carries the membership id `DELETE /memberships` needs.
  const membership = orgId && user?.organization?.id === orgId ? user.organization : null
  const removeReason = membership
    ? capabilities.removeMembershipDisabledReason({
        userId: studentId,
        organizationId: membership.id,
        role: 'STUDENT',
      })
    : userQuery.isPending
      ? 'Loading the student’s organization…'
      : `This student is not a member of ${orgName}.`
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
                        disabledReason: removeReason,
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
      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
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
          {capabilities.canManageLessons ? (
            <WeeklyLessonsPanel
              studentId={studentId}
              studentName={student.name}
              teacher={
                scope.kind === 'freelance'
                  ? { id: scope.teacherId, name: scope.teacher.name }
                  : undefined
              }
              organizationId={orgId ?? undefined}
            />
          ) : null}
          <HomeworkPanel
            description={
              scope.kind === 'org'
                ? 'From the organization’s teachers, open first.'
                : 'From this teacher, open first.'
            }
            filters={teacherFilter ? { studentId, teacherId: teacherFilter } : { studentId }}
            emptyText="No homework yet."
            show={{ teacher: scope.kind === 'org', lesson: true }}
            manage={
              capabilities.canManageHomework
                ? {
                    studentId,
                    studentName: student.name,
                    ...(scope.kind === 'freelance'
                      ? { teacher: { id: scope.teacherId, name: scope.teacher.name } }
                      : { organizationId: scope.orgId }),
                  }
                : undefined
            }
          />
        </div>
        <div className="flex flex-col gap-5">
          <DetailPanel
            title="Lesson balances"
            description={teacherFilter ? 'With this teacher.' : 'Across every teacher you can see.'}
            actions={
              capabilities.canManageStudentPayments ? (
                <Button variant="outline" size="sm" onClick={() => setAddingPrepaid(true)}>
                  <Ticket aria-hidden />
                  Add prepaid
                </Button>
              ) : null
            }
          >
            {summary.isPending ? (
              <DetailField label="Loading">…</DetailField>
            ) : summary.isError ? (
              <DetailField label="Error">Could not load balances.</DetailField>
            ) : (
              <>
                <BalanceFields summary={summary.data} />
                {capabilities.canManageLessons ? (
                  <DetailField label="Lessons">
                    <Link
                      to={`${basePath}/lessons?studentId=${studentId}`}
                      className="inline-flex items-center gap-1 font-medium text-primary underline-offset-4 hover:underline"
                    >
                      <CalendarDays className="size-3.5" aria-hidden />
                      Open this student’s lessons
                    </Link>
                  </DetailField>
                ) : null}
                <DetailField label="Next lesson">
                  {summary.data.nextLesson ? (
                    capabilities.canManageLessons ? (
                      <Link
                        to={lessonPaths.detail(summary.data.nextLesson.id)}
                        className="font-medium text-primary underline-offset-4 hover:underline"
                      >
                        {formatDateTimeRange(
                          summary.data.nextLesson.scheduledAt,
                          summary.data.nextLesson.durationMinutes,
                        )}
                      </Link>
                    ) : (
                      formatDateTimeRange(
                        summary.data.nextLesson.scheduledAt,
                        summary.data.nextLesson.durationMinutes,
                      )
                    )
                  ) : (
                    <span className="text-muted-foreground">None scheduled</span>
                  )}
                </DetailField>
              </>
            )}
          </DetailPanel>
          <DetailPanel
            title="Organization"
            description="A student belongs to one organization or to one freelance teacher."
          >
            {userQuery.isPending ? (
              <DetailField label="Loading">…</DetailField>
            ) : !user ? (
              <DetailField label="Unavailable">
                {isApiError(userQuery.error) && userQuery.error.isNotFound
                  ? 'Not accessible with your role.'
                  : 'Could not load the organization.'}
              </DetailField>
            ) : !user.organization ? (
              <DetailField label="None">
                No organization: a freelance teacher’s student.
              </DetailField>
            ) : (
              <DetailField label="Student of">
                {capabilities.isSuperAdmin ? (
                  <Link
                    to={`/platform/orgs/${user.organization.id}`}
                    className="font-medium text-primary underline-offset-4 hover:underline"
                  >
                    {user.organization.name}
                  </Link>
                ) : (
                  user.organization.name
                )}
                {user.organization.status === 'ARCHIVED' ? (
                  <span className="ml-2 text-xs text-muted-foreground">(archived)</span>
                ) : null}
              </DetailField>
            )}
          </DetailPanel>
          <DetailPanel
            title="Other profiles on this email"
            description={
              capabilities.isSuperAdmin
                ? 'Every other profile that signs in with this email, wherever it learns.'
                : scope.kind === 'org'
                  ? 'Siblings who sign in with the same email and learn in this organization.'
                  : 'Siblings who sign in with the same email and learn with this teacher.'
            }
          >
            {profiles.isPending ? (
              <DetailField label="Loading">…</DetailField>
            ) : profiles.isError ? (
              <DetailField label="Error">Could not load the other profiles.</DetailField>
            ) : profiles.data.length === 0 ? (
              <DetailField label="None">
                <span className="inline-flex items-center gap-1 text-muted-foreground">
                  <Users className="size-3.5" aria-hidden />
                  {capabilities.isSuperAdmin
                    ? 'No other profile on this email.'
                    : scope.kind === 'org'
                      ? 'No other profile in this organization.'
                      : 'No other profile with this teacher.'}
                </span>
              </DetailField>
            ) : (
              profiles.data.map((profile) =>
                capabilities.isSuperAdmin ? (
                  <SiblingAnywhere key={profile.id} profile={profile} />
                ) : (
                  <DetailField key={profile.id} label={enumLabel(profile.status)}>
                    <Link
                      to={`${basePath}/students/${profile.id}`}
                      className="font-medium text-primary underline-offset-4 hover:underline"
                    >
                      {profile.name}
                    </Link>
                  </DetailField>
                ),
              )
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
      {capabilities.canManageStudentPayments ? (
        <AddPrepaidSheet
          studentId={studentId}
          studentName={student.name}
          teacher={
            scope.kind === 'freelance'
              ? { id: scope.teacherId, name: scope.teacher.name }
              : undefined
          }
          organizationId={orgId ?? undefined}
          open={addingPrepaid}
          onOpenChange={setAddingPrepaid}
        />
      ) : null}
      {membership ? (
        <ConfirmDialog
          open={removing}
          onOpenChange={setRemoving}
          title={`Remove from ${orgName}`}
          destructive
          confirmLabel="Remove from organization"
          description={
            <>
              <p>
                Removes <strong>{student.name}</strong> from <strong>{orgName}</strong>, with their
                roster entries and enrollments here (completed ones included).
              </p>
              <p>
                The account stays without an organization, so another school or teacher can add them
                later. Lessons are kept as history.
              </p>
            </>
          }
          onConfirm={() => removeMembership.mutateAsync(membership.membershipId)}
        />
      ) : null}
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title="Delete student account"
        destructive
        confirmLabel="Delete student account"
        description={
          <>
            <p>
              Deletes <strong>{student.name}</strong>'s account: their{' '}
              {scope.kind === 'org' ? 'membership, roster entries' : 'roster entry'} and enrollments
              are removed and the student can no longer sign in.
            </p>
            <p>Lessons and payments are kept as history.</p>
          </>
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

/**
 * A sibling as the super-admin sees it: the API lists every profile of the email, so the row names
 * the sibling's school (from `GET /users/{id}`) and links into that school's workspace. A profile
 * without a school (freelance, or no place yet) has no link: the API does not say whose roster it is
 * on, and linking it into this workspace would open it out of place.
 */
function SiblingAnywhere({ profile }: { profile: Student }) {
  const user = useQuery({
    queryKey: userKeys.detail(profile.id),
    queryFn: ({ signal }) => usersApi.get(profile.id, signal),
  })
  const school = user.data?.organization ?? null
  return (
    <DetailField label={enumLabel(profile.status)}>
      <span className="flex flex-wrap items-baseline gap-x-2">
        {school ? (
          <Link
            to={`/platform/orgs/${school.id}/students/${profile.id}`}
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            {profile.name}
          </Link>
        ) : (
          <span className="font-medium text-foreground">{profile.name}</span>
        )}
        <span className="text-sm text-muted-foreground">
          {user.isPending ? '…' : school ? school.name : 'Freelance or no school yet'}
        </span>
      </span>
    </DetailField>
  )
}
