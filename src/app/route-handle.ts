import type { ReactNode } from 'react'
import type { Params } from 'react-router'

/** What a route module may export as `handle`: a breadcrumb and a document title. */
export interface RouteHandle {
  /** Breadcrumb label; receives the matched params so pages can render entity names. */
  crumb?: (params: Params) => ReactNode
  title?: string
}
