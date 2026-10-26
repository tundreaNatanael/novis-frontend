import { useEffect } from 'react'
import { Outlet } from 'react-router'
import type { RouteHandle } from '@/app/route-handle'
import { TeachShell } from './components/teach-shell'
import { TeachI18nProvider } from './i18n/provider'
import { TeachSheetsProvider } from './sheets/sheet-host'

export const handle: RouteHandle = { title: 'Teacher workspace' }

/**
 * The teacher workspace (D-051), mounted at `/teach/*` behind `RequireTeacher`: its own language,
 * its own look (the `teach` class on `<html>` switches the tokens, portals included), its own
 * shell and the one sheet host every page opens its forms through.
 */
export function Component() {
  useEffect(() => {
    document.documentElement.classList.add('teach')
    return () => {
      document.documentElement.classList.remove('teach')
    }
  }, [])

  return (
    <TeachI18nProvider>
      <TeachSheetsProvider>
        <TeachShell>
          <Outlet />
        </TeachShell>
      </TeachSheetsProvider>
    </TeachI18nProvider>
  )
}
