import { useQuery } from '@tanstack/react-query'
import { orgKeys, orgsApi } from '@/api/orgs'

/** Breadcrumb label for an organization, from the cached detail query. */
export function OrgCrumb({ orgId }: { orgId: string | undefined }) {
  const query = useQuery({
    queryKey: orgKeys.detail(orgId ?? ''),
    queryFn: ({ signal }) => orgsApi.get(orgId ?? '', signal),
    enabled: !!orgId,
    staleTime: 60_000,
  })
  return <>{query.data?.name ?? 'Organization'}</>
}
