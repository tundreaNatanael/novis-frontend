import type { RouteHandle } from '@/app/route-handle'
import { PlaceholderPage } from '@/components/placeholder-page'

export const handle: RouteHandle = {
  crumb: () => 'Freelance teachers',
  title: 'Freelance teachers',
}

export function Component() {
  return <PlaceholderPage title="Freelance teachers" phase={3} />
}
