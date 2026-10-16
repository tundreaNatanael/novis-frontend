import { ChevronRight } from 'lucide-react'
import { Fragment, type ReactNode } from 'react'
import { Link, useMatches } from 'react-router'
import type { RouteHandle } from '../route-handle'

interface Crumb {
  id: string
  label: ReactNode
  to: string
}

/** Breadcrumbs from the matched routes' `handle.crumb`; the last one is the current page. */
export function Breadcrumbs() {
  const matches = useMatches()
  const crumbs: Crumb[] = matches.flatMap((match) => {
    const handle = match.handle as RouteHandle | undefined
    if (!handle?.crumb) return []
    return [{ id: match.id, label: handle.crumb(match.params), to: match.pathname }]
  })
  if (crumbs.length === 0) return null
  return (
    <nav aria-label="Breadcrumb" className="min-w-0">
      <ol className="flex min-w-0 items-center gap-1 text-sm text-muted-foreground">
        {crumbs.map((crumb, index) => {
          const last = index === crumbs.length - 1
          return (
            <Fragment key={crumb.id}>
              {index > 0 ? (
                <ChevronRight className="hidden size-3.5 shrink-0 sm:block" aria-hidden />
              ) : null}
              <li
                className={
                  last
                    ? 'min-w-0 truncate font-medium text-foreground'
                    : 'hidden min-w-0 truncate sm:block'
                }
              >
                {last ? (
                  <span aria-current="page">{crumb.label}</span>
                ) : (
                  <Link to={crumb.to} className="hover:text-foreground">
                    {crumb.label}
                  </Link>
                )}
              </li>
            </Fragment>
          )
        })}
      </ol>
    </nav>
  )
}
