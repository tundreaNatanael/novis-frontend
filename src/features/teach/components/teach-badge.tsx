import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { TONE_SOFT, TONE_TEXT, type Tone } from './tone'

/** A capsule with an icon and a short label in one of the status tones; never colour alone. */
export function TeachBadge({
  tone = 'neutral',
  icon: Icon,
  size = 'sm',
  children,
  className,
}: {
  tone?: Tone
  icon?: LucideIcon
  size?: 'sm' | 'md'
  children: ReactNode
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex max-w-full shrink-0 items-center gap-1 rounded-full font-medium whitespace-nowrap',
        size === 'sm' ? 'h-5 px-2 text-[11px]' : 'h-6 px-2.5 text-xs',
        TONE_SOFT[tone],
        TONE_TEXT[tone],
        className,
      )}
    >
      {Icon ? <Icon className={size === 'sm' ? 'size-3' : 'size-3.5'} aria-hidden /> : null}
      <span className="truncate">{children}</span>
    </span>
  )
}
