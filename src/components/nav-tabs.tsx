import { NavLink } from 'react-router'
import { cn } from '@/lib/utils'

export interface NavTab {
  label: string
  to: string
  end?: boolean
  /** A count shown after the label when known. */
  count?: number
}

/** URL-driven tabs; the strip scrolls horizontally on phones (the only horizontal scroller). */
export function NavTabs({ items, label = 'Sections' }: { items: NavTab[]; label?: string }) {
  return (
    <nav aria-label={label} className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
      <ul className="flex min-w-max gap-1 border-b border-border">
        {items.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  '-mb-px inline-flex h-11 items-center gap-1.5 border-b-2 px-3 text-sm font-medium whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none md:h-10',
                  isActive
                    ? 'border-primary text-foreground'
                    : 'border-transparent text-muted-foreground hover:border-border hover:text-foreground',
                )
              }
            >
              {item.label}
              {item.count !== undefined ? (
                <span className="rounded-sm bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground tabular-nums">
                  {item.count}
                </span>
              ) : null}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
