import type { RouteHandle } from '@/app/route-handle'
import { PlaceholderPage } from '@/components/placeholder-page'

export const handle: RouteHandle = { crumb: () => 'Students', title: 'Students' }

export function Component() {
  return <PlaceholderPage title="Students" phase={3} />
}
