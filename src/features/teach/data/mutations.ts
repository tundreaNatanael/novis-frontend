import { useMutation, useQueryClient } from '@tanstack/react-query'
import { courseKeys, coursesApi } from '@/api/courses'
import { enrollmentKeys, enrollmentsApi } from '@/api/enrollments'
import { isApiError } from '@/api/errors'
import { homeworkApi, homeworkKeys } from '@/api/homework'
import { lessonKeys, lessonsApi } from '@/api/lessons'
import { materialsApi } from '@/api/materials'
import { studentKeys, studentsApi } from '@/api/students'
import { teacherKeys } from '@/api/teacher'
import type {
  AddPrepaidLessonsRequest,
  CloseLessonRequest,
  CreateCourseRequest,
  CreateHomeworkRequest,
  CreateLessonRequest,
  CreateLessonSeriesRequest,
  CreateMaterialRequest,
  CreateStudentRequest,
  LessonDetail,
  Material,
  ScheduleLessonRequest,
  StudentPayment,
  UpdateCourseRequest,
  UpdateHomeworkRequest,
} from '@/api/types'
import { usersApi } from '@/api/users'
import { useMe } from '@/auth/session'
import { checklistWithTicks, type ChecklistLine } from '@/features/homework/homework-state'

/**
 * Anything that changes a lesson touches lists, counts, summaries, the calendar, the roster and
 * the payout counts (a lesson marked held is owed until the school pays it out): everything under
 * `lessonKeys.all`, `studentKeys.all` and `teacherKeys.all`.
 */
export function useInvalidateLessons() {
  const queryClient = useQueryClient()
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: lessonKeys.all }),
      queryClient.invalidateQueries({ queryKey: studentKeys.all }),
      queryClient.invalidateQueries({ queryKey: teacherKeys.all }),
    ])
}

// --- lessons -----------------------------------------------------------------------------------

export function useBookLesson() {
  const invalidate = useInvalidateLessons()
  return useMutation({
    mutationFn: (body: CreateLessonRequest) => lessonsApi.create(body),
    onSuccess: () => invalidate(),
  })
}

/** `POST /lessons/series`: books every date or none (`409 SCHEDULE_CONFLICT` without `allowOverlap`). */
export function useBookSeries() {
  const invalidate = useInvalidateLessons()
  return useMutation({
    mutationFn: (body: CreateLessonSeriesRequest) => lessonsApi.bookSeries(body),
    onSuccess: () => invalidate(),
  })
}

export function useCloseLesson() {
  const invalidate = useInvalidateLessons()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: CloseLessonRequest }) =>
      lessonsApi.close(id, body),
    onSuccess: (detail) => {
      queryClient.setQueryData(lessonKeys.detail(detail.lesson.id), detail)
      return invalidate()
    },
  })
}

export function useScheduleLesson() {
  const invalidate = useInvalidateLessons()
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: ScheduleLessonRequest }) =>
      lessonsApi.schedule(id, body),
    onSuccess: () => invalidate(),
  })
}

export function useUpdateJournal() {
  const invalidate = useInvalidateLessons()
  return useMutation({
    mutationFn: ({ id, journal }: { id: string; journal: string }) =>
      lessonsApi.updateJournal(id, { journal }),
    onSuccess: () => invalidate(),
  })
}

/**
 * Optimistic paid / unpaid toggle on the detail cache, rolled back on failure. Payment managers
 * only (a freelance teacher): the caller is who the server records as `recordedById`.
 */
export function useUpdatePayment() {
  const queryClient = useQueryClient()
  const invalidate = useInvalidateLessons()
  const me = useMe()
  return useMutation({
    mutationFn: ({ id, paid }: { id: string; paid: boolean }) => lessonsApi.setPaid(id, { paid }),
    onMutate: async ({ id, paid }) => {
      await queryClient.cancelQueries({ queryKey: lessonKeys.detail(id) })
      const previous = queryClient.getQueryData<LessonDetail>(lessonKeys.detail(id))
      if (previous) {
        const studentPayment: StudentPayment = paid
          ? { paid: true, paidAt: new Date().toISOString(), recordedById: me.id }
          : { paid: false, paidAt: null, recordedById: null }
        queryClient.setQueryData<LessonDetail>(lessonKeys.detail(id), {
          ...previous,
          lesson: { ...previous.lesson, studentPayment },
        })
      }
      return { previous }
    },
    onError: (_error, { id }, context) => {
      if (context?.previous) queryClient.setQueryData(lessonKeys.detail(id), context.previous)
    },
    onSettled: () => invalidate(),
  })
}

export function useDeleteLesson() {
  const invalidate = useInvalidateLessons()
  return useMutation({
    mutationFn: (id: string) => lessonsApi.remove(id),
    onSuccess: () => invalidate(),
  })
}

export function useAddPrepaid() {
  const invalidate = useInvalidateLessons()
  return useMutation({
    mutationFn: ({ studentId, body }: { studentId: string; body: AddPrepaidLessonsRequest }) =>
      studentsApi.addPrepaid(studentId, body),
    onSuccess: () => invalidate(),
  })
}

// --- students ----------------------------------------------------------------------------------

export function useCreateStudent() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: CreateStudentRequest) => studentsApi.create(body),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: teacherKeys.roster() }),
        queryClient.invalidateQueries({ queryKey: studentKeys.all }),
      ]),
  })
}

export function useRenameStudent() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => studentsApi.update(id, { name }),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: teacherKeys.roster() }),
        queryClient.invalidateQueries({ queryKey: studentKeys.all }),
        queryClient.invalidateQueries({ queryKey: enrollmentKeys.all }),
      ]),
  })
}

export function useRemoveStudent() {
  const queryClient = useQueryClient()
  const invalidate = useInvalidateLessons()
  return useMutation({
    mutationFn: (id: string) => studentsApi.remove(id),
    onSuccess: () =>
      Promise.all([
        invalidate(),
        queryClient.invalidateQueries({ queryKey: enrollmentKeys.all }),
        queryClient.invalidateQueries({ queryKey: courseKeys.all }),
      ]),
  })
}

// --- courses -----------------------------------------------------------------------------------

export function useCreateCourse() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: CreateCourseRequest) => coursesApi.create(body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: courseKeys.all }),
  })
}

export function useUpdateCourse() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateCourseRequest }) =>
      coursesApi.update(id, body),
    onSuccess: (course) => {
      queryClient.setQueryData(courseKeys.detail(course.id), course)
      return queryClient.invalidateQueries({ queryKey: courseKeys.all })
    },
  })
}

export function useArchiveCourse() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => coursesApi.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: courseKeys.all }),
  })
}

export function useEnrollStudent() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ courseId, studentId }: { courseId: string; studentId: string }) =>
      enrollmentsApi.enroll(courseId, { studentId }),
    onSuccess: (_enrollment, { courseId, studentId }) =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: enrollmentKeys.course(courseId) }),
        queryClient.invalidateQueries({ queryKey: teacherKeys.roster() }),
        queryClient.invalidateQueries({ queryKey: studentKeys.enrollmentsOf(studentId) }),
      ]),
  })
}

export function useUnenrollStudent() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ courseId, studentId }: { courseId: string; studentId: string }) =>
      enrollmentsApi.unenroll(courseId, studentId),
    onSuccess: (_void, { courseId, studentId }) =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: enrollmentKeys.course(courseId) }),
        queryClient.invalidateQueries({ queryKey: teacherKeys.roster() }),
        queryClient.invalidateQueries({ queryKey: studentKeys.enrollmentsOf(studentId) }),
      ]),
  })
}

// --- materials ---------------------------------------------------------------------------------

/** A lesson's materials come with its detail, a course's under `courseKeys.materials(courseId)`. */
export function useInvalidateMaterials() {
  const queryClient = useQueryClient()
  return (material: Pick<Material, 'courseId' | 'lessonId'>) =>
    Promise.all([
      material.courseId
        ? queryClient.invalidateQueries({ queryKey: courseKeys.materials(material.courseId) })
        : Promise.resolve(),
      material.lessonId
        ? queryClient.invalidateQueries({ queryKey: lessonKeys.detail(material.lessonId) })
        : Promise.resolve(),
    ])
}

export function useAddMaterialLink() {
  const invalidate = useInvalidateMaterials()
  return useMutation({
    mutationFn: (body: CreateMaterialRequest) => materialsApi.createLink(body),
    onSuccess: (material) => invalidate(material),
  })
}

export function useRemoveMaterial() {
  const invalidate = useInvalidateMaterials()
  return useMutation({
    mutationFn: (material: Material) => materialsApi.remove(material.id),
    onSuccess: (_void, material) => invalidate(material),
  })
}

// --- homework ----------------------------------------------------------------------------------

/** Every homework list and detail (the teacher's and the course views), after any teacher write. */
function useInvalidateHomework() {
  const queryClient = useQueryClient()
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: homeworkKeys.all }),
      queryClient.invalidateQueries({ queryKey: courseKeys.homeworkAll() }),
    ])
}

/** `POST /homework`; refreshes every homework list (the teacher's and the course views). */
export function useAssignHomework() {
  const invalidate = useInvalidateHomework()
  return useMutation({
    mutationFn: (body: CreateHomeworkRequest) => homeworkApi.create(body),
    onSuccess: () => invalidate(),
  })
}

/**
 * `PATCH /homework/{id}` with what changed. A body with `items` replaces every item, so the ticks
 * are read again first: each kept line goes out with the tick the student has now (`lines` are
 * the sheet's, with their item ids). Refreshes every homework list, also after a `404` (the
 * homework is gone or out of reach).
 */
export function useUpdateHomework() {
  const invalidate = useInvalidateHomework()
  return useMutation({
    mutationFn: async ({
      id,
      body,
      lines,
    }: {
      id: string
      body: UpdateHomeworkRequest
      lines: ChecklistLine[]
    }) => {
      if (!body.items) return homeworkApi.update(id, body)
      const latest = await homeworkApi.get(id)
      return homeworkApi.update(id, { ...body, items: checklistWithTicks(lines, latest) })
    },
    onSuccess: () => invalidate(),
    onError: (error) => {
      if (isApiError(error) && error.isNotFound) void invalidate()
    },
  })
}

/** `DELETE /homework/{id}`; drops its detail and refreshes every list, also after a `404`. */
export function useDeleteHomework() {
  const queryClient = useQueryClient()
  const invalidate = useInvalidateHomework()
  return useMutation({
    mutationFn: (id: string) => homeworkApi.remove(id),
    onSuccess: (_void, id) => {
      queryClient.removeQueries({ queryKey: homeworkKeys.detail(id) })
      return invalidate()
    },
    onError: (error) => {
      if (isApiError(error) && error.isNotFound) void invalidate()
    },
  })
}

// --- account -----------------------------------------------------------------------------------

/** `PATCH /users/{id} { password }` — self only; the server revokes the other sessions. */
export function useChangePassword() {
  const me = useMe()
  return useMutation({
    mutationFn: (password: string) => usersApi.update(me.id, { password }),
  })
}
