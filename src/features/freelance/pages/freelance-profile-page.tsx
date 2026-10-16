import type { RouteHandle } from '@/app/route-handle'
import { PlaceholderPage } from '@/components/placeholder-page'

export const handle: RouteHandle = { crumb: () => 'Profile', title: 'Profile' }

export function Component() {
  return <PlaceholderPage title="Profile" phase={3} />
}
