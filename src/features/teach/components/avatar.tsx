import { cn } from '@/lib/utils'
import { initialsOf } from '../lib/initials'

/** Initials on the soft accent, the one avatar of the workspace (decorative: the name is always beside it). */
export function TeachAvatar({
  name,
  size = 'md',
  className,
}: {
  name: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}) {
  const sizes = {
    sm: 'size-8 text-xs',
    md: 'size-10 text-sm',
    lg: 'size-14 text-base',
    xl: 'size-24 text-2xl',
  }
  return (
    <span
      aria-hidden
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full bg-accent font-semibold text-accent-foreground select-none',
        sizes[size],
        className,
      )}
    >
      {initialsOf(name)}
    </span>
  )
}
