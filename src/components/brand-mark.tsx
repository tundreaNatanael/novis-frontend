import { cn } from '@/lib/utils'

/** The stave: five lines and a brass note head. The console's one decorative element. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={cn('size-7', className)}
      aria-hidden="true"
      focusable="false"
    >
      <g stroke="currentColor" strokeWidth="1.25" opacity="0.55">
        <line x1="3" y1="8" x2="29" y2="8" />
        <line x1="3" y1="12" x2="29" y2="12" />
        <line x1="3" y1="16" x2="29" y2="16" />
        <line x1="3" y1="20" x2="29" y2="20" />
        <line x1="3" y1="24" x2="29" y2="24" />
      </g>
      <ellipse
        cx="18"
        cy="20"
        rx="4.2"
        ry="3"
        transform="rotate(-20 18 20)"
        className="fill-primary"
      />
      <rect x="21.4" y="7" width="1.4" height="13.5" rx="0.7" className="fill-primary" />
    </svg>
  )
}

/** The ruled underline used beneath page titles. */
export function StaveRule({ className }: { className?: string }) {
  return <div className={cn('stave-rule w-full max-w-md', className)} aria-hidden="true" />
}
