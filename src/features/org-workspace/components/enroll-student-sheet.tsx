import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { enrollmentKeys, enrollmentsApi } from '@/api/enrollments'
import { isApiError } from '@/api/errors'
import { studentKeys, studentsApi } from '@/api/students'
import type { Course } from '@/api/types'
import { Field } from '@/components/form/field'
import { FormError } from '@/components/form/form-error'
import { FormSheet } from '@/components/form/form-sheet'
import { SelectField } from '@/components/form/select-field'
import { uuidSchema } from '@/lib/schemas'
import { useOrgStudents } from '../hooks/use-org-lookups'

const schema = z.object({ studentId: uuidSchema })
type FormValues = z.infer<typeof schema>

interface EnrollStudentSheetProps {
  course: Course
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** `POST /courses/{courseId}/enrollments`: org courses take STUDENT members of the organization; freelance courses the teacher's roster. */
export function EnrollStudentSheet({ course, open, onOpenChange }: EnrollStudentSheetProps) {
  const queryClient = useQueryClient()
  const [formError, setFormError] = useState<string | null>(null)
  const orgStudents = useOrgStudents(
    course.organizationId ?? '',
    open && course.organizationId !== null,
  )
  const rosterStudents = useQuery({
    queryKey: studentKeys.list({ teacherId: course.teacherId }, { size: 100, sort: 'name,asc' }),
    queryFn: ({ signal }) =>
      studentsApi.list({ teacherId: course.teacherId }, { size: 100, sort: 'name,asc' }, signal),
    enabled: open && course.organizationId === null,
    select: (page) => page.content,
  })
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { studentId: '' },
  })

  useEffect(() => {
    if (open) {
      form.reset({ studentId: '' })
      setFormError(null)
    }
  }, [open, form])

  const mutation = useMutation({
    mutationFn: (values: FormValues) => enrollmentsApi.enroll(course.id, values),
    onSuccess: async (_e, values) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: enrollmentKeys.course(course.id) }),
        queryClient.invalidateQueries({ queryKey: studentKeys.enrollments(values.studentId, {}) }),
        queryClient.invalidateQueries({
          queryKey: [...studentKeys.all, 'enrollments', values.studentId],
        }),
      ])
      toast.success('Student enrolled')
      onOpenChange(false)
    },
    onError: (error) => {
      if (isApiError(error) && error.isConflict)
        setFormError('This student is already enrolled in the course.')
      else if (isApiError(error) && error.isNotFound)
        setFormError(
          'This student is not a member of the course’s organization (or roster), so they cannot be enrolled.',
        )
      else setFormError(error instanceof Error ? error.message : 'Could not enrol the student.')
    },
  })

  const options = course.organizationId
    ? (orgStudents.data ?? []).map((m) => ({
        value: m.userId,
        label: m.name,
        description: m.email,
      }))
    : (rosterStudents.data ?? []).map((s) => ({ value: s.id, label: s.name, description: s.email }))
  const loading = course.organizationId ? orgStudents.isPending : rosterStudents.isPending

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Enrol a student"
      description={`Gives the student access to ${course.title}: its materials, homework and lessons.`}
      submitLabel="Enrol student"
      isSubmitting={mutation.isPending}
      onSubmit={form.handleSubmit((values) => {
        setFormError(null)
        mutation.mutate(values)
      })}
    >
      <FormError message={formError} />
      <Field label="Student" required error={form.formState.errors.studentId?.message}>
        {(a11y) => (
          <Controller
            control={form.control}
            name="studentId"
            render={({ field }) => (
              <SelectField
                id={a11y.id}
                aria-describedby={a11y['aria-describedby']}
                aria-invalid={a11y['aria-invalid']}
                value={field.value}
                onChange={field.onChange}
                options={options}
                placeholder={loading ? 'Loading students…' : 'Choose a student'}
                emptyText={
                  course.organizationId
                    ? 'No students in this organization yet.'
                    : 'No students on this teacher’s roster yet.'
                }
              />
            )}
          />
        )}
      </Field>
    </FormSheet>
  )
}
