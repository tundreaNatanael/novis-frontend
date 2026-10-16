import type { RouteHandle } from '@/app/route-handle'
import { PlaceholderPage } from '@/components/placeholder-page'

export const handle: RouteHandle = { crumb: () => 'Staff member', title: 'Staff member' }

export function Component() {
  return <PlaceholderPage title="Staff member" phase={2} />
}
