import { Loader2 } from 'lucide-react'
import type { FormEventHandler, ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'

interface FormSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: ReactNode
  /** Form fields. */
  children: ReactNode
  onSubmit: FormEventHandler<HTMLFormElement>
  submitLabel: string
  isSubmitting?: boolean
  /** Hide the submit button (e.g. while showing a partial-success step). */
  hideSubmit?: boolean
  /** Extra footer content, left of the buttons. */
  footerStart?: ReactNode
  cancelLabel?: string
}

/** Side sheet on desktop, full screen on phones, primary action in a sticky footer. */
export function FormSheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  onSubmit,
  submitLabel,
  isSubmitting = false,
  hideSubmit = false,
  footerStart,
  cancelLabel = 'Cancel',
}: FormSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex h-full w-full flex-col gap-0 p-0 data-[side=right]:w-full sm:max-w-lg data-[side=right]:sm:max-w-lg"
      >
        <form onSubmit={onSubmit} noValidate className="flex h-full min-h-0 flex-col">
          <SheetHeader className="border-b border-border px-5 py-4 text-left">
            <SheetTitle>{title}</SheetTitle>
            {description ? (
              <SheetDescription>{description}</SheetDescription>
            ) : (
              <SheetDescription className="sr-only">{title}</SheetDescription>
            )}
          </SheetHeader>
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-4">
            {children}
          </div>
          <SheetFooter className="flex-row flex-wrap items-center justify-end gap-2 border-t border-border bg-card px-5 py-3 sm:flex-row">
            {footerStart ? <div className="w-full sm:mr-auto sm:w-auto">{footerStart}</div> : null}
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              {cancelLabel}
            </Button>
            {hideSubmit ? null : (
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden />
                ) : null}
                {submitLabel}
              </Button>
            )}
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
