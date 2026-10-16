import type { ReactNode } from 'react'
import { BrandMark, StaveRule } from '@/components/brand-mark'
import { ThemeToggle } from '@/app/shell/theme-toggle'

/** Centered card for the public pages: brand, title, one form. */
export function AuthLayout({
  title,
  description,
  children,
  footer,
}: {
  title: string
  description?: ReactNode
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <div className="flex min-h-svh flex-col bg-background">
      <header className="flex h-14 items-center justify-between px-4 md:px-8">
        <div className="flex items-center gap-2 text-foreground">
          <BrandMark className="size-7" />
          <span className="text-base font-semibold tracking-tight">Novis admin</span>
        </div>
        <ThemeToggle />
      </header>
      <main className="flex flex-1 items-start justify-center px-4 pt-6 pb-10 md:items-center md:pt-0">
        <section
          className="w-full max-w-sm rounded-lg border border-border bg-card p-6 shadow-none md:p-8"
          aria-labelledby="auth-title"
        >
          <h1 id="auth-title" className="text-xl font-semibold tracking-tight text-card-foreground">
            {title}
          </h1>
          <StaveRule className="mt-2 mb-4 max-w-40" />
          {description ? <p className="mb-5 text-sm text-muted-foreground">{description}</p> : null}
          {children}
          {footer ? (
            <div className="mt-6 text-center text-sm text-muted-foreground">{footer}</div>
          ) : null}
        </section>
      </main>
    </div>
  )
}
