import { useQuery } from '@tanstack/react-query'
import { lessonKeys, lessonsApi } from '@/api/lessons'
import { formatDate } from '@/lib/format'

export function LessonCrumb({ lessonId }: { lessonId: string | undefined }) {
  const query = useQuery({
    queryKey: lessonKeys.detail(lessonId ?? ''),
    queryFn: ({ signal }) => lessonsApi.get(lessonId ?? '', signal),
    enabled: !!lessonId,
  })
  const lesson = query.data?.lesson
  return (
    <>
      {lesson
        ? lesson.scheduledAt
          ? `Lesson · ${formatDate(lesson.scheduledAt)}`
          : 'Unscheduled lesson'
        : 'Lesson'}
    </>
  )
}
