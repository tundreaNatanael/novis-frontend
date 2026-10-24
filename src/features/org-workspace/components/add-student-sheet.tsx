import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { enrollmentKeys, enrollmentsApi } from '@/api/enrollments'
import { errorMessage, isApiError } from '@/api/errors'
import { memberKeys } from '@/api/members'
import { studentKeys, studentsApi } from '@/api/students'
import type { Course, Student, StudentCreated } from '@/api/types'
import { Field } from '@/components/form/field'
import { FormError } from '@/components/form/form-error'
import { FormSheet } from '@/components/form/form-sheet'
import { SelectField } from '@/components/form/select-field'
import { applyServerErrors } from '@/components/form/server-errors'
import { StepStatus, type Step } from '@/components/form/step-status'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { emailSchema, nameSchema } from '@/lib/schemas'
import {
  courseLabel,
  useOrgCourses,
  useOrgTeachers,
  useTeacherCourses,
} from '../hooks/use-org-lookups'
import { useWorkspaceScope } from '../use-org-workspace'

const schema = z.object({ name: nameSchema, email: emailSchema, courseId: z.string() })
type FormValues = z.infer<typeof schema>

interface AddStudentSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (student: Student) => void
}

/**
 * Creates a student (`POST /students`, no password: students sign in with their email) and
 * enrols them in a course (`POST /courses/{courseId}/enrollments`). The API requires a name
 * (gap G3). Siblings may share one email: the same name under a known email is the same child
 * (linked), another name a new profile next to it (`profileCreated`, D-049). A failed enrollment
 * is reported and can be retried or skipped.
 */
export function AddStudentSheet({ open, onOpenChange, onCreated }: AddStudentSheetProps) {
  const scope = useWorkspaceScope()
  const orgId = scope.kind === 'org' ? scope.orgId : null
  const scopeName = scope.kind === 'org' ? scope.org.name : scope.teacher.name
  const queryClient = useQueryClient()
  const [formError, setFormError] = useState<string | null>(null)
  const [student, setStudent] = useState<StudentCreated | null>(null)
  const [enrollError, setEnrollError] = useState<string | null>(null)
  const [running, setRunning] = useState(false)
  const orgCourses = useOrgCourses(orgId ?? '', open && scope.kind === 'org')
  const teacherCourses = useTeacherCourses(
    scope.kind === 'freelance' ? scope.teacherId : '',
    open && scope.kind === 'freelance',
  )
  const courses = scope.kind === 'org' ? orgCourses : teacherCourses
  const teachers = useOrgTeachers(orgId ?? '', open && scope.kind === 'org')
  const lookupsPending = courses.isPending || (scope.kind === 'org' && teachers.isPending)

  /**
   * Org scope: the course's teacher, while they are still a TEACHER of the organization. A removed
   * teacher's courses stay active as history, and naming them as roster teacher is `404 Teacher`,
   * so such a student is created without a roster teacher and the enrollment alone links them.
   */
  const rosterTeacherOf = (course: Course | undefined): string | undefined =>
    course && teachers.data?.some((t) => t.userId === course.teacherId)
      ? course.teacherId
      : undefined

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', email: '', courseId: '' },
  })

  useEffect(() => {
    if (open) {
      form.reset({ name: '', email: '', courseId: '' })
      setStudent(null)
      setEnrollError(null)
      setFormError(null)
    }
  }, [open, form])

  const finish = (created: Student) => {
    onOpenChange(false)
    onCreated(created)
  }

  const enrol = async (created: Student, courseId: string) => {
    setEnrollError(null)
    try {
      await enrollmentsApi.enroll(courseId, { studentId: created.id })
      toast.success('Student enrolled')
    } catch (error) {
      if (!(isApiError(error) && error.isConflict)) {
        // The server's own sentence says why (e.g. not a member of the course's organization).
        setEnrollError(isApiError(error) ? error.message : errorMessage(error))
        return
      }
      // 409: already enrolled — the goal is reached.
    }
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: enrollmentKeys.course(courseId) }),
      queryClient.invalidateQueries({ queryKey: studentKeys.enrollments(created.id, {}) }),
    ])
    finish(created)
  }

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError(null)
    setRunning(true)
    try {
      let created = student
      if (!created) {
        const rosterTeacherId = rosterTeacherOf(courses.data?.find((c) => c.id === values.courseId))
        try {
          created = await studentsApi.create(
            scope.kind === 'org'
              ? {
                  name: values.name,
                  email: values.email,
                  organizationId: scope.orgId,
                  // Roster the student under the course's teacher so the teacher sees them at once (D-011).
                  ...(rosterTeacherId ? { teacherId: rosterTeacherId } : {}),
                }
              : // Freelance: the super-admin names the teacher and no organization (gap G5-B).
                { name: values.name, email: values.email, teacherId: scope.teacherId },
          )
        } catch (error) {
          setFormError(applyServerErrors(error, form.setError, ['name', 'email']))
          return
        }
        setStudent(created)
        await Promise.all([
          ...(orgId ? [queryClient.invalidateQueries({ queryKey: memberKeys.org(orgId) })] : []),
          queryClient.invalidateQueries({ queryKey: studentKeys.all }),
        ])
        toast.success(
          created.profileCreated ? `New profile created for ${created.name}` : 'Student created',
        )
      }
      if (values.courseId) await enrol(created, values.courseId)
      else finish(created)
    } finally {
      setRunning(false)
    }
  })

  const courseId = form.watch('courseId')
  const selectedCourse = courses.data?.find((c) => c.id === courseId)
  const courseWithoutTeacher =
    scope.kind === 'org' && !!selectedCourse && !!teachers.data && !rosterTeacherOf(selectedCourse)
  const steps: Step[] | null = student
    ? [
        {
          label: `Student created: ${student.email}`,
          state: 'done',
          detail: student.profileCreated
            ? 'Students sign in with their email only; no password. Siblings on this email each pick their name at sign-in.'
            : 'Linked the existing student of this name on this email. Students sign in with their email only; no password.',
        },
        {
          label: 'Enrol in the course',
          state: enrollError ? 'failed' : running ? 'running' : 'pending',
          detail: enrollError ?? undefined,
        },
      ]
    : null

  const options = (courses.data ?? [])
    .filter((c) => c.status === 'ACTIVE')
    .map((c) => ({
      value: c.id,
      label: scope.kind === 'org' ? courseLabel(c, teachers.data) : c.title,
    }))

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Add student"
      description={`A student of ${scopeName}. Students sign in with their email only, so no password is needed.`}
      submitLabel={student ? 'Retry enrollment' : 'Create student'}
      isSubmitting={running}
      onSubmit={onSubmit}
      footerStart={
        student ? (
          <Button type="button" variant="ghost" onClick={() => finish(student)}>
            Skip for now
          </Button>
        ) : null
      }
    >
      <FormError message={formError} />
      {steps ? <StepStatus steps={steps} /> : null}
      <fieldset disabled={!!student} className="flex flex-col gap-4">
        <Field label="Name" required error={form.formState.errors.name?.message}>
          {(a11y) => <Input {...a11y} autoComplete="off" autoFocus {...form.register('name')} />}
        </Field>
        <Field
          label="Email"
          required
          hint={
            scope.kind === 'org'
              ? 'Siblings can share one email: each name on it is its own profile. The same name links the existing student of this organization; the same name at another school or teacher cannot be added.'
              : 'Siblings can share one email: each name on it is its own profile. The same name links this teacher’s existing student; the same name at a school or another teacher cannot be added.'
          }
          error={form.formState.errors.email?.message}
        >
          {(a11y) => (
            <Input
              {...a11y}
              type="email"
              inputMode="email"
              autoComplete="off"
              {...form.register('email')}
            />
          )}
        </Field>
      </fieldset>
      <Field
        label="Course"
        hint={
          courseWithoutTeacher
            ? 'This course’s teacher no longer teaches here, so the student is enrolled without a roster teacher. Reassign the course in the Courses tab.'
            : courseId
              ? 'The student is also placed on this course teacher’s roster.'
              : 'Pick a course to enrol the student right away, or leave it for later.'
        }
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
                value={field.value}
                onChange={field.onChange}
                options={options}
                disabled={!!student || lookupsPending}
                placeholder={lookupsPending ? 'Loading courses…' : 'No course yet'}
                emptyText="No active courses yet. Create one in the Courses tab."
              />
            )}
          />
        )}
      </Field>
    </FormSheet>
  )
}
