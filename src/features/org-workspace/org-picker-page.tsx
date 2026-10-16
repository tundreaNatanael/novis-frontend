import type { RouteHandle } from '@/app/route-handle'
import { PlaceholderPage } from '@/components/placeholder-page'

export const handle: RouteHandle = {
  crumb: () => 'Choose an organization',
  title: 'Choose an organization',
}

export function Component() {
  return <PlaceholderPage title="Choose an organization" phase={5} />
}
