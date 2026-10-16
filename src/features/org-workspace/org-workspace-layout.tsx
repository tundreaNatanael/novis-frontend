import { Outlet } from 'react-router'
import type { RouteHandle } from '@/app/route-handle'

export const handle: RouteHandle = { crumb: () => 'Organization' }

export function Component() {
  return <Outlet />
}
