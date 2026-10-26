/**
 * The sheets of the workspace (the mobile app's modal routes), opened from anywhere with
 * `useTeachSheets().open(...)` and rendered once by the `TeachSheetHost` under the shell (D-051).
 */
export type TeachSheetRequest =
  | { kind: 'book'; studentId?: string; courseId?: string; startAt?: string; count?: number }
  | { kind: 'schedule'; lessonId: string }
  | { kind: 'finish'; lessonId: string }
  | { kind: 'journal'; lessonId: string }
  | { kind: 'material'; courseId?: string; lessonId?: string }
  | { kind: 'homework'; studentId: string; lessonId?: string }
  | { kind: 'homework-edit'; homeworkId: string }
  | { kind: 'student'; studentId?: string }
  | { kind: 'prepaid'; studentId: string }
  | { kind: 'course'; courseId?: string }
  | { kind: 'enroll'; courseId: string }
  | { kind: 'password' }
  | { kind: 'video'; materialId: string; title: string }
