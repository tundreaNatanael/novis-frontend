import type { RouteHandle } from '@/app/route-handle'
import { PlaceholderPage } from '@/components/placeholder-page'

export const handle: RouteHandle = { crumb: () => 'Lesson', title: 'Lesson' }

export function Component() {
  return <PlaceholderPage title="Lesson" phase={4} />
}
