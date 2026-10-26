import { Loader2, Ticket } from 'lucide-react'
import { useId, useState } from 'react'
import { toast } from 'sonner'
import { SelectField } from '@/components/form/select-field'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { Stepper } from '../components/form-controls'
import { TeachSheet } from '../components/teach-sheet'
import { useTeacherCourses } from '../data/courses'
import { useAddPrepaid } from '../data/mutations'
import { useStudent } from '../data/roster'
import { useT } from '../i18n/use-i18n'
import { describeError } from '../lib/error-message'

const ANY_COURSE = '__any__'
const QUICK = [4, 8]

/** `POST /students/{id}/lessons/prepaid`: a pack of paid lessons (a freelance teacher's flow). */
export function AddPrepaidSheet({
  studentId,
  open,
  onOpenChange,
}: {
  studentId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = useT()
  const { student } = useStudent(studentId)
  const courses = useTeacherCourses()
  const add = useAddPrepaid()
  const [count, setCount] = useState(4)
  const [courseId, setCourseId] = useState(ANY_COURSE)
  const courseFieldId = useId()

  const submit = async () => {
    try {
      const result = await add.mutateAsync({
        studentId,
        body: { count, ...(courseId !== ANY_COURSE ? { courseId } : {}) },
      })
      const remaining = result.summary.prepaidRemaining
      toast.success(t('teacher.prepaid.added', { count: result.created }), {
        description:
          remaining === null ? undefined : t('teacher.prepaid.remaining', { count: remaining }),
      })
      onOpenChange(false)
    } catch (error) {
      toast.error(describeError(error, t))
    }
  }

  return (
    <TeachSheet
      open={open}
      onOpenChange={onOpenChange}
      title={t('teacher.prepaid.title')}
      subtitle={student ? t('teacher.prepaid.subtitle', { name: student.name }) : undefined}
      onSubmit={() => void submit()}
      footer={
        <Button
          type="submit"
          size="lg"
          className="w-full rounded-full sm:w-auto"
          disabled={add.isPending}
        >
          {add.isPending ? (
            <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden />
          ) : (
            <Ticket aria-hidden />
          )}
          {t('teacher.prepaid.submit', { count })}
        </Button>
      }
    >
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-muted-foreground">{t('teacher.prepaid.quick')}</p>
        <div className="flex gap-2">
          {QUICK.map((n) => (
            <button
              key={n}
              type="button"
              aria-pressed={count === n}
              onClick={() => setCount(n)}
              className={cn(
                'inline-flex h-9 items-center gap-1.5 rounded-full border px-4 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                count === n
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-card text-foreground hover:bg-muted',
              )}
            >
              <Ticket className="size-4" aria-hidden />+{n}
            </button>
          ))}
        </div>
      </div>
      <Stepper
        label={t('teacher.prepaid.count')}
        value={count}
        min={1}
        max={50}
        onChange={setCount}
      />
      {courses.courses.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={courseFieldId}>{t('teacher.prepaid.course')}</Label>
          <SelectField
            id={courseFieldId}
            value={courseId}
            onChange={setCourseId}
            placeholder={t('teacher.prepaid.anyCourse')}
            options={[
              { value: ANY_COURSE, label: t('teacher.prepaid.anyCourse') },
              ...courses.courses.map((c) => ({ value: c.id, label: c.title })),
            ]}
          />
        </div>
      ) : null}
    </TeachSheet>
  )
}
