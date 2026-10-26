import { CheckCircle2, Loader2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { TeachAvatar } from '../components/avatar'
import { ListRow, RowList } from '../components/list-row'
import { TeachCard } from '../components/section'
import { EmptyState, ErrorState, SkeletonList } from '../components/states'
import { TeachSheet } from '../components/teach-sheet'
import { useCourseEnrollments } from '../data/courses'
import { useEnrollStudent } from '../data/mutations'
import { useFullRoster } from '../data/roster'
import { useT } from '../i18n/use-i18n'
import { describeError } from '../lib/error-message'

/** Pick students from the roster who are not enrolled yet; one click enrolls. */
export function EnrollSheet({
  courseId,
  open,
  onOpenChange,
}: {
  courseId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = useT()
  const roster = useFullRoster()
  const enrollments = useCourseEnrollments(courseId)
  const enroll = useEnrollStudent()
  const [busyId, setBusyId] = useState<string | null>(null)

  const candidates = useMemo(() => {
    const enrolled = new Set(enrollments.enrollments.map((e) => e.studentId))
    return roster.students.filter((s) => !enrolled.has(s.id))
  }, [roster.students, enrollments.enrollments])

  const loading = roster.isPending || enrollments.isPending
  const error = roster.error ?? enrollments.error

  return (
    <TeachSheet
      open={open}
      onOpenChange={onOpenChange}
      title={t('teacher.enroll.title')}
      footer={
        <Button
          type="button"
          variant="secondary"
          size="lg"
          className="rounded-full"
          onClick={() => onOpenChange(false)}
        >
          {t('common.done')}
        </Button>
      }
    >
      {loading ? (
        <SkeletonList rows={4} />
      ) : error && candidates.length === 0 ? (
        <ErrorState
          compact
          error={error}
          onRetry={() => {
            void roster.refetch()
            void enrollments.refetch()
          }}
        />
      ) : candidates.length === 0 ? (
        <EmptyState compact icon={CheckCircle2} tone="held" title={t('teacher.enroll.empty')} />
      ) : (
        <TeachCard padded={false}>
          <RowList>
            {candidates.map((student) => (
              <ListRow
                key={student.id}
                title={student.name}
                subtitle={student.email}
                leading={<TeachAvatar name={student.name} />}
                trailing={
                  <Button
                    type="button"
                    size="sm"
                    className="rounded-full"
                    disabled={busyId === student.id}
                    onClick={() => {
                      setBusyId(student.id)
                      enroll.mutate(
                        { courseId, studentId: student.id },
                        {
                          onSuccess: () => toast.success(t('teacher.enroll.enrolled')),
                          onError: (e) => toast.error(describeError(e, t)),
                          onSettled: () => setBusyId(null),
                        },
                      )
                    }}
                  >
                    {busyId === student.id ? (
                      <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden />
                    ) : null}
                    {t('teacher.enroll.submit')}
                  </Button>
                }
              />
            ))}
          </RowList>
        </TeachCard>
      )}
    </TeachSheet>
  )
}
