import { CONFLICT_COPY } from '@/api/errors'
import { ConfirmDialog } from '@/components/confirm-dialog'

interface OverlapConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The action's name with "anyway", e.g. "Create anyway". */
  confirmLabel: string
  /** Sends the same request again with `allowOverlap: true`. */
  onConfirm: () => Promise<unknown> | unknown
}

/**
 * Asked after a `409 SCHEDULE_CONFLICT`: the time overlaps another lesson of the teacher or the
 * student. Confirming books it anyway; cancelling goes back to the form (D-045).
 */
export function OverlapConfirmDialog({
  open,
  onOpenChange,
  confirmLabel,
  onConfirm,
}: OverlapConfirmDialogProps) {
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title="This time is taken"
      description={
        <>
          <p>{CONFLICT_COPY.SCHEDULE_CONFLICT}</p>
          <p>Book it anyway, or go back and choose another time or length.</p>
        </>
      }
      confirmLabel={confirmLabel}
      onConfirm={onConfirm}
    />
  )
}
