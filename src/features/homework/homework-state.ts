import { errorMessage, isApiError } from '@/api/errors'
import type { Homework, Material, UpdateHomeworkRequest } from '@/api/types'
import { endOfLocalDay, toDateInput } from '@/lib/format'

/** What a homework shows: done (every item ticked), overdue (open past its due date) or open. */
export type HomeworkState = 'done' | 'overdue' | 'open'

export function homeworkState(
  homework: Pick<Homework, 'completedAt' | 'dueAt'>,
  now: Date = new Date(),
): HomeworkState {
  if (homework.completedAt) return 'done'
  if (homework.dueAt && new Date(homework.dueAt).getTime() < now.getTime()) return 'overdue'
  return 'open'
}

export function homeworkProgress(homework: Pick<Homework, 'items'>): {
  done: number
  total: number
} {
  return {
    done: homework.items.filter((item) => item.done).length,
    total: homework.items.length,
  }
}

/**
 * A checklist line in the sheet; an existing item keeps its id, the tick and the material it was
 * loaded with (`materialId`; the web shows a line's material and never adds one, D-059).
 */
export interface ChecklistLine {
  text: string
  itemId?: string
  done?: boolean
  materialId?: string | null
}

/** The line a loaded item becomes. */
export function lineOf(item: Homework['items'][number]): ChecklistLine {
  return {
    text: item.text,
    itemId: item.id,
    done: item.done,
    materialId: item.material?.id ?? null,
  }
}

/** The material a line of the sheet carries, found in the homework it was loaded from. */
export function materialOfLine(
  line: Pick<ChecklistLine, 'materialId'>,
  homework: Pick<Homework, 'items'>,
): Material | null {
  if (!line.materialId) return null
  return homework.items.find((item) => item.material?.id === line.materialId)?.material ?? null
}

/** What the edit sheet can change: the teacher, course and lesson stay as assigned. */
export interface HomeworkEdit {
  title: string
  notes: string
  /** `date` input value; empty = none. */
  dueDate: string
  items: ChecklistLine[]
}

/** The lines that go out: trimmed, blank ones dropped. */
export function checklistLines(items: ChecklistLine[]): ChecklistLine[] {
  return items
    .map((item) => ({ ...item, text: item.text.trim() }))
    .filter((item) => item.text.length > 0)
}

/**
 * The checklist for `PATCH /homework/{id}`, which replaces every item. The lines are the
 * teacher's, the ticks the student's: a kept line takes its tick from `latest` (the student may
 * have ticked it since the sheet opened), a line whose item is gone keeps the tick it was loaded
 * with, and a new line starts open. Every line sends its `materialId` (the one it was loaded
 * with, or `null`), so the server never has to guess by text.
 */
export function checklistWithTicks(
  lines: ChecklistLine[],
  latest: Pick<Homework, 'items'>,
): { text: string; done: boolean; materialId: string | null }[] {
  const ticks = new Map(latest.items.map((item) => [item.id, item.done]))
  return lines.map((line) => ({
    text: line.text,
    done: line.itemId ? (ticks.get(line.itemId) ?? line.done ?? false) : false,
    materialId: line.materialId ?? null,
  }))
}

/**
 * The `PATCH /homework/{id}` body for what the sheet changed, empty when nothing did. A cleared
 * title or notes go out blank (the API clears them); an emptied due date goes out as `null`
 * (the API removes it); the checklist goes out whole, and only when its lines changed.
 */
export function homeworkChanges(homework: Homework, edit: HomeworkEdit): UpdateHomeworkRequest {
  const body: UpdateHomeworkRequest = {}
  const title = edit.title.trim()
  if (title !== (homework.title ?? '').trim()) body.title = title
  const notes = edit.notes.trim()
  if (notes !== (homework.notes ?? '').trim()) body.notes = notes
  // A `date` input holds a valid day or nothing: another day moves the due date, nothing removes it.
  if (edit.dueDate !== toDateInput(homework.dueAt)) {
    body.dueAt = edit.dueDate ? endOfLocalDay(edit.dueDate) : null
  }
  const lines = checklistLines(edit.items)
  const sameLines =
    lines.length === homework.items.length &&
    lines.every(
      (line, index) =>
        line.itemId === homework.items[index]?.id &&
        line.text === homework.items[index]?.text.trim() &&
        (line.materialId ?? null) === (homework.items[index]?.material?.id ?? null),
    )
  if (!sameLines) body.items = checklistWithTicks(lines, homework)
  return body
}

/** Why a homework row's Edit and Delete are disabled after the server answered `403`. */
export const HOMEWORK_FORBIDDEN = 'Your role does not allow changing this homework.'

/** The sentence for a failed edit or delete: gone or out of reach, not allowed, or the server's. */
export function homeworkWriteError(error: unknown): string {
  if (isApiError(error) && error.isNotFound) {
    return 'This homework no longer exists or is out of your reach. The list has been refreshed.'
  }
  if (isApiError(error) && error.isForbidden) return HOMEWORK_FORBIDDEN
  return errorMessage(error)
}
