import type { RouteHandle } from '@/app/route-handle'
import { PlaceholderPage } from '@/components/placeholder-page'

export const handle: RouteHandle = { crumb: () => 'Student', title: 'Student' }

export function Component() {
  return <PlaceholderPage title="Student" phase={2} />
}
