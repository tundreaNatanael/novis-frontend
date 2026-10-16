import type { RouteHandle } from '@/app/route-handle'
import { PlaceholderPage } from '@/components/placeholder-page'

export const handle: RouteHandle = { title: 'Lessons' }

export function Component() {
  return <PlaceholderPage title="Lessons" phase={4} />
}
