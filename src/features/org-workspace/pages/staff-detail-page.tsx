import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { BookOpen, KeyRound, Pencil, Plus, Trash2, UserMinus } from 'lucide-react'
import { useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'
import { courseKeys, coursesApi } from '@/api/courses'
import { memberKeys, membersApi } from '@/api/members'
import type { StaffRole } from '@/api/types'
import { userKeys, usersApi } from '@/api/users'
import type { RouteHandle } from '@/app/route-handle'
import { PageSkeleton } from '@/app/shell/app-shell'
import { useMe } from '@/auth/session'
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
import { TeacherPayoutsPanel } from '@/features/teacher-payouts/components/teacher-payouts-panel'
import { enumLabel } from '@/lib/format'
import { membershipRoleOf } from '@/lib/permissions'
import { usePageTitle } from '@/lib/use-page-title'
import { CourseFormSheet } from '../components/course-form-sheet'
import { UserCrumb } from '../components/crumbs'
import { EditUserSheet } from '../components/edit-user-sheet'
import { ResetLinkDialog } from '../components/reset-link-dialog'
import { useOrgWorkspace } from '../use-org-workspace'

export const handle: RouteHandle = { crumb: (params) => <UserCrumb userId={params.userId} /> }

const COURSES = { page: 0, size: 100, sort: 'title,asc' }

/**
 * Admin or teacher detail: `GET /users/{id}` (every field, its one organization and membership
 * id), courses they own here and, for a teacher, the Payouts panel (what the organization owes and
 * paid them, `canManageTeacherPayouts`).
 */
export function Component() {
  const { orgId, org, basePath, capabilities } = useOrgWorkspace()
  const { userId = '' } = useParams<{ userId: string }>()
  const location = useLocation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const me = useMe()
  const segment = location.pathname.includes('/admins/') ? 'admins' : 'teachers'
  const role: StaffRole = segment === 'admins' ? 'ADMIN' : 'TEACHER'
  const [editing, setEditing] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [newCourse, setNewCourse] = useState(false)

  const userQuery = useQuery({
    queryKey: userKeys.detail(userId),
    queryFn: ({ signal }) => usersApi.get(userId, signal),
  })
  const courses = useQuery({
    queryKey: courseKeys.list({ organizationId: orgId, teacherId: userId }, COURSES),
    queryFn: ({ signal }) =>
      coursesApi.list({ organizationId: orgId, teacherId: userId }, COURSES, signal),
    enabled: role === 'TEACHER',
  })
  usePageTitle(userQuery.data?.name)

  const invalidate = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: memberKeys.org(orgId) }),
      queryClient.invalidateQueries({ queryKey: userKeys.detail(userId) }),
    ])
  const removeMembership = useMutation({
    mutationFn: (membershipId: string) => membersApi.remove(membershipId),
    onSuccess: async () => {
      await invalidate()
      toast.success('Removed from organization')
      navigate(`${basePath}/${segment}`)
    },
  })
  const deleteAccount = useMutation({
    mutationFn: () => usersApi.remove(userId),
    onSuccess: async () => {
      await invalidate()
      toast.success('Account deleted')
      navigate(`${basePath}/${segment}`)
    },
  })

  if (userQuery.isPending) return <PageSkeleton />
  if (userQuery.isError)
    return <ErrorState error={userQuery.error} onRetry={() => void userQuery.refetch()} />
  const user = userQuery.data
  const self = user.id === me.id
  // One membership per account: `organization` names it, with the id `DELETE /memberships` needs.
  const membership = user.organization?.id === orgId ? user.organization : null
  const memberRole = membershipRoleOf(user)
  const removeReason =
    !membership || !memberRole
      ? `This account is not a member of ${org.name}.`
      : capabilities.removeMembershipDisabledReason({
          userId: user.id,
          organizationId: orgId,
          role: memberRole,
        })
  const deleteReason = capabilities.deleteAccountDisabledReason(user)
  const listLabel = segment === 'admins' ? 'Admins' : 'Teachers'

  return (
    <div className="flex flex-col gap-5">
      <DetailHeader
        backTo={`${basePath}/${segment}`}
        backLabel={listLabel}
        title={user.name}
        badge={<StatusBadge value={user.status} />}
        meta={
          <>
            <span>{user.email}</span>
            <IdValue value={user.id} />
          </>
        }
        actions={
          <>
            {capabilities.canEditUser(user) ? (
              <Button variant="outline" onClick={() => setEditing(true)}>
                <Pencil aria-hidden />
                Edit
              </Button>
            ) : null}
            <RowActions
              label="More actions"
              actions={[
                {
                  label: 'Send password reset link',
                  icon: KeyRound,
                  onSelect: () => setResetting(true),
                  disabledReason: capabilities.canSendResetLink(user)
                    ? null
                    : 'Only active password accounts can receive a reset link.',
                },
                {
                  label: 'Remove from organization',
                  icon: UserMinus,
                  destructive: true,
                  separatorBefore: true,
                  onSelect: () => setRemoving(true),
                  disabledReason: removeReason,
                },
                {
                  label: 'Delete account',
                  icon: Trash2,
                  destructive: true,
                  onSelect: () => setDeleting(true),
                  disabledReason: deleteReason,
                },
              ]}
            />
          </>
        }
      />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <DetailPanel title="Details" description="Every field the API returns for this account.">
          <DetailField label="Id">
            <IdValue value={user.id} />
          </DetailField>
          <DetailField label="Email">{user.email}</DetailField>
          <DetailField label="Name">{user.name}</DetailField>
          <DetailField label="Status">
            <EnumValue value={user.status} />
          </DetailField>
          <DetailField label="Account type">
            {user.hasPassword
              ? 'Password account (admin / teacher)'
              : 'Student account (email-only sign-in)'}
          </DetailField>
          <DetailField label="Role">
            {user.role ? (
              <EnumValue value={user.role} />
            ) : (
              <span className="text-muted-foreground">None</span>
            )}
          </DetailField>
          <DetailField label="Organization">
            {!user.organization ? (
              <span className="text-muted-foreground">None</span>
            ) : user.organization.id === orgId ? (
              <>
                {user.organization.name}
                <span className="ml-2 text-xs text-muted-foreground">(this organization)</span>
              </>
            ) : capabilities.isSuperAdmin ? (
              <Link
                to={`/platform/orgs/${user.organization.id}`}
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                {user.organization.name}
              </Link>
            ) : (
              user.organization.name
            )}
          </DetailField>
          <DetailField label="Created">
            <TimeValue value={user.createdAt} />
          </DetailField>
          {self ? (
            <DetailField label="Note">This is your own account. Edit it under Account.</DetailField>
          ) : null}
        </DetailPanel>
        <div className="flex flex-col gap-5">
          {role === 'TEACHER' ? (
            <DetailPanel
              title="Courses here"
              description="Courses this teacher owns in this organization."
              actions={
                capabilities.canManageCourses ? (
                  <Button variant="outline" size="sm" onClick={() => setNewCourse(true)}>
                    <Plus aria-hidden />
                    New course
                  </Button>
                ) : null
              }
            >
              {courses.isPending ? (
                <DetailField label="Loading">…</DetailField>
              ) : courses.isError ? (
                <DetailField label="Error">Could not load the courses.</DetailField>
              ) : courses.data.content.length === 0 ? (
                <DetailField label="None">
                  <span className="inline-flex items-center gap-1 text-muted-foreground">
                    <BookOpen className="size-3.5" aria-hidden /> No courses yet.
                  </span>
                </DetailField>
              ) : (
                courses.data.content.map((course) => (
                  <DetailField key={course.id} label={enumLabel(course.status)}>
                    <Link
                      to={`${basePath}/courses/${course.id}`}
                      className="font-medium text-primary underline-offset-4 hover:underline"
                    >
                      {course.title}
                    </Link>
                  </DetailField>
                ))
              )}
            </DetailPanel>
          ) : null}
        </div>
      </div>
      {role === 'TEACHER' && capabilities.canManageTeacherPayouts ? (
        <TeacherPayoutsPanel orgId={orgId} teacher={{ id: user.id, name: user.name }} />
      ) : null}
      <EditUserSheet
        user={user}
        capabilities={capabilities}
        open={editing}
        onOpenChange={setEditing}
      />
      <ResetLinkDialog email={user.email} open={resetting} onOpenChange={setResetting} />
      <CourseFormSheet
        open={newCourse}
        onOpenChange={setNewCourse}
        teacherId={user.id}
        onSaved={(c) => navigate(`${basePath}/courses/${c.id}`)}
      />
      {membership ? (
        <ConfirmDialog
          open={removing}
          onOpenChange={setRemoving}
          title="Remove from organization"
          destructive
          confirmLabel="Remove from organization"
          description={
            <>
              <p>
                Removes <strong>{user.name}</strong> from <strong>{org.name}</strong>. The account
                stays without a role: they can still sign in but reach nothing until they are
                invited or added somewhere again.
              </p>
              <p>
                Courses they own here keep them as the owner; reassign them from the Courses tab if
                needed.
              </p>
            </>
          }
          onConfirm={() => removeMembership.mutateAsync(membership.membershipId)}
        />
      ) : null}
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title="Delete account"
        destructive
        confirmLabel="Delete account"
        description={
          <>
            <p>
              Soft-deletes <strong>{user.name}</strong>'s account: their membership, roster entries
              and enrollments are removed and all their sessions end. They can no longer sign in.
            </p>
            <p>Lessons and payments are kept as history.</p>
          </>
        }
        onConfirm={() => deleteAccount.mutateAsync()}
      />
    </div>
  )
}
