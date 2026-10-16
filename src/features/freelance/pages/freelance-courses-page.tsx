import type { RouteHandle } from '@/app/route-handle'
import { PlaceholderPage } from '@/components/placeholder-page'

export const handle: RouteHandle = { crumb: () => 'Courses', title: 'Courses' }

export function Component() {
  return <PlaceholderPage title="Courses" phase={3} />
}
