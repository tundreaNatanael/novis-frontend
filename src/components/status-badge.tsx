import {
  Archive,
  Ban,
  CheckCircle2,
  CircleDashed,
  Clock,
  GraduationCap,
  type LucideIcon,
  XCircle,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { enumLabel } from '@/lib/format'
import { cn } from '@/lib/utils'

export type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral'

const TONE_CLASSES: Record<Tone, string> = {
  success: 'border-transparent bg-success-soft text-success',
  warning: 'border-transparent bg-warning-soft text-warning',
  danger: 'border-transparent bg-danger-soft text-danger',
  info: 'border-transparent bg-info-soft text-info',
  neutral: 'border-border bg-muted text-muted-foreground',
}

const KNOWN: Record<string, { tone: Tone; icon: LucideIcon }> = {
  ACTIVE: { tone: 'success', icon: CheckCircle2 },
  DISABLED: { tone: 'danger', icon: Ban },
  ARCHIVED: { tone: 'neutral', icon: Archive },
  DROPPED: { tone: 'neutral', icon: XCircle },
  COMPLETED: { tone: 'info', icon: GraduationCap },
  PENDING: { tone: 'info', icon: Clock },
  PRESENT: { tone: 'success', icon: CheckCircle2 },
  CANCELED: { tone: 'neutral', icon: XCircle },
  CANCELED_LATE: { tone: 'warning', icon: XCircle },
}

interface StatusBadgeProps {
  value: string | null | undefined
  /** Override the label (default: `enumLabel(value)`). */
  label?: string
  tone?: Tone
  icon?: LucideIcon
  className?: string
}

/** Icon + text, never color alone; the raw enum value is in the tooltip. */
export function StatusBadge({ value, label, tone, icon, className }: StatusBadgeProps) {
  if (!value) return <span className="text-muted-foreground">—</span>
  const known = KNOWN[value]
  const Icon = icon ?? known?.icon ?? CircleDashed
  const resolvedTone = tone ?? known?.tone ?? 'neutral'
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge
          variant="outline"
          className={cn('gap-1 font-medium', TONE_CLASSES[resolvedTone], className)}
        >
          <Icon className="size-3" aria-hidden />
          {label ?? enumLabel(value)}
        </Badge>
      </TooltipTrigger>
      <TooltipContent>
        <code className="font-mono text-xs">{value}</code>
      </TooltipContent>
    </Tooltip>
  )
}

/** A small badge with a tone and free text (e.g. "Paid", "Prepaid lesson used"). */
export function ToneBadge({
  tone,
  icon: Icon,
  children,
  className,
}: {
  tone: Tone
  icon?: LucideIcon
  children: React.ReactNode
  className?: string
}) {
  return (
    <Badge variant="outline" className={cn('gap-1 font-medium', TONE_CLASSES[tone], className)}>
      {Icon ? <Icon className="size-3" aria-hidden /> : null}
      {children}
    </Badge>
  )
}
