import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { NavLink } from 'react-router'
import { BrandMark } from '@/components/brand-mark'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import type { NavSection } from './navigation'

interface SidebarProps {
  sections: NavSection[]
  collapsed: boolean
  onToggle: () => void
  className?: string
}

/** Desktop sidebar: ink surface, brass marker on the active entry, collapsible to icons. */
export function Sidebar({ sections, collapsed, onToggle, className }: SidebarProps) {
  return (
    <aside
      className={cn(
        'flex h-svh flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-150 motion-reduce:transition-none',
        collapsed ? 'w-14' : 'w-60',
        className,
      )}
      aria-label="Primary"
    >
      <div className={cn('flex h-14 items-center gap-2 px-3', collapsed && 'justify-center px-0')}>
        <BrandMark className="size-7 shrink-0 text-sidebar-foreground [&_.fill-primary]:fill-sidebar-primary" />
        {!collapsed ? <span className="text-base font-semibold tracking-tight">Novis</span> : null}
      </div>
      <nav className="flex-1 overflow-y-auto px-2 py-2">
        {sections.length === 0 && !collapsed ? (
          <p className="px-2 py-1 text-xs text-sidebar-foreground/60">
            Choose an organization to see its menu.
          </p>
        ) : null}
        {sections.map((section, index) => (
          <div key={section.label ?? index} className="mb-4">
            {section.label && !collapsed ? (
              <p className="truncate px-2 pb-1 text-xs font-medium text-sidebar-foreground/60">
                {section.label}
              </p>
            ) : null}
            <ul className="flex flex-col gap-0.5">
              {section.items.map((item) => (
                <li key={item.to}>
                  <SidebarLink item={item} collapsed={collapsed} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
      <div className={cn('border-t border-sidebar-border p-2', collapsed && 'flex justify-center')}>
        <Button
          type="button"
          variant="ghost"
          size={collapsed ? 'icon' : 'sm'}
          onClick={onToggle}
          aria-pressed={collapsed}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="w-full justify-start text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        >
          {collapsed ? <PanelLeftOpen aria-hidden /> : <PanelLeftClose aria-hidden />}
          {!collapsed ? <span>Collapse</span> : null}
        </Button>
      </div>
    </aside>
  )
}

function SidebarLink({
  item,
  collapsed,
}: {
  item: NavSection['items'][number]
  collapsed: boolean
}) {
  const link = (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        cn(
          'relative flex h-10 items-center gap-3 rounded-md px-2.5 text-sm font-medium outline-none transition-colors',
          'focus-visible:ring-2 focus-visible:ring-sidebar-ring',
          isActive
            ? 'bg-sidebar-accent text-sidebar-accent-foreground before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:rounded-full before:bg-sidebar-primary'
            : 'text-sidebar-foreground/80 hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground',
          collapsed && 'justify-center px-0',
        )
      }
    >
      <item.icon className="size-4 shrink-0" aria-hidden />
      {collapsed ? (
        <span className="sr-only">{item.label}</span>
      ) : (
        <span className="truncate">{item.label}</span>
      )}
    </NavLink>
  )
  if (!collapsed) return link
  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right">{item.label}</TooltipContent>
    </Tooltip>
  )
}

/** The same navigation as a plain list, for the mobile drawer. */
export function MobileNav({
  sections,
  onNavigate,
}: {
  sections: NavSection[]
  onNavigate: () => void
}) {
  return (
    <nav aria-label="Primary" className="flex flex-col gap-4 p-2">
      {sections.map((section, index) => (
        <div key={section.label ?? index}>
          {section.label ? (
            <p className="truncate px-2 pb-1 text-xs font-medium text-muted-foreground">
              {section.label}
            </p>
          ) : null}
          <ul className="flex flex-col gap-0.5">
            {section.items.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    cn(
                      'flex min-h-11 items-center gap-3 rounded-md px-3 text-base font-medium',
                      isActive
                        ? 'bg-accent text-accent-foreground'
                        : 'text-foreground hover:bg-accent/60',
                    )
                  }
                >
                  <item.icon className="size-5" aria-hidden />
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  )
}
