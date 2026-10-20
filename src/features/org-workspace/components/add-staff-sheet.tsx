import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { z } from 'zod'
import { courseKeys, coursesApi } from '@/api/courses'
import { errorMessage, isApiError } from '@/api/errors'
import { memberKeys, membersApi } from '@/api/members'
import type { Member, StaffRole } from '@/api/types'
import { Field } from '@/components/form/field'
import { FormError } from '@/components/form/form-error'
import { FormSheet } from '@/components/form/form-sheet'
import { PasswordField } from '@/components/form/password-field'
import { SelectField } from '@/components/form/select-field'
import { applyServerErrors } from '@/components/form/server-errors'
import { StepStatus, type Step } from '@/components/form/step-status'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { emailSchema, nameSchema, passwordSchema, titleSchema, uuidSchema } from '@/lib/schemas'
import { courseLabel, useOrgCourses, useOrgTeachers } from '../hooks/use-org-lookups'
import { useOrgWorkspace } from '../use-org-workspace'

const schema = z
  .object({
    email: emailSchema,
    name: nameSchema,
    password: passwordSchema,
    courseMode: z.enum(['none', 'new', 'move']),
    courseTitle: z.string().trim(),
    courseId: z.string(),
  })
  .superRefine((values, ctx) => {
    if (values.courseMode === 'new') {
      const title = titleSchema.safeParse(values.courseTitle)
      if (!title.success)
        ctx.addIssue({
          code: 'custom',
          path: ['courseTitle'],
          message: title.error.issues[0]?.message ?? 'Enter a title',
        })
    }
    if (values.courseMode === 'move' && !uuidSchema.safeParse(values.courseId).success) {
      ctx.addIssue({ code: 'custom', path: ['courseId'], message: 'Choose a course' })
    }
  })
type FormValues = z.infer<typeof schema>

interface AddStaffSheetProps {
  role: StaffRole
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (member: Member) => void
}

/**
 * Creates an admin or a teacher with a password (`POST /orgs/{orgId}/staff`, gap G1-B). For
 * teachers a second step creates a course for them or moves an existing one (gap G2-A); a failed
 * second step is reported precisely and can be retried or skipped.
 */
export function AddStaffSheet({ role, open, onOpenChange, onCreated }: AddStaffSheetProps) {
  const { orgId, org, basePath } = useOrgWorkspace()
  const queryClient = useQueryClient()
  const isTeacher = role === 'TEACHER'
  const [formError, setFormError] = useState<string | null>(null)
  const [member, setMember] = useState<Member | null>(null)
  const [courseError, setCourseError] = useState<string | null>(null)
  const [running, setRunning] = useState(false)
  const courses = useOrgCourses(orgId, open && isTeacher)
  const teachers = useOrgTeachers(orgId, open && isTeacher)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      email: '',
      name: '',
      password: '',
      courseMode: isTeacher ? 'new' : 'none',
      courseTitle: '',
      courseId: '',
    },
  })

  useEffect(() => {
    if (open) {
      form.reset({
        email: '',
        name: '',
        password: '',
        courseMode: isTeacher ? 'new' : 'none',
        courseTitle: '',
        courseId: '',
      })
      setMember(null)
      setCourseError(null)
      setFormError(null)
    }
  }, [open, isTeacher, form])

  const finish = (created: Member) => {
    onOpenChange(false)
    onCreated(created)
  }

  const runCourseStep = async (created: Member, values: FormValues) => {
    setCourseError(null)
    try {
      if (values.courseMode === 'new') {
        await coursesApi.create({
          title: values.courseTitle,
          teacherId: created.userId,
          organizationId: orgId,
        })
      } else if (values.courseMode === 'move') {
        await coursesApi.update(values.courseId, { teacherId: created.userId })
      }
      await queryClient.invalidateQueries({ queryKey: courseKeys.all })
      toast.success(values.courseMode === 'new' ? 'Course created' : 'Course moved')
      finish(created)
    } catch (error) {
      setCourseError(isApiError(error) ? error.message : errorMessage(error))
    }
  }

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError(null)
    setRunning(true)
    try {
      let created = member
      if (!created) {
        try {
          created = await membersApi.createStaff(orgId, {
            email: values.email,
            name: values.name,
            password: values.password,
            role,
          })
        } catch (error) {
          // `errorMessage` words the 409s by code: ROLE_CONFLICT (a role elsewhere, a student
          // account), INVITE_PENDING, and ACCOUNT_WITHOUT_ROLE (a known account without a role,
          // which is invited instead).
          setFormError(applyServerErrors(error, form.setError, ['email', 'name', 'password']))
          return
        }
        setMember(created)
        await queryClient.invalidateQueries({ queryKey: memberKeys.org(orgId) })
        toast.success(isTeacher ? 'Teacher created' : 'Admin created')
      }
      if (isTeacher && values.courseMode !== 'none') await runCourseStep(created, values)
      else finish(created)
    } finally {
      setRunning(false)
    }
  })

  const courseMode = form.watch('courseMode')
  const steps: Step[] | null = member
    ? [
        {
          label: `Account created for ${member.email}`,
          state: 'done',
          detail: 'They can sign in right away with the password you set.',
        },
        {
          label: courseMode === 'new' ? 'Create their course' : 'Move the course to them',
          state: courseError ? 'failed' : running ? 'running' : 'pending',
          detail: courseError ?? undefined,
        },
      ]
    : null

  const movableCourses = (courses.data ?? []).map((course) => ({
    value: course.id,
    label: course.title,
    description: `Currently taught by ${teachers.data?.find((t) => t.userId === course.teacherId)?.name ?? 'another teacher'}`,
  }))

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title={isTeacher ? 'Add teacher' : 'Add admin'}
      description={
        isTeacher
          ? `A teacher account in ${org.name} with a password you choose, plus a course they own.`
          : `An admin account in ${org.name} with a password you choose. Admins manage teachers, students and courses.`
      }
      submitLabel={member ? 'Retry course step' : isTeacher ? 'Create teacher' : 'Create admin'}
      isSubmitting={running}
      onSubmit={onSubmit}
      footerStart={
        member ? (
          <Button type="button" variant="ghost" onClick={() => finish(member)}>
            Skip for now
          </Button>
        ) : (
          <Link
            to={`${basePath}/invites?new=1&role=${role}`}
            className="text-sm text-muted-foreground underline-offset-4 hover:underline"
          >
            Invite by email instead
          </Link>
        )
      }
    >
      <FormError message={formError} />
      {steps ? <StepStatus steps={steps} /> : null}
      <fieldset disabled={!!member} className="flex flex-col gap-4">
        <Field label="Email" required error={form.formState.errors.email?.message}>
          {(a11y) => (
            <Input
              {...a11y}
              type="email"
              autoComplete="off"
              inputMode="email"
              autoFocus
              {...form.register('email')}
            />
          )}
        </Field>
        <Field label="Name" required error={form.formState.errors.name?.message}>
          {(a11y) => <Input {...a11y} autoComplete="off" {...form.register('name')} />}
        </Field>
        <Field
          label="Password"
          required
          hint="8 to 128 characters. Share it with them privately; they can change it later or ask for a reset link."
          error={form.formState.errors.password?.message}
        >
          {(a11y) => (
            <Controller
              control={form.control}
              name="password"
              render={({ field }) => (
                <PasswordField {...a11y} value={field.value} onChange={field.onChange} generate />
              )}
            />
          )}
        </Field>
      </fieldset>
      {isTeacher ? (
        <fieldset className="flex flex-col gap-3 rounded-lg border border-border p-3">
          <legend className="px-1 text-sm font-medium text-foreground">Course</legend>
          <p className="text-xs text-muted-foreground">A course belongs to exactly one teacher.</p>
          <Controller
            control={form.control}
            name="courseMode"
            render={({ field }) => (
              <div className="flex flex-col gap-2" role="radiogroup" aria-label="Course">
                {(
                  [
                    ['new', 'Create a new course for them'],
                    ['move', 'Move an existing course to them'],
                    ['none', 'No course yet'],
                  ] as const
                ).map(([value, label]) => (
                  <Label
                    key={value}
                    className="flex min-h-9 cursor-pointer items-center gap-2 font-normal"
                  >
                    <input
                      type="radio"
                      name="courseMode"
                      value={value}
                      checked={field.value === value}
                      onChange={() => field.onChange(value)}
                      className="size-4 accent-primary"
                    />
                    {label}
                  </Label>
                ))}
              </div>
            )}
          />
          {courseMode === 'new' ? (
            <Field label="Course title" required error={form.formState.errors.courseTitle?.message}>
              {(a11y) => (
                <Input
                  {...a11y}
                  placeholder="Piano — beginners"
                  {...form.register('courseTitle')}
                />
              )}
            </Field>
          ) : null}
          {courseMode === 'move' ? (
            <Field
              label="Course to move"
              required
              hint="The course leaves its current teacher."
              error={form.formState.errors.courseId?.message}
            >
              {(a11y) => (
                <Controller
                  control={form.control}
                  name="courseId"
                  render={({ field }) => (
                    <SelectField
                      id={a11y.id}
                      aria-describedby={a11y['aria-describedby']}
                      aria-invalid={a11y['aria-invalid']}
                      value={field.value}
                      onChange={field.onChange}
                      options={movableCourses}
                      placeholder={courses.isPending ? 'Loading courses…' : 'Choose a course'}
                      emptyText="This organization has no courses yet."
                    />
                  )}
                />
              )}
            </Field>
          ) : null}
        </fieldset>
      ) : null}
      {isTeacher && courses.data ? (
        <p className="sr-only">
          {courses.data.map((c) => courseLabel(c, teachers.data)).join(', ')}
        </p>
      ) : null}
    </FormSheet>
  )
}
