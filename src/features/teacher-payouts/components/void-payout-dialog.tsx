import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { useId, useState } from 'react'
import { toast } from 'sonner'
import { errorMessage, isApiError } from '@/api/errors'
import { lessonKeys } from '@/api/lessons'
import { teacherPayoutKeys, teacherPayoutsApi } from '@/api/teacher-payouts'
import type { TeacherPayout } from '@/api/types'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { formatDate, pluralize } from '@/lib/format'
import { VOID_CONFIRM_TEXT } from '../payout-state'

interface Props {
  payout: TeacherPayout
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * `POST /teacher-payouts/{id}/void { reason }`: the payout stays as history with the reason and
 * its lessons are payable again. A reason and typing "void" confirm it; a `409` (voided meanwhile)
 * refreshes the lists.
 */
export function VoidPayoutDialog({ payout, open, onOpenChange }: Props) {
  const queryClient = useQueryClient()
  const reasonId = useId()
  const typedId = useId()
  const [reason, setReason] = useState('')
  const [typed, setTyped] = useState('')
  const [error, setError] = useState<string | null>(null)
  const mutation = useMutation({
    mutationFn: () => teacherPayoutsApi.void(payout.id, { reason: reason.trim() }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: teacherPayoutKeys.all }),
        queryClient.invalidateQueries({ queryKey: lessonKeys.all }),
      ])
      toast.success('Payout voided', {
        description: `${pluralize(payout.lessonCount, 'lesson')} can be paid out again.`,
      })
      reset()
      onOpenChange(false)
    },
    onError: (cause) => {
      setError(errorMessage(cause))
      if (isApiError(cause) && (cause.isConflict || cause.isNotFound)) {
        void queryClient.invalidateQueries({ queryKey: teacherPayoutKeys.all })
      }
    },
  })
  const tooLong = reason.length > 4000
  const ready = reason.trim().length > 0 && !tooLong && typed.trim() === VOID_CONFIRM_TEXT

  function reset() {
    setReason('')
    setTyped('')
    setError(null)
  }

  function close(next: boolean) {
    if (mutation.isPending) return
    if (!next) reset()
    onOpenChange(next)
  }

  return (
    <AlertDialog open={open} onOpenChange={close}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Void payout</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="text-sm text-muted-foreground [&_p+p]:mt-2">
              <p>
                Voids the payout of <strong>{formatDate(payout.paidOn)}</strong> to{' '}
                <strong>{payout.teacherName}</strong> ({pluralize(payout.lessonCount, 'lesson')}).
                It is kept as history with your reason, and the teacher sees it as voided.
              </p>
              <p>Its lessons can be paid out again. This cannot be undone.</p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={reasonId}>Reason</Label>
          <Textarea
            id={reasonId}
            rows={3}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            aria-invalid={tooLong ? true : undefined}
            placeholder="e.g. Recorded twice"
          />
          {tooLong ? (
            <p role="alert" className="text-xs font-medium text-destructive">
              At most 4000 characters
            </p>
          ) : null}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={typedId}>
            Type <code className="font-mono text-xs">{VOID_CONFIRM_TEXT}</code> to confirm
          </Label>
          <Input
            id={typedId}
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
        </div>
        {error ? (
          <p role="alert" className="text-sm font-medium text-destructive">
            {error}
          </p>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={mutation.isPending}>Cancel</AlertDialogCancel>
          <Button
            variant="destructive"
            onClick={() => {
              setError(null)
              mutation.mutate()
            }}
            disabled={!ready || mutation.isPending}
          >
            {mutation.isPending ? (
              <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden />
            ) : null}
            Void payout
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
