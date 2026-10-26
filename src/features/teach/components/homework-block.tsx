import { AlertTriangle, CheckCircle2, Circle, Clock, Pencil, Trash2 } from 'lucide-react'
import { Fragment } from 'react'
import { Link } from 'react-router'
import type { Homework } from '@/api/types'
import { Button } from '@/components/ui/button'
import { homeworkProgress, homeworkState } from '@/features/homework/homework-state'
import { cn } from '@/lib/utils'
import { useT } from '../i18n/use-i18n'
import { dayLabelKind } from '../lib/dates'
import { useFormatters } from '../lib/use-formatters'
import { TeachBadge } from './teach-badge'

/** Done (green), overdue (orange) or the due day; nothing for open homework without a date. */
export function HomeworkStateBadge({
  homework,
}: {
  homework: Pick<Homework, 'completedAt' | 'dueAt'>
}) {
  const t = useT()
  const fmt = useFormatters()
  const state = homeworkState(homework)
  if (state === 'done' && homework.completedAt) {
    return (
      <TeachBadge tone="held" icon={CheckCircle2}>
        {t('homework.doneOn', { date: fmt.shortDate(new Date(homework.completedAt)) })}
      </TeachBadge>
    )
  }
  if (!homework.dueAt) return null
  const due = new Date(homework.dueAt)
  const kind = dayLabelKind(due)
  const day =
    kind === 'today'
      ? t('common.today')
      : kind === 'tomorrow'
        ? t('common.tomorrow')
        : fmt.shortDate(due)
  if (state === 'overdue') {
    return (
      <TeachBadge tone="warning" icon={AlertTriangle}>
        {t('homework.overdue', { date: day })}
      </TeachBadge>
    )
  }
  return (
    <TeachBadge tone="neutral" icon={Clock}>
      {t('homework.due', { date: day })}
    </TeachBadge>
  )
}

/** One homework: title, its state, what it belongs to, notes and the checklist (the ticks are the student's). */
export function HomeworkBlock({
  homework,
  onEdit,
  onDelete,
  showStudent = false,
  showLesson = false,
}: {
  homework: Homework
  onEdit?: () => void
  onDelete?: () => void
  showStudent?: boolean
  showLesson?: boolean
}) {
  const t = useT()
  const fmt = useFormatters()
  const { done, total } = homeworkProgress(homework)
  const title = homework.title ?? t('homework.title')
  const meta: { key: string; node: React.ReactNode }[] = []
  if (showStudent) meta.push({ key: 'student', node: homework.studentName })
  if (homework.courseTitle) meta.push({ key: 'course', node: homework.courseTitle })
  if (showLesson && homework.lessonId && homework.lessonScheduledAt) {
    meta.push({
      key: 'lesson',
      node: (
        <Link
          to={`/teach/lessons/${homework.lessonId}`}
          className="font-medium text-accent-foreground underline-offset-4 hover:underline"
        >
          {t('homework.fromLesson', { date: fmt.shortDate(new Date(homework.lessonScheduledAt)) })}
        </Link>
      ),
    })
  }
  if (total > 0) meta.push({ key: 'progress', node: t('homework.progress', { done, total }) })

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
      <div className="flex items-start gap-2">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <h3 className="font-semibold text-foreground">{title}</h3>
          <HomeworkStateBadge homework={homework} />
        </div>
        {onEdit ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={t('teacher.homework.edit', { title })}
            onClick={onEdit}
          >
            <Pencil aria-hidden />
          </Button>
        ) : null}
        {onDelete ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="text-danger hover:text-danger"
            aria-label={t('teacher.homework.delete', { title })}
            onClick={onDelete}
          >
            <Trash2 aria-hidden />
          </Button>
        ) : null}
      </div>
      {meta.length > 0 ? (
        <p className="text-xs text-muted-foreground">
          {meta.map((part, index) => (
            <Fragment key={part.key}>
              {index > 0 ? ' · ' : null}
              {part.node}
            </Fragment>
          ))}
        </p>
      ) : null}
      {homework.notes?.trim() ? (
        <p className="whitespace-pre-wrap text-sm text-foreground">{homework.notes.trim()}</p>
      ) : null}
      {homework.items.length > 0 ? (
        <ul className="flex flex-col gap-1.5">
          {homework.items.map((item) => (
            <li
              key={item.id}
              className={cn(
                'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm',
                item.done ? 'bg-held-soft' : 'bg-muted/60',
              )}
            >
              {item.done ? (
                <CheckCircle2 className="size-4 shrink-0 text-held" aria-hidden />
              ) : (
                <Circle className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              )}
              <span
                className={cn('min-w-0 flex-1', item.done && 'text-muted-foreground line-through')}
              >
                {item.text}
              </span>
              <span className="sr-only">
                {item.done ? t('homework.itemDone') : t('homework.itemOpen')}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
