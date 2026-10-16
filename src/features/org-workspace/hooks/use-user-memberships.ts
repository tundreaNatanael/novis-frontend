import { useQuery } from '@tanstack/react-query'
import { memberKeys, membersApi } from '@/api/members'
import type { Member } from '@/api/types'

/**
 * The membership rows of one user in one organization. `GET /users/{id}` lists memberships
 * without their ids, so this scans the organization's member list (up to 500 rows; gap G14).
 */
export function useUserMemberships(orgId: string, userId: string) {
  return useQuery({
    queryKey: [...memberKeys.org(orgId), 'user', userId] as const,
    queryFn: async ({ signal }) => {
      const found: Member[] = []
      for (let page = 0; page < 5; page += 1) {
        const result = await membersApi.list(
          orgId,
          null,
          { page, size: 100, sort: 'createdAt,asc' },
          signal,
        )
        found.push(...result.content.filter((m) => m.userId === userId))
        if (result.last) break
      }
      return found
    },
    // A freelance teacher's student has no organization: nothing to scan.
    enabled: !!orgId && !!userId,
  })
}
