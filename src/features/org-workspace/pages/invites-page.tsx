import type { RouteHandle } from '@/app/route-handle'
import { PlaceholderPage } from '@/components/placeholder-page'

export const handle: RouteHandle = { crumb: () => 'Invites', title: 'Invites' }

export function Component() {
  return <PlaceholderPage title="Invites" phase={2} />
}
