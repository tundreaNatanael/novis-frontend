import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { BookOpen, KeyRound, Pencil, Plus, Trash2, UserMinus } from 'lucide-react'
import { useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'
import { courseKeys, coursesApi } from '@/api/courses'
import { memberKeys, membersApi } from '@/api/members'
import type { Member, StaffRole } from '@/api/types'
import { userKeys, usersApi } from '@/api/users'
import type { RouteHandle } from '@/app/route-handle'
import { PageSkeleton } from '@/app/shell/app-shell'
import { useMe } from '@/auth/session'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { ErrorState } from '@/components/data/error-state'
import { DetailHeader } from '@/components/detail/detail-header'
import {
  BooleanValue,
  DetailField,
  DetailPanel,
  EnumValue,
  IdValue,
  TimeValue,
} from '@/components/detail/detail-panel'
import { RowActions } from '@/components/row-actions'
import { StatusBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import { enumLabel } from '@/lib/format'
import { usePageTitle } from '@/lib/use-page-title'
import { CourseFormSheet } from '../components/course-form-sheet'
import { UserCrumb } from '../components/crumbs'
import { EditUserSheet } from '../components/edit-user-sheet'
import { ResetLinkDialog } from '../components/reset-link-dialog'
import { useUserMemberships } from '../hooks/use-user-memberships'
import { useOrgWorkspace } from '../use-org-workspace'

export const handle: RouteHandle = { crumb: (params) => <UserCrumb userId={params.userId} /> }

const COURSES = { page: 0, size: 100, sort: 'title,asc' }

/** Admin or teacher detail: `GET /users/{id}` (every field, memberships), courses they own here. */
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
  const [removing, setRemoving] = useState<Member | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [newCourse, setNewCourse] = useState(false)

  const userQuery = useQuery({
    queryKey: userKeys.detail(userId),
    queryFn: ({ signal }) => usersApi.get(userId, signal),
  })
  const memberships = useUserMemberships(orgId, userId)
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
    mutationFn: (member: Member) => membersApi.remove(member.membershipId),
    onSuccess: async () => {
      await invalidate()
      toast.success('Removed from organization')
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
  const hereMemberships = memberships.data ?? []
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
                ...hereMemberships.map((m) => ({
                  label: `Remove ${enumLabel(m.role).toLowerCase()} role in ${org.name}`,
                  icon: UserMinus,
                  destructive: true,
                  separatorBefore: true,
                  onSelect: () => setRemoving(m),
                  disabledReason: capabilities.removeMembershipDisabledReason({
                    userId: m.userId,
                    organizationId: orgId,
                    role: m.role,
                  }),
                })),
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
      <div className="grid gap-5 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
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
          <DetailField label="Platform role">
            {user.platformRole ? (
              <EnumValue value={user.platformRole} />
            ) : (
              <span className="text-muted-foreground">None</span>
            )}
          </DetailField>
          <DetailField label="Freelance teacher">
            <BooleanValue value={user.freelanceTeacher} />
          </DetailField>
          <DetailField label="Created">
            <TimeValue value={user.createdAt} />
          </DetailField>
          {self ? (
            <DetailField label="Note">This is your own account. Edit it under Account.</DetailField>
          ) : null}
        </DetailPanel>
        <div className="flex flex-col gap-5">
          <DetailPanel
            title="Memberships"
            description="Organizations where this account holds a role."
          >
            {user.memberships.length === 0 ? (
              <DetailField label="None">
                This account holds no role in any organization.
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
                  {m.organizationId === orgId ? (
                    <span className="ml-2 text-xs text-muted-foreground">(this organization)</span>
                  ) : null}
                </DetailField>
              ))
            )}
          </DetailPanel>
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
      {removing ? (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && setRemoving(null)}
          title="Remove from this organization"
          destructive
          confirmLabel="Remove from organization"
          description={
            <>
              <p>
                Removes the <strong>{enumLabel(removing.role).toLowerCase()}</strong> role of{' '}
                <strong>{user.name}</strong> in <strong>{org.name}</strong>. The account and roles
                elsewhere are not affected.
              </p>
              <p>
                Courses they own here keep them as the owner; reassign them from the Courses tab if
                needed.
              </p>
            </>
          }
          onConfirm={async () => {
            await removeMembership.mutateAsync(removing)
            setRemoving(null)
            if (hereMemberships.length <= 1) navigate(`${basePath}/${segment}`)
          }}
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
              Soft-deletes <strong>{user.name}</strong>'s account: every membership, roster entry
              and enrollment is removed and all their sessions end. They can no longer sign in.
            </p>
            <p>Lessons and payments are kept as history.</p>
          </>
        }
        onConfirm={() => deleteAccount.mutateAsync()}
      />
    </div>
  )
}
