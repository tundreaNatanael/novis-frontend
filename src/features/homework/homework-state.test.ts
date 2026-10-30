import { describe, expect, it } from 'vitest'
import { ApiError } from '@/api/errors'
import { endOfLocalDay, toDateInput } from '@/lib/format'
import { homework, material } from '@/test/fixtures'
import {
  HOMEWORK_FORBIDDEN,
  checklistWithTicks,
  homeworkChanges,
  homeworkProgress,
  homeworkState,
  homeworkWriteError,
  lineOf,
  materialOfLine,
  type HomeworkEdit,
} from './homework-state'

describe('homework state', () => {
  const now = new Date('2026-10-24T12:00:00Z')

  it('is done once completed, whatever the due date', () => {
    expect(
      homeworkState(
        homework({ completedAt: '2026-10-23T10:00:00Z', dueAt: '2026-10-01T21:59:59Z' }),
        now,
      ),
    ).toBe('done')
  })

  it('is overdue when open past its due date, open otherwise', () => {
    expect(homeworkState(homework({ dueAt: '2026-10-23T21:59:59Z' }), now)).toBe('overdue')
    expect(homeworkState(homework({ dueAt: '2026-10-24T21:59:59Z' }), now)).toBe('open')
    expect(homeworkState(homework({ dueAt: null }), now)).toBe('open')
  })

  it('counts ticked items', () => {
    expect(homeworkProgress(homework())).toEqual({ done: 1, total: 2 })
    expect(homeworkProgress(homework({ items: [] }))).toEqual({ done: 0, total: 0 })
  })
})

describe('homework edits', () => {
  /** The sheet as it opens: "C major scale" ticked, "Etude no. 3" open, due 30 Oct. */
  const loaded = homework()
  const asOpened = (from = loaded): HomeworkEdit => ({
    title: from.title ?? '',
    notes: from.notes ?? '',
    dueDate: toDateInput(from.dueAt),
    items: from.items.map(lineOf),
  })

  it('sends nothing when nothing changed', () => {
    expect(homeworkChanges(loaded, asOpened())).toEqual({})
    expect(homeworkChanges(loaded, { ...asOpened(), title: ' Weekly practice ' })).toEqual({})
  })

  it('sends only what changed; a cleared title or notes go out blank', () => {
    const withNotes = homework({ notes: 'Slowly' })
    expect(
      homeworkChanges(withNotes, {
        ...asOpened(withNotes),
        title: ' ',
        notes: '',
        dueDate: '2026-11-02',
      }),
    ).toEqual({ title: '', notes: '', dueAt: endOfLocalDay('2026-11-02') })
  })

  it('removes an emptied due date with null and adds a missing one', () => {
    expect(homeworkChanges(loaded, { ...asOpened(), dueDate: '' })).toEqual({ dueAt: null })
    const undated = homework({ dueAt: null })
    expect(homeworkChanges(undated, asOpened(undated))).toEqual({})
    expect(homeworkChanges(undated, { ...asOpened(undated), dueDate: '2026-11-02' })).toEqual({
      dueAt: endOfLocalDay('2026-11-02'),
    })
  })

  it('sends the whole checklist once a line changed: kept lines keep their tick, new ones start open', () => {
    const [scale, etude] = asOpened().items
    expect(
      homeworkChanges(loaded, {
        ...asOpened(),
        items: [{ ...scale!, text: 'C major scale, hands together' }, { text: '  ' }, etude!],
      }),
    ).toEqual({
      items: [
        { text: 'C major scale, hands together', done: true, materialId: null },
        { text: 'Etude no. 3', done: false, materialId: null },
      ],
    })
    expect(
      homeworkChanges(loaded, { ...asOpened(), items: [etude!, { text: 'Sight-read' }] }),
    ).toEqual({
      items: [
        { text: 'Etude no. 3', done: false, materialId: null },
        { text: 'Sight-read', done: false, materialId: null },
      ],
    })
  })

  it('takes each kept line’s tick from the latest copy, since the student may have ticked meanwhile', () => {
    const latest = homework({
      items: [
        { id: 'hi-1', text: 'C major scale', done: false, position: 0, material: null },
        { id: 'hi-2', text: 'Etude no. 3', done: true, position: 1, material: null },
      ],
    })
    expect(
      checklistWithTicks(
        [
          { text: 'C major scale', itemId: 'hi-1', done: true },
          { text: 'Etude no. 3, slowly', itemId: 'hi-2', done: false },
          { text: 'Rewritten elsewhere', itemId: 'hi-gone', done: true },
          { text: 'Sight-read' },
        ],
        latest,
      ),
    ).toEqual([
      { text: 'C major scale', done: false, materialId: null },
      { text: 'Etude no. 3, slowly', done: true, materialId: null },
      { text: 'Rewritten elsewhere', done: true, materialId: null },
      { text: 'Sight-read', done: false, materialId: null },
    ])
  })

  it('keeps each line’s material and sends it with every line, so a kept file never drops (D-059)', () => {
    const sheet = material({
      id: 'm-pdf',
      type: 'PDF',
      externalUrl: null,
      fileName: 'sheet.pdf',
      homeworkId: 'hw-1',
      homeworkTitle: 'Weekly practice',
    })
    const withMaterial = homework({
      items: [
        { id: 'hi-1', text: 'Read the sheet', done: false, position: 0, material: sheet },
        { id: 'hi-2', text: 'Etude no. 3', done: false, position: 1, material: null },
      ],
    })
    const lines = withMaterial.items.map(lineOf)
    expect(lines[0]).toEqual({
      text: 'Read the sheet',
      itemId: 'hi-1',
      done: false,
      materialId: 'm-pdf',
    })
    expect(materialOfLine(lines[0]!, withMaterial)).toBe(sheet)
    expect(materialOfLine({ materialId: null }, withMaterial)).toBeNull()
    // Unchanged lines: nothing goes out. A line renamed: every line, each with its material.
    expect(homeworkChanges(withMaterial, { ...asOpened(withMaterial), items: lines })).toEqual({})
    expect(
      homeworkChanges(withMaterial, {
        ...asOpened(withMaterial),
        items: [{ ...lines[0]!, text: 'Read the whole sheet' }, lines[1]!, { text: 'New line' }],
      }).items,
    ).toEqual([
      { text: 'Read the whole sheet', done: false, materialId: 'm-pdf' },
      { text: 'Etude no. 3', done: false, materialId: null },
      { text: 'New line', done: false, materialId: null },
    ])
    // A material that went away since the sheet opened counts as a change, and goes out as none.
    expect(
      homeworkChanges(withMaterial, {
        ...asOpened(withMaterial),
        items: [{ ...lines[0]!, materialId: null }, lines[1]!],
      }).items,
    ).toEqual([
      { text: 'Read the sheet', done: false, materialId: null },
      { text: 'Etude no. 3', done: false, materialId: null },
    ])
  })

  it('words a failed edit or delete by status', () => {
    expect(homeworkWriteError(new ApiError(404, 'NOT_FOUND', 'Homework not found'))).toMatch(
      /no longer exists or is out of your reach/,
    )
    expect(homeworkWriteError(new ApiError(403, 'FORBIDDEN', 'Student tokens are read-only'))).toBe(
      HOMEWORK_FORBIDDEN,
    )
    expect(homeworkWriteError(new ApiError(409, 'CONFLICT', 'Archived organization'))).toBe(
      'Archived organization',
    )
  })
})
