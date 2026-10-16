import type { RouteHandle } from '@/app/route-handle'
import { PlaceholderPage } from '@/components/placeholder-page'

export const handle: RouteHandle = { crumb: () => 'Overview', title: 'Overview' }

export function Component() {
  return <PlaceholderPage title="Overview" phase={2} />
}
