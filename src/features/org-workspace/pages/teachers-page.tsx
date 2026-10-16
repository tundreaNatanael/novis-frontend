import type { RouteHandle } from '@/app/route-handle'
import { PlaceholderPage } from '@/components/placeholder-page'

export const handle: RouteHandle = { crumb: () => 'Teachers', title: 'Teachers' }

export function Component() {
  return <PlaceholderPage title="Teachers" phase={2} />
}
