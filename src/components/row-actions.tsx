import { MoreHorizontal, type LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

export interface RowAction {
  label: string
  icon?: LucideIcon
  onSelect: () => void
  destructive?: boolean
  /** When set the item is disabled and the reason is shown under the label. */
  disabledReason?: string | null
  /** Visual break before this item. */
  separatorBefore?: boolean
}

/** The ⋯ menu at the end of a row. Disabled actions stay visible with their reason. */
export function RowActions({
  actions,
  label = 'Row actions',
}: {
  actions: RowAction[]
  label?: string
}) {
  if (actions.length === 0) return null
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={label} className="size-9 md:size-8">
          <MoreHorizontal aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-56">
        {actions.map((action) => (
          <div key={action.label}>
            {action.separatorBefore ? <DropdownMenuSeparator /> : null}
            <DropdownMenuItem
              variant={action.destructive ? 'destructive' : 'default'}
              disabled={!!action.disabledReason}
              onSelect={action.onSelect}
              className={cn(action.disabledReason && 'flex-col items-start gap-0.5')}
            >
              <span className="flex items-center gap-2">
                {action.icon ? <action.icon className="size-4" aria-hidden /> : null}
                {action.label}
              </span>
              {action.disabledReason ? (
                <span className="text-xs whitespace-normal text-muted-foreground">
                  {action.disabledReason}
                </span>
              ) : null}
            </DropdownMenuItem>
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
