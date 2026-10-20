import { useQuery } from '@tanstack/react-query'
import { freelanceTeacherKeys, freelanceTeachersApi } from '@/api/freelance-teachers'
import { useMe } from '@/auth/session'
import { deriveCapabilities } from '@/lib/permissions'

/**
 * Breadcrumb label for `/platform/freelance/:teacherId`, from the query the layout uses.
 * Breadcrumbs render before the route guard redirects, so it fetches for the super-admin only.
 */
export function FreelanceTeacherCrumb({ teacherId }: { teacherId: string | undefined }) {
  const { canManageFreelance } = deriveCapabilities(useMe())
  const query = useQuery({
    queryKey: freelanceTeacherKeys.detail(teacherId ?? ''),
    queryFn: ({ signal }) => freelanceTeachersApi.get(teacherId ?? '', signal),
    enabled: !!teacherId && canManageFreelance,
  })
  return <>{query.data?.name ?? 'Freelance teacher'}</>
}
