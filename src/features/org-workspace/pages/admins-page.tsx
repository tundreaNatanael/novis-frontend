import type { RouteHandle } from '@/app/route-handle'
import { PlaceholderPage } from '@/components/placeholder-page'

export const handle: RouteHandle = { crumb: () => 'Admins', title: 'Admins' }

export function Component() {
  return <PlaceholderPage title="Admins" phase={2} />
}
