import {
  Archive,
  ArrowLeft,
  ClipboardList,
  Library,
  Paperclip,
  Pencil,
  UserPlus,
  Users,
  X,
} from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'
import type { Enrollment, Material } from '@/api/types'
import type { RouteHandle } from '@/app/route-handle'
import { useMe } from '@/auth/session'
import { Button } from '@/components/ui/button'
import { TeachAvatar } from '../components/avatar'
import { TeachConfirmDialog } from '../components/confirm-dialog'
import { HomeworkBlock } from '../components/homework-block'
import { ListRow, RowList } from '../components/list-row'
import { MaterialRow } from '../components/material-row'
import { PageTitle, Section, TeachCard } from '../components/section'
import { EmptyState, ErrorState, SkeletonCard } from '../components/states'
import {
  useCourse,
  useCourseEnrollments,
  useCourseHomework,
  useCourseMaterials,
} from '../data/courses'
import { useArchiveCourse, useRemoveMaterial, useUnenrollStudent } from '../data/mutations'
import { useT } from '../i18n/use-i18n'
import { teachCapabilities } from '../lib/capabilities'
import { useFormatters } from '../lib/use-formatters'
import { useTeachTitle } from '../lib/use-teach-title'
import { useOpenMaterial } from '../materials/use-open-material'
import { useTeachSheets } from '../sheets/use-teach-sheets'

export const handle: RouteHandle = { title: 'Course' }

/**
 * One course: its details, the students enrolled (enroll, unenroll), its materials (add, open,
 * remove) and its homework. Edit and Archive are a freelance teacher's only: an org teacher's
 * courses are their school's admin's (D-053), and they come here from a student's page.
 */
export function Component() {
  const { courseId = '' } = useParams<{ courseId: string }>()
  const t = useT()
  const { canManageCourses } = teachCapabilities(useMe())
  const fmt = useFormatters()
  const navigate = useNavigate()
  const sheets = useTeachSheets()
  const course = useCourse(courseId)
  const enrollments = useCourseEnrollments(courseId)
  const materials = useCourseMaterials(courseId)
  const homework = useCourseHomework(courseId)
  const archive = useArchiveCourse()
  const unenroll = useUnenrollStudent()
  const removeMaterial = useRemoveMaterial()
  const { open, openingId } = useOpenMaterial()
  const [archiving, setArchiving] = useState(false)
  const [unenrolling, setUnenrolling] = useState<Enrollment | null>(null)
  const [removing, setRemoving] = useState<Material | null>(null)
  useTeachTitle(course.data?.title)

  if (course.isPending) return <SkeletonCard lines={3} />
  if (course.isError)
    return <ErrorState error={course.error} onRetry={() => void course.refetch()} />
  const data = course.data

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <Link
        to={canManageCourses ? '/teach/courses' : '/teach/students'}
        className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" aria-hidden />
        {canManageCourses ? t('teacher.courses.title') : t('teacher.students.title')}
      </Link>
      <PageTitle
        title={data.title}
        subtitle={data.description?.trim() || undefined}
        actions={
          canManageCourses ? (
            <>
              <Button
                type="button"
                variant="outline"
                className="rounded-full"
                onClick={() => sheets.open({ kind: 'course', courseId })}
              >
                <Pencil aria-hidden />
                {t('teacher.courseDetail.edit')}
              </Button>
              <Button
                type="button"
                variant="destructive"
                className="rounded-full"
                onClick={() => setArchiving(true)}
              >
                <Archive aria-hidden />
                {t('teacher.courseDetail.archive')}
              </Button>
            </>
          ) : undefined
        }
      />
      {data.defaultDurationMinutes ? (
        <TeachCard className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          <span className="text-muted-foreground">
            {t('teacher.courseDetail.defaultLength', {
              length: fmt.duration(data.defaultDurationMinutes),
            })}
          </span>
        </TeachCard>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-6">
          <Section
            title={t('teacher.courseDetail.students')}
            action={
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="rounded-full"
                onClick={() => sheets.open({ kind: 'enroll', courseId })}
              >
                <UserPlus aria-hidden />
                {t('teacher.courseDetail.enroll')}
              </Button>
            }
          >
            {enrollments.isPending ? (
              <SkeletonCard lines={2} />
            ) : enrollments.error ? (
              <ErrorState
                compact
                error={enrollments.error}
                onRetry={() => void enrollments.refetch()}
              />
            ) : enrollments.enrollments.length === 0 ? (
              <EmptyState compact icon={Users} title={t('teacher.courseDetail.noStudents')} />
            ) : (
              <TeachCard padded={false}>
                <RowList>
                  {enrollments.enrollments.map((enrollment) => (
                    <ListRow
                      key={enrollment.id}
                      to={`/teach/students/${enrollment.studentId}`}
                      title={enrollment.studentName}
                      subtitle={enrollment.studentEmail}
                      leading={<TeachAvatar name={enrollment.studentName} />}
                      trailing={
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          className="text-danger hover:text-danger"
                          aria-label={`${t('teacher.courseDetail.unenroll')}: ${enrollment.studentName}`}
                          onClick={() => setUnenrolling(enrollment)}
                        >
                          <X aria-hidden />
                        </Button>
                      }
                    />
                  ))}
                </RowList>
              </TeachCard>
            )}
          </Section>

          <Section title={t('teacher.courseDetail.homework')}>
            {homework.isPending ? (
              <SkeletonCard lines={2} />
            ) : homework.error ? (
              <ErrorState compact error={homework.error} onRetry={() => void homework.refetch()} />
            ) : homework.homework.length === 0 ? (
              <EmptyState
                compact
                icon={ClipboardList}
                title={t('teacher.courseDetail.noHomework')}
              />
            ) : (
              <div className="flex flex-col gap-2">
                {homework.homework.map((h) => (
                  <HomeworkBlock
                    key={h.id}
                    homework={h}
                    showStudent
                    showLesson
                    onEdit={() => sheets.open({ kind: 'homework-edit', homeworkId: h.id })}
                  />
                ))}
              </div>
            )}
          </Section>
        </div>

        <Section
          title={t('teacher.courseDetail.materials')}
          action={
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="rounded-full"
              onClick={() => sheets.open({ kind: 'material', courseId })}
            >
              <Paperclip aria-hidden />
              {t('teacher.courseDetail.addMaterial')}
            </Button>
          }
        >
          {materials.isPending ? (
            <SkeletonCard lines={2} />
          ) : materials.error ? (
            <ErrorState compact error={materials.error} onRetry={() => void materials.refetch()} />
          ) : materials.materials.length === 0 ? (
            <EmptyState compact icon={Library} title={t('teacher.courseDetail.noMaterials')} />
          ) : (
            <TeachCard padded={false}>
              <RowList>
                {materials.materials.map((material) => (
                  <MaterialRow
                    key={material.id}
                    material={material}
                    opening={openingId === material.id}
                    onOpen={() => void open(material)}
                    onRemove={() => setRemoving(material)}
                  />
                ))}
              </RowList>
            </TeachCard>
          )}
        </Section>
      </div>

      <TeachConfirmDialog
        open={archiving}
        onOpenChange={setArchiving}
        title={t('teacher.courseDetail.archiveConfirmTitle')}
        body={<p>{t('teacher.courseDetail.archiveConfirmBody')}</p>}
        confirmLabel={t('teacher.courseDetail.archive')}
        destructive
        onConfirm={async () => {
          await archive.mutateAsync(courseId)
          toast.success(t('teacher.courseDetail.archived'))
          navigate('/teach/courses')
        }}
      />
      <TeachConfirmDialog
        open={unenrolling !== null}
        onOpenChange={(next) => {
          if (!next) setUnenrolling(null)
        }}
        title={t('teacher.courseDetail.unenrollConfirmTitle', {
          name: unenrolling?.studentName ?? '',
        })}
        body={<p>{t('teacher.courseDetail.unenrollConfirmBody')}</p>}
        confirmLabel={t('teacher.courseDetail.unenroll')}
        destructive
        onConfirm={async () => {
          if (!unenrolling) return
          await unenroll.mutateAsync({ courseId, studentId: unenrolling.studentId })
          toast.success(t('teacher.courseDetail.unenrolled'))
        }}
      />
      <TeachConfirmDialog
        open={removing !== null}
        onOpenChange={(next) => {
          if (!next) setRemoving(null)
        }}
        title={t('teacher.material.removeConfirmTitle')}
        body={<p>{t('teacher.material.removeConfirmBody')}</p>}
        confirmLabel={t('common.remove')}
        destructive
        onConfirm={async () => {
          if (!removing) return
          await removeMaterial.mutateAsync(removing)
          toast.success(t('teacher.material.removed'))
        }}
      />
    </div>
  )
}
