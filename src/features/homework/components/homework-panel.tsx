import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { NotebookPen, Pencil, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { isApiError } from '@/api/errors'
import { homeworkApi, homeworkKeys } from '@/api/homework'
import type { Homework, HomeworkFilters } from '@/api/types'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { DetailField, DetailPanel } from '@/components/detail/detail-panel'
import { RowActions, type RowAction } from '@/components/row-actions'
import { Button } from '@/components/ui/button'
import { formatDate } from '@/lib/format'
import { HOMEWORK_FORBIDDEN, homeworkProgress, homeworkWriteError } from '../homework-state'
import { AssignHomeworkSheet, type AssignHomeworkContext } from './assign-homework-sheet'
import { HomeworkStateBadge } from './homework-badges'

/** Open homework first, then by due date; one page covers a student or a lesson. */
const PARAMS = { page: 0, size: 50, sort: ['status,asc', 'dueAt,asc'] }

interface Props {
  description: string
  filters: HomeworkFilters
  emptyText: string
  /**
   * For whoever may manage homework (`canManageHomework`): where "Assign homework" starts from,
   * and every row gets Edit and Delete. Without it the panel only lists.
   */
  manage?: AssignHomeworkContext
  /** Labels a row repeats: the teacher on a student's page, the lesson where it is not implied. */
  show?: { teacher?: boolean; lesson?: boolean }
}

/**
 * `GET /homework` for one lesson or one student, plus "Assign homework" (`POST /homework`) and,
 * per row, "Edit homework" (`PATCH /homework/{id}`) and "Delete homework" (`DELETE /homework/{id}`).
 * The server decides: a `404` refreshes the list, a `403` disables that row's actions.
 */
export function HomeworkPanel({ description, filters, emptyText, manage, show = {} }: Props) {
  const queryClient = useQueryClient()
  // One sheet: assign (no homework) or edit; the homework stays while the sheet closes.
  const [sheet, setSheet] = useState<{ open: boolean; homework?: Homework }>({ open: false })
  const [deleting, setDeleting] = useState<Homework | null>(null)
  const [forbidden, setForbidden] = useState<ReadonlySet<string>>(() => new Set())
  const forbid = (id: string) => setForbidden((ids) => new Set(ids).add(id))
  const query = useQuery({
    queryKey: homeworkKeys.list(filters, PARAMS),
    queryFn: ({ signal }) => homeworkApi.list(filters, PARAMS, signal),
  })
  const remove = useMutation({
    mutationFn: (homework: Homework) => homeworkApi.remove(homework.id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: homeworkKeys.lists() })
      toast.success('Homework deleted')
    },
    onError: (error, homework) => {
      if (isApiError(error) && error.isNotFound) {
        void queryClient.invalidateQueries({ queryKey: homeworkKeys.lists() })
      }
      if (isApiError(error) && error.isForbidden) forbid(homework.id)
    },
  })

  const actionsFor = (homework: Homework): RowAction[] => {
    const disabledReason = forbidden.has(homework.id) ? HOMEWORK_FORBIDDEN : null
    return [
      {
        label: 'Edit homework',
        icon: Pencil,
        onSelect: () => setSheet({ open: true, homework }),
        disabledReason,
      },
      {
        label: 'Delete homework',
        icon: Trash2,
        destructive: true,
        onSelect: () => setDeleting(homework),
        disabledReason,
      },
    ]
  }

  return (
    <>
      <DetailPanel
        title="Homework"
        description={description}
        actions={
          manage ? (
            <Button variant="outline" size="sm" onClick={() => setSheet({ open: true })}>
              <NotebookPen aria-hidden />
              Assign homework
            </Button>
          ) : null
        }
      >
        {query.isPending ? (
          <DetailField label="Loading">…</DetailField>
        ) : query.isError ? (
          <DetailField label="Error">Could not load homework.</DetailField>
        ) : query.data.content.length === 0 ? (
          <DetailField label="None">{emptyText}</DetailField>
        ) : (
          query.data.content.map((homework) => (
            <HomeworkRow
              key={homework.id}
              homework={homework}
              show={show}
              actions={manage ? actionsFor(homework) : undefined}
            />
          ))
        )}
      </DetailPanel>
      {manage ? (
        <AssignHomeworkSheet
          {...manage}
          homework={sheet.homework}
          open={sheet.open}
          onOpenChange={(open) => setSheet((current) => ({ ...current, open }))}
          onForbidden={forbid}
        />
      ) : null}
      {deleting ? (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && setDeleting(null)}
          title="Delete homework"
          destructive
          confirmLabel="Delete homework"
          description={<DeleteConsequence homework={deleting} />}
          onConfirm={async () => {
            try {
              await remove.mutateAsync(deleting)
            } catch (error) {
              throw new Error(homeworkWriteError(error), { cause: error })
            }
            setDeleting(null)
          }}
        />
      ) : null}
    </>
  )
}

function DeleteConsequence({ homework }: { homework: Homework }) {
  const { done, total } = homeworkProgress(homework)
  return (
    <>
      <p>
        Deletes <strong>{homework.title ?? 'this homework'}</strong> for{' '}
        <strong>{homework.studentName}</strong> with its checklist ({done} of {total} done). The
        student no longer sees it.
      </p>
      <p>This cannot be undone.</p>
    </>
  )
}

function HomeworkRow({
  homework,
  show,
  actions,
}: {
  homework: Homework
  show: { teacher?: boolean; lesson?: boolean }
  actions?: RowAction[]
}) {
  const { done, total } = homeworkProgress(homework)
  const title = homework.title ?? 'Homework'
  const meta = [
    homework.completedAt
      ? `Done ${formatDate(homework.completedAt)}`
      : homework.dueAt
        ? `Due ${formatDate(homework.dueAt)}`
        : 'No due date',
    show.teacher ? homework.teacherName : null,
    homework.courseTitle,
    show.lesson && homework.lessonId
      ? homework.lessonScheduledAt
        ? `Lesson of ${formatDate(homework.lessonScheduledAt)}`
        : 'From a lesson'
      : null,
    total > 0 ? `${done} of ${total} done` : null,
  ].filter(Boolean)

  return (
    <div className="flex flex-col gap-1.5 px-4 py-3 text-sm">
      <dt className="flex items-start gap-2">
        <span className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <span className="font-medium text-card-foreground">{title}</span>
          <HomeworkStateBadge homework={homework} />
        </span>
        {actions ? <RowActions label={`Actions for ${title}`} actions={actions} /> : null}
      </dt>
      <dd className="flex min-w-0 flex-col gap-1.5 break-words text-card-foreground">
        <p className="text-xs text-muted-foreground">{meta.join(' · ')}</p>
        {homework.notes ? <p className="whitespace-pre-wrap">{homework.notes}</p> : null}
        {homework.items.length > 0 ? (
          <ul className="flex flex-col gap-1">
            {homework.items.map((item) => (
              <li key={item.id} className="flex items-start gap-2">
                <span aria-hidden className={item.done ? 'text-success' : 'text-muted-foreground'}>
                  {item.done ? '☑' : '☐'}
                </span>
                <span className={item.done ? 'text-muted-foreground line-through' : ''}>
                  {item.text}
                  <span className="sr-only">{item.done ? ' (done)' : ' (open)'}</span>
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </dd>
    </div>
  )
}
