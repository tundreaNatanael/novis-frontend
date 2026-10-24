import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { lessonKeys } from '@/api/lessons'
import { studentKeys, studentsApi } from '@/api/students'
import { Field } from '@/components/form/field'
import { FormError } from '@/components/form/form-error'
import { FormSheet } from '@/components/form/form-sheet'
import { SelectField } from '@/components/form/select-field'
import { applyServerErrors } from '@/components/form/server-errors'
import { Input } from '@/components/ui/input'
import { useOrgTeachers, useTeacherCourses } from '@/features/org-workspace/hooks/use-org-lookups'
import { prepaidCountSchema } from '@/lib/schemas'

const schema = z.object({
  count: prepaidCountSchema,
  teacherId: z.string().min(1, 'Choose a teacher'),
  courseId: z.string(),
})
type FormInput = z.input<typeof schema>
type FormValues = z.output<typeof schema>

interface Props {
  studentId: string
  studentName: string
  /** Fixed teacher (lesson detail, freelance workspace). Without it `organizationId` feeds a teacher picker. */
  teacher?: { id: string; name?: string }
  organizationId?: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** `POST /students/{id}/lessons/prepaid`: N pending, unscheduled, paid lessons with one teacher (a pack). */
export function AddPrepaidSheet({
  studentId,
  studentName,
  teacher,
  organizationId,
  open,
  onOpenChange,
}: Props) {
  const queryClient = useQueryClient()
  const [formError, setFormError] = useState<string | null>(null)
  const defaults = (): FormInput => ({ count: 10, teacherId: teacher?.id ?? '', courseId: '' })
  const form = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaults(),
  })
  const teacherId = form.watch('teacherId')
  const teachers = useOrgTeachers(organizationId ?? '', open && !teacher && !!organizationId)
  const courses = useTeacherCourses(teacherId, open)

  useEffect(() => {
    if (open) {
      form.reset({ count: 10, teacherId: teacher?.id ?? '', courseId: '' })
      setFormError(null)
    }
  }, [open, form, teacher?.id])

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      studentsApi.addPrepaid(studentId, {
        count: values.count,
        teacherId: values.teacherId,
        ...(values.courseId ? { courseId: values.courseId } : {}),
      }),
    onSuccess: async (result) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: studentKeys.all }),
        queryClient.invalidateQueries({ queryKey: lessonKeys.lists() }),
      ])
      const remaining = result.summary.prepaidRemaining
      toast.success(
        `${result.created} prepaid ${result.created === 1 ? 'lesson' : 'lessons'} added`,
        remaining === null
          ? undefined
          : { description: `${remaining} prepaid left with this teacher.` },
      )
      onOpenChange(false)
    },
    onError: (error) =>
      setFormError(applyServerErrors(error, form.setError, ['count', 'teacherId', 'courseId'])),
  })

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Add prepaid lessons"
      description={`A pack of paid lessons for ${studentName}${teacher?.name ? ` with ${teacher.name}` : ''}. Each one is spent when a dated lesson is booked.`}
      submitLabel="Add prepaid lessons"
      isSubmitting={mutation.isPending}
      onSubmit={form.handleSubmit((values) => {
        setFormError(null)
        mutation.mutate(values)
      })}
    >
      <FormError message={formError} />
      {!teacher ? (
        <Field
          label="Teacher"
          required
          hint="The student must be on this teacher’s roster or enrolled in one of their courses."
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
                  onChange={(value) => {
                    field.onChange(value)
                    form.setValue('courseId', '')
                  }}
                  options={(teachers.data ?? []).map((m) => ({
                    value: m.userId,
                    label: m.name,
                    description: m.email,
                  }))}
                  placeholder={teachers.isPending ? 'Loading teachers…' : 'Choose a teacher'}
                  emptyText="This organization has no teachers yet."
                />
              )}
            />
          )}
        </Field>
      ) : null}
      <Field
        label="Number of lessons"
        required
        hint="1 to 50."
        error={form.formState.errors.count?.message}
      >
        {(a11y) => (
          <Input
            {...a11y}
            type="number"
            min={1}
            max={50}
            inputMode="numeric"
            autoFocus={!!teacher}
            {...form.register('count')}
          />
        )}
      </Field>
      <Field
        label="Course"
        hint="Optional: credits bought for a course are spent only on that course; without one they fit any lesson with this teacher."
        error={form.formState.errors.courseId?.message}
      >
        {(a11y) => (
          <Controller
            control={form.control}
            name="courseId"
            render={({ field }) => (
              <SelectField
                id={a11y.id}
                value={field.value}
                onChange={field.onChange}
                options={(courses.data ?? []).map((c) => ({ value: c.id, label: c.title }))}
                disabled={!teacherId}
                placeholder={
                  !teacherId
                    ? 'Choose a teacher first'
                    : courses.isPending
                      ? 'Loading courses…'
                      : 'Any course'
                }
                emptyText="This teacher has no courses yet."
              />
            )}
          />
        )}
      </Field>
    </FormSheet>
  )
}
