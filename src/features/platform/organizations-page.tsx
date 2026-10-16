import type { RouteHandle } from '@/app/route-handle'
import { PlaceholderPage } from '@/components/placeholder-page'

export const handle: RouteHandle = { crumb: () => 'Organizations', title: 'Organizations' }

export function Component() {
  return <PlaceholderPage title="Organizations" phase={2} />
}
