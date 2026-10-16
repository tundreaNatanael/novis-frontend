import { useQuery } from '@tanstack/react-query'
import { courseKeys, coursesApi } from '@/api/courses'
import { studentKeys, studentsApi } from '@/api/students'
import { userKeys, usersApi } from '@/api/users'

/** Breadcrumb labels for detail pages, read from the same queries the pages use. */
export function UserCrumb({ userId }: { userId: string | undefined }) {
  const query = useQuery({
    queryKey: userKeys.detail(userId ?? ''),
    queryFn: ({ signal }) => usersApi.get(userId ?? '', signal),
    enabled: !!userId,
  })
  return <>{query.data?.name ?? 'Person'}</>
}

export function StudentCrumb({ studentId }: { studentId: string | undefined }) {
  const query = useQuery({
    queryKey: studentKeys.detail(studentId ?? ''),
    queryFn: ({ signal }) => studentsApi.get(studentId ?? '', signal),
    enabled: !!studentId,
  })
  return <>{query.data?.name ?? 'Student'}</>
}

export function CourseCrumb({ courseId }: { courseId: string | undefined }) {
  const query = useQuery({
    queryKey: courseKeys.detail(courseId ?? ''),
    queryFn: ({ signal }) => coursesApi.get(courseId ?? '', signal),
    enabled: !!courseId,
  })
  return <>{query.data?.title ?? 'Course'}</>
}
