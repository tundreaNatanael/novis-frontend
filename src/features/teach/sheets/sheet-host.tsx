import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { AddMaterialSheet } from './add-material-sheet'
import { AddPrepaidSheet } from './add-prepaid-sheet'
import { AssignHomeworkSheet, EditHomeworkSheet } from './assign-homework-sheet'
import { BookLessonSheet } from './book-lesson-sheet'
import { ChangePasswordSheet } from './change-password-sheet'
import { CourseFormSheet } from './course-form-sheet'
import { DeleteAccountSheet } from './delete-account-sheet'
import { EnrollSheet } from './enroll-sheet'
import { FinishLessonSheet } from './finish-lesson-sheet'
import { JournalSheet } from './journal-sheet'
import { ScheduleLessonSheet } from './schedule-lesson-sheet'
import type { TeachSheetRequest } from './sheet-types'
import { StudentFormSheet } from './student-form-sheet'
import { TeachSheetsContext, type TeachSheets } from './use-teach-sheets'
import { VideoPlayerDialog } from './video-player-dialog'
import { WhatsAppNumberSheet } from './whatsapp-number-sheet'

/** How long a closing sheet stays mounted for its exit animation. */
const EXIT_MS = 250

/**
 * Keeps the one open sheet of the workspace and renders it. A sheet that closes stays mounted
 * for its animation, then unmounts, so the next one starts fresh.
 */
export function TeachSheetsProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<TeachSheetRequest | null>(null)
  const [open, setOpen] = useState(false)
  const timer = useRef<number | null>(null)

  const open_ = useCallback((request: TeachSheetRequest) => {
    if (timer.current !== null) window.clearTimeout(timer.current)
    setCurrent(request)
    setOpen(true)
  }, [])

  const close = useCallback(() => {
    setOpen(false)
    if (timer.current !== null) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      setCurrent(null)
      timer.current = null
    }, EXIT_MS)
  }, [])

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current)
    },
    [],
  )

  const value = useMemo<TeachSheets>(() => ({ open: open_, close }), [open_, close])

  return (
    <TeachSheetsContext.Provider value={value}>
      {children}
      {current ? <SheetFor request={current} open={open} onClose={close} /> : null}
    </TeachSheetsContext.Provider>
  )
}

function SheetFor({
  request,
  open,
  onClose,
}: {
  request: TeachSheetRequest
  open: boolean
  onClose: () => void
}) {
  const onOpenChange = (next: boolean) => {
    if (!next) onClose()
  }
  switch (request.kind) {
    case 'book':
      return <BookLessonSheet {...request} open={open} onOpenChange={onOpenChange} />
    case 'schedule':
      return (
        <ScheduleLessonSheet lessonId={request.lessonId} open={open} onOpenChange={onOpenChange} />
      )
    case 'finish':
      return (
        <FinishLessonSheet lessonId={request.lessonId} open={open} onOpenChange={onOpenChange} />
      )
    case 'journal':
      return <JournalSheet lessonId={request.lessonId} open={open} onOpenChange={onOpenChange} />
    case 'material':
      return (
        <AddMaterialSheet
          courseId={request.courseId}
          lessonId={request.lessonId}
          open={open}
          onOpenChange={onOpenChange}
        />
      )
    case 'homework':
      return (
        <AssignHomeworkSheet
          studentId={request.studentId}
          lessonId={request.lessonId}
          open={open}
          onOpenChange={onOpenChange}
        />
      )
    case 'homework-edit':
      return (
        <EditHomeworkSheet
          homeworkId={request.homeworkId}
          open={open}
          onOpenChange={onOpenChange}
        />
      )
    case 'student':
      return (
        <StudentFormSheet studentId={request.studentId} open={open} onOpenChange={onOpenChange} />
      )
    case 'prepaid':
      return (
        <AddPrepaidSheet studentId={request.studentId} open={open} onOpenChange={onOpenChange} />
      )
    case 'course':
      return <CourseFormSheet courseId={request.courseId} open={open} onOpenChange={onOpenChange} />
    case 'enroll':
      return <EnrollSheet courseId={request.courseId} open={open} onOpenChange={onOpenChange} />
    case 'password':
      return <ChangePasswordSheet open={open} onOpenChange={onOpenChange} />
    case 'deleteAccount':
      return <DeleteAccountSheet open={open} onOpenChange={onOpenChange} />
    case 'whatsapp':
      return (
        <WhatsAppNumberSheet
          afterSave={request.afterSave}
          open={open}
          onOpenChange={onOpenChange}
        />
      )
    case 'video':
      return (
        <VideoPlayerDialog
          materialId={request.materialId}
          title={request.title}
          open={open}
          onOpenChange={onOpenChange}
        />
      )
  }
}
