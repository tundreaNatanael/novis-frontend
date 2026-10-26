import { X } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { useT } from '../i18n/use-i18n'

interface TeachSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  subtitle?: ReactNode
  children: ReactNode
  /** The primary action, at the bottom; it stays in view while the body scrolls. */
  footer?: ReactNode
  /** Keep the sheet open on Escape and clicks outside (an upload in progress asks first). */
  preventClose?: boolean
  /** Wraps the body in a form: Enter submits it. */
  onSubmit?: () => void
}

/**
 * The workspace's sheet (the mobile app's `<Sheet>`): a panel on the right on desktop, the whole
 * screen on a phone, its own title row with a close button, a scrolling body and a footer that
 * stays in view.
 */
export function TeachSheet({
  open,
  onOpenChange,
  title,
  subtitle,
  children,
  footer,
  preventClose = false,
  onSubmit,
}: TeachSheetProps) {
  const t = useT()
  const body = (
    <>
      <SheetHeader className="flex-row items-start gap-3 border-b border-border px-5 py-4 text-left">
        <div className="min-w-0 flex-1">
          <SheetTitle className="text-lg">{title}</SheetTitle>
          {subtitle ? (
            <SheetDescription>{subtitle}</SheetDescription>
          ) : (
            <SheetDescription className="sr-only">{title}</SheetDescription>
          )}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="-mr-2 rounded-full"
          aria-label={t('common.close')}
          onClick={() => onOpenChange(false)}
        >
          <X aria-hidden />
        </Button>
      </SheetHeader>
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-5 py-5">{children}</div>
      {footer ? (
        <SheetFooter className="flex-row flex-wrap items-center justify-end gap-2 border-t border-border bg-card px-5 py-3 sm:flex-row">
          {footer}
        </SheetFooter>
      ) : null}
    </>
  )
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        showCloseButton={false}
        className="flex h-full w-full flex-col gap-0 p-0 data-[side=right]:w-full sm:max-w-lg data-[side=right]:sm:max-w-lg"
        onEscapeKeyDown={(event) => {
          if (preventClose) event.preventDefault()
        }}
        onInteractOutside={(event) => {
          if (preventClose) event.preventDefault()
        }}
      >
        {onSubmit ? (
          <form
            noValidate
            className="flex h-full min-h-0 flex-col"
            onSubmit={(event) => {
              event.preventDefault()
              onSubmit()
            }}
          >
            {body}
          </form>
        ) : (
          <div className="flex h-full min-h-0 flex-col">{body}</div>
        )}
      </SheetContent>
    </Sheet>
  )
}
