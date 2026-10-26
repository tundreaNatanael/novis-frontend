import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { TONE_SOFT, TONE_TEXT, type Tone } from './tone'

/** The one icon container of the workspace: a rounded square with a soft tone behind the icon. */
export function IconBadge({
  icon: Icon,
  tone = 'accent',
  size = 'md',
  className,
}: {
  icon: LucideIcon
  tone?: Tone
  size?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  const sizes = { sm: 'size-8 rounded-lg', md: 'size-10 rounded-xl', lg: 'size-12 rounded-xl' }
  const icons = { sm: 'size-4', md: 'size-5', lg: 'size-6' }
  return (
    <span
      aria-hidden
      className={cn(
        'inline-flex shrink-0 items-center justify-center',
        sizes[size],
        TONE_SOFT[tone],
        TONE_TEXT[tone],
        className,
      )}
    >
      <Icon className={icons[size]} />
    </span>
  )
}
