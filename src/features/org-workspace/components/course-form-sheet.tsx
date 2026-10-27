import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { courseKeys, coursesApi } from '@/api/courses'
import { studentKeys } from '@/api/students'
import type { Course } from '@/api/types'
import { Field } from '@/components/form/field'
import { FormError } from '@/components/form/form-error'
import { FormSheet } from '@/components/form/form-sheet'
import { SelectField } from '@/components/form/select-field'
import { applyServerErrors } from '@/components/form/server-errors'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  longTextSchema,
  optionalLessonDurationSchema,
  titleSchema,
  uuidSchema,
} from '@/lib/schemas'
import { memberName, useOrgTeachers } from '../hooks/use-org-lookups'
import { useWorkspaceScope } from '../use-org-workspace'

const schema = z.object({
  title: titleSchema,
  description: longTextSchema,
  teacherId: uuidSchema,
  status: z.enum(['ACTIVE', 'ARCHIVED']),
  defaultDurationMinutes: optionalLessonDurationSchema,
})
type FormInput = z.input<typeof schema>
type FormValues = z.output<typeof schema>

/**
 * An optional field of the edit form for `PATCH /courses/{id}`: the typed value, `null` when a
 * value was emptied (the API removes it), left out when it was and stays empty, so a save never
 * removes a value added elsewhere meanwhile.
 */
function removable(value: string, current: string | null) {
  if (value) return value
  return current ? null : undefined
}

/** `removable` for the default lesson length (`null` once the field is emptied). */
function removableLength(value: number | null, current: number | null) {
  if (value !== null) return value
  return current !== null ? null : undefined
}

interface CourseFormSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  course?: Course
  /** Preselected owner when creating from a teacher page. */
  teacherId?: string
  onSaved?: (course: Course) => void
}

/** Create or edit a course (`POST /courses`, `PATCH /courses/{id}`); reassigning moves it away from its teacher. */
export function CourseFormSheet({
  open,
  onOpenChange,
  course,
  teacherId,
  onSaved,
}: CourseFormSheetProps) {
  const scope = useWorkspaceScope()
  const { capabilities } = scope
  const orgId = scope.kind === 'org' ? scope.orgId : null
  const fixedTeacherId = scope.kind === 'freelance' ? scope.teacherId : undefined
  const queryClient = useQueryClient()
  const [formError, setFormError] = useState<string | null>(null)
  const teachers = useOrgTeachers(orgId ?? '', open && scope.kind === 'org')
  const defaults = (): FormInput => ({
    title: course?.title ?? '',
    description: course?.description ?? '',
    teacherId: course?.teacherId ?? teacherId ?? fixedTeacherId ?? '',
    status: course?.status ?? 'ACTIVE',
    defaultDurationMinutes: course?.defaultDurationMinutes?.toString() ?? '',
  })
  const form = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaults(),
  })

  useEffect(() => {
    if (open) {
      form.reset(defaults())
      setFormError(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when the sheet opens
  }, [open, course, teacherId])

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      if (!course)
        return coursesApi.create({
          title: values.title,
          description: values.description,
          ...(values.defaultDurationMinutes !== null
            ? { defaultDurationMinutes: values.defaultDurationMinutes }
            : {}),
          teacherId: values.teacherId,
          ...(orgId ? { organizationId: orgId } : {}),
        })
      return coursesApi.update(course.id, {
        title: values.title,
        description: removable(values.description, course.description),
        defaultDurationMinutes: removableLength(
          values.defaultDurationMinutes,
          course.defaultDurationMinutes,
        ),
        status: values.status,
        ...(values.teacherId !== course.teacherId ? { teacherId: values.teacherId } : {}),
      })
    },
    onSuccess: async (saved) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: courseKeys.all }),
        queryClient.invalidateQueries({ queryKey: studentKeys.all }),
      ])
      toast.success(course ? 'Course updated' : 'Course created')
      onOpenChange(false)
      onSaved?.(saved)
    },
    onError: (error) =>
      setFormError(
        applyServerErrors(error, form.setError, [
          'title',
          'description',
          'teacherId',
          'status',
          'defaultDurationMinutes',
        ]),
      ),
  })

  const selectedTeacher = form.watch('teacherId')
  const reassigning = !!course && selectedTeacher !== course.teacherId
  const teacherOptions = (teachers.data ?? []).map((t) => ({
    value: t.userId,
    label: t.name,
    description: t.email,
  }))

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title={course ? 'Edit course' : 'New course'}
      description={
        course
          ? undefined
          : `A course of ${scope.kind === 'org' ? scope.org.name : scope.teacher.name}. A course belongs to exactly one teacher.`
      }
      submitLabel={course ? 'Save changes' : 'Create course'}
      isSubmitting={mutation.isPending}
      onSubmit={form.handleSubmit((values) => {
        setFormError(null)
        mutation.mutate(values)
      })}
    >
      <FormError message={formError} />
      <Field label="Title" required error={form.formState.errors.title?.message}>
        {(a11y) => (
          <Input
            {...a11y}
            autoFocus={!course}
            placeholder="Piano — beginners"
            {...form.register('title')}
          />
        )}
      </Field>
      {scope.kind === 'freelance' ? (
        <Field label="Teacher" hint="A freelance course belongs to this teacher.">
          {(a11y) => <Input {...a11y} value={scope.teacher.name} readOnly />}
        </Field>
      ) : (
        <Field
          label="Teacher"
          required
          hint={course ? undefined : 'The owner. Only admins can change it later.'}
          error={form.formState.errors.teacherId?.message}
        >
          {(a11y) => (
            <Controller
              control={form.control}
              name="teacherId"
              render={({ field }) => (
                <SelectField
                  id={a11y.id}
                  aria-describedby={a11y['aria-describedby']}
                  aria-invalid={a11y['aria-invalid']}
                  value={field.value}
                  onChange={field.onChange}
                  options={teacherOptions}
                  disabled={!!course && !capabilities.canReassignCourse}
                  placeholder={teachers.isPending ? 'Loading teachers…' : 'Choose a teacher'}
                  emptyText="No teachers yet. Add one in the Teachers tab."
                />
              )}
            />
          )}
        </Field>
      )}
      {reassigning ? (
        <Alert>
          <AlertDescription>
            Moves this course away from{' '}
            {memberName(teachers.data, course.teacherId) ?? 'its current teacher'} to{' '}
            {memberName(teachers.data, selectedTeacher) ?? 'the selected teacher'}. Existing lessons
            keep their teacher.
          </AlertDescription>
        </Alert>
      ) : null}
      <Field
        label="Description"
        hint="Up to 4000 characters."
        error={form.formState.errors.description?.message}
      >
        {(a11y) => <Textarea {...a11y} rows={3} {...form.register('description')} />}
      </Field>
      <Field
        label="Default lesson length (minutes)"
        hint={
          course?.defaultDurationMinutes
            ? '15–240 minutes, given to new lessons of this course. Empty it to go back to 60; booked lessons keep their length.'
            : 'Optional, 15–240 minutes. New lessons of this course get it unless they name their own; otherwise they last 60 minutes.'
        }
        error={form.formState.errors.defaultDurationMinutes?.message}
      >
        {(a11y) => (
          <Input
            {...a11y}
            type="number"
            inputMode="numeric"
            min={15}
            max={240}
            step={5}
            placeholder="60"
            {...form.register('defaultDurationMinutes')}
          />
        )}
      </Field>
      {course ? (
        <Field label="Status" error={form.formState.errors.status?.message}>
          {(a11y) => (
            <Controller
              control={form.control}
              name="status"
              render={({ field }) => (
                <SelectField
                  id={a11y.id}
                  value={field.value}
                  onChange={field.onChange}
                  options={[
                    {
                      value: 'ACTIVE',
                      label: 'Active',
                      description: 'Students can be enrolled and lessons booked',
                    },
                    {
                      value: 'ARCHIVED',
                      label: 'Archived',
                      description: 'Kept for history; hidden from new work',
                    },
                  ]}
                />
              )}
            />
          )}
        </Field>
      ) : null}
    </FormSheet>
  )
}
