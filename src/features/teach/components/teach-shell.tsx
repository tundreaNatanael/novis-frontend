import {
  BookOpen,
  CalendarDays,
  CalendarPlus,
  Check,
  LogOut,
  Monitor,
  Moon,
  Sun,
  Sunrise,
  UserRound,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import { Suspense, type ReactNode } from 'react'
import { NavLink, useNavigate } from 'react-router'
import { useTheme, type ThemeSetting } from '@/app/theme'
import { useMe, useSession } from '@/auth/session'
import { BrandMark } from '@/components/brand-mark'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { TooltipProvider } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { useI18n } from '../i18n/use-i18n'
import type { Locale } from '../i18n/types'
import { teachCapabilities } from '../lib/capabilities'
import { useTeachSheets } from '../sheets/use-teach-sheets'
import { TeachAvatar } from './avatar'

interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  end?: boolean
}

/**
 * The workspace's shell (D-051): a top bar with the brand, the destinations of the mobile app
 * (five for a freelance teacher, four without Courses for an org teacher, D-053) and the one
 * primary action (Book lesson), the content under it; on a phone the destinations become a
 * bottom tab bar, like the app.
 */
export function TeachShell({ children }: { children: ReactNode }) {
  const me = useMe()
  const { t } = useI18n()
  const sheets = useTeachSheets()
  const { place, canManageCourses } = teachCapabilities(me)
  // An org teacher has no Courses tab: the school's admin creates and assigns the courses.
  const items: NavItem[] = [
    { to: '/teach', label: t('nav.today'), icon: Sunrise, end: true },
    { to: '/teach/students', label: t('nav.students'), icon: Users },
    { to: '/teach/calendar', label: t('nav.calendar'), icon: CalendarDays },
    ...(canManageCourses
      ? [{ to: '/teach/courses', label: t('nav.courses'), icon: BookOpen }]
      : []),
    { to: '/teach/profile', label: t('nav.profile'), icon: UserRound },
  ]
  const placeLabel =
    place.kind === 'org'
      ? t('nav.teacherAt', { school: place.organization.name })
      : t('nav.freelance')

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex min-h-svh flex-col bg-background">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground"
        >
          {t('common.skipToContent')}
        </a>
        <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/75">
          <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-4 px-4 md:px-6">
            <NavLink
              to="/teach"
              end
              className="flex min-w-0 items-center gap-2 rounded-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <BrandMark className="size-8 shrink-0 text-foreground" />
              <span className="flex min-w-0 flex-col leading-tight">
                <span className="text-base font-semibold tracking-tight text-foreground">
                  Novis
                </span>
                <span className="hidden truncate text-xs text-muted-foreground sm:block">
                  {placeLabel}
                </span>
              </span>
            </NavLink>
            <nav aria-label={t('nav.primary')} className="hidden flex-1 justify-center md:flex">
              <ul className="flex items-center gap-1 rounded-full bg-muted p-1">
                {items.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.end}
                      className={({ isActive }) =>
                        cn(
                          'flex h-9 items-center gap-2 rounded-full px-4 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                          isActive
                            ? 'bg-card text-foreground shadow-sm'
                            : 'text-muted-foreground hover:text-foreground',
                        )
                      }
                    >
                      <item.icon className="size-4" aria-hidden />
                      {item.label}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </nav>
            <div className="ml-auto flex items-center gap-2">
              <Button
                type="button"
                className="rounded-full"
                onClick={() => sheets.open({ kind: 'book' })}
              >
                <CalendarPlus aria-hidden />
                <span className="hidden sm:inline">{t('nav.bookLesson')}</span>
                <span className="sr-only sm:hidden">{t('nav.bookLesson')}</span>
              </Button>
              <AccountMenu />
            </div>
          </div>
        </header>
        <main
          id="main"
          tabIndex={-1}
          className="mx-auto w-full max-w-6xl flex-1 px-4 py-5 pb-24 md:px-6 md:py-8 md:pb-10"
        >
          <Suspense fallback={<TeachPageSkeleton />}>{children}</Suspense>
        </main>
        <nav
          aria-label={t('nav.primary')}
          className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 backdrop-blur md:hidden"
        >
          <ul className="flex items-stretch justify-around px-1 pt-1 pb-[max(0.25rem,env(safe-area-inset-bottom))]">
            {items.map((item) => (
              <li key={item.to} className="flex-1">
                <NavLink
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    cn(
                      'flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-lg text-[11px] font-medium',
                      isActive ? 'text-accent-foreground' : 'text-muted-foreground',
                    )
                  }
                >
                  <item.icon className="size-5" aria-hidden />
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </TooltipProvider>
  )
}

const THEMES: { value: ThemeSetting; icon: LucideIcon }[] = [
  { value: 'light', icon: Sun },
  { value: 'dark', icon: Moon },
  { value: 'system', icon: Monitor },
]

/** The avatar menu: who is signed in, the Payments page (org teachers), language, appearance, sign out. */
function AccountMenu() {
  const me = useMe()
  const { signOut } = useSession()
  const navigate = useNavigate()
  const { t, locale, setLocale } = useI18n()
  const { setting, setSetting } = useTheme()
  const { canViewPayouts } = teachCapabilities(me)
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="rounded-full"
          aria-label={t('nav.menu')}
        >
          <TeachAvatar name={me.name} size="sm" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="font-normal">
          <p className="truncate text-sm font-medium text-foreground">{me.name}</p>
          <p className="truncate text-xs text-muted-foreground">{me.email}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => navigate('/teach/profile')}>
          <UserRound aria-hidden />
          {t('nav.profile')}
        </DropdownMenuItem>
        {canViewPayouts ? (
          <DropdownMenuItem onSelect={() => navigate('/teach/payments')}>
            <Wallet aria-hidden />
            {t('nav.payments')}
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">
          {t('common.language')}
        </DropdownMenuLabel>
        {(['en', 'ro'] as Locale[]).map((value) => (
          <DropdownMenuItem key={value} onSelect={() => setLocale(value)}>
            {t(`common.languages.${value}`)}
            {locale === value ? <Check className="ml-auto" aria-hidden /> : null}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">
          {t('common.theme')}
        </DropdownMenuLabel>
        {THEMES.map((option) => (
          <DropdownMenuItem key={option.value} onSelect={() => setSetting(option.value)}>
            <option.icon aria-hidden />
            {t(`common.themes.${option.value}`)}
            {setting === option.value ? <Check className="ml-auto" aria-hidden /> : null}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => {
            void signOut().then(() => navigate('/login', { replace: true }))
          }}
        >
          <LogOut aria-hidden />
          {t('common.signOut')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function TeachPageSkeleton() {
  return (
    <div className="flex flex-col gap-4" role="status">
      <Skeleton className="h-8 w-56" />
      <Skeleton className="h-4 w-40" />
      <Skeleton className="mt-4 h-40 w-full rounded-2xl" />
    </div>
  )
}
