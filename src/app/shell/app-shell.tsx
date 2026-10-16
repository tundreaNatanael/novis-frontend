import { Menu, Search } from 'lucide-react'
import { Suspense, useState } from 'react'
import { Outlet, useMatch } from 'react-router'
import { useMe } from '@/auth/session'
import { BrandMark } from '@/components/brand-mark'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useLocalStorage } from '@/lib/use-local-storage'
import { Breadcrumbs } from './breadcrumbs'
import { CommandPalette } from './command-palette'
import { navigationFor } from './navigation'
import { OrgSwitcher } from './org-switcher'
import { MobileNav, Sidebar } from './sidebar'
import { ThemeToggle } from './theme-toggle'
import { UserMenu } from './user-menu'

/** Collapsible sidebar on desktop, top bar with a drawer on phones; one shell for both roles. */
export function Component() {
  const me = useMe()
  const orgMatch = useMatch('/org/:orgId/*')
  const platformOrgMatch = useMatch('/platform/orgs/:orgId/*')
  const activeOrgId = orgMatch?.params.orgId ?? platformOrgMatch?.params.orgId ?? null
  const sections = navigationFor(me, activeOrgId)
  const [collapsed, setCollapsed] = useLocalStorage<boolean>('novis-admin.sidebar-collapsed', false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex min-h-svh bg-background">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground"
        >
          Skip to content
        </a>
        <Sidebar
          sections={sections}
          collapsed={collapsed}
          onToggle={() => setCollapsed(!collapsed)}
          className="sticky top-0 hidden md:flex"
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-background/95 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:px-6">
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              aria-label="Open navigation"
              onClick={() => setDrawerOpen(true)}
            >
              <Menu aria-hidden />
            </Button>
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <OrgSwitcher me={me} activeOrgId={activeOrgId} />
              <Breadcrumbs />
            </div>
            <Button
              variant="outline"
              size="sm"
              className="hidden gap-2 text-muted-foreground md:inline-flex"
              onClick={() => setPaletteOpen(true)}
            >
              <Search aria-hidden />
              <span>Jump to…</span>
              <kbd className="ml-2 rounded-sm border border-border bg-muted px-1.5 font-mono text-[10px] text-muted-foreground">
                ⌘K
              </kbd>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              aria-label="Jump to a page"
              onClick={() => setPaletteOpen(true)}
            >
              <Search aria-hidden />
            </Button>
            <ThemeToggle />
            <UserMenu />
          </header>
          <main id="main" className="min-w-0 flex-1 px-4 py-5 md:px-8 md:py-6" tabIndex={-1}>
            <Suspense fallback={<PageSkeleton />}>
              <Outlet />
            </Suspense>
          </main>
        </div>
      </div>
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="left" className="w-72 p-0">
          <SheetHeader className="flex-row items-center gap-2 border-b border-border px-4 py-3">
            <BrandMark className="size-6" />
            <SheetTitle className="text-base">Novis</SheetTitle>
            <SheetDescription className="sr-only">Navigation</SheetDescription>
          </SheetHeader>
          <MobileNav sections={sections} onNavigate={() => setDrawerOpen(false)} />
        </SheetContent>
      </Sheet>
      <CommandPalette
        me={me}
        sections={sections}
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
      />
    </TooltipProvider>
  )
}

export function PageSkeleton() {
  return (
    <div className="flex flex-col gap-4" role="status" aria-label="Loading page">
      <Skeleton className="h-7 w-64" />
      <Skeleton className="h-3 w-40" />
      <Skeleton className="mt-4 h-40 w-full" />
    </div>
  )
}
