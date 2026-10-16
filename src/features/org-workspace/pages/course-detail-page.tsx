import type { RouteHandle } from '@/app/route-handle'
import { PlaceholderPage } from '@/components/placeholder-page'

export const handle: RouteHandle = { crumb: () => 'Course', title: 'Course' }

export function Component() {
  return <PlaceholderPage title="Course" phase={2} />
}
