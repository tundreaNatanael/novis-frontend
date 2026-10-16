import type { RouteHandle } from '@/app/route-handle'
import { PlaceholderPage } from '@/components/placeholder-page'

export const handle: RouteHandle = { crumb: () => 'Lessons', title: 'Lessons' }

export function Component() {
  return <PlaceholderPage title="Lessons" phase={4} />
}
