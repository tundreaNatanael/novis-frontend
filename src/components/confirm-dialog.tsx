import { Loader2 } from 'lucide-react'
import { type ReactNode, useId, useState } from 'react'
import { errorMessage } from '@/api/errors'
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

interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  /** The real consequence, in the backend's terms. */
  description: ReactNode
  confirmLabel: string
  destructive?: boolean
  /** Require typing this value (e.g. the organization slug) before confirming. */
  confirmText?: string
  confirmTextLabel?: string
  onConfirm: () => Promise<unknown> | unknown
}

/** A confirmation that states what will happen; closes on success, shows the error otherwise. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  destructive = false,
  confirmText,
  confirmTextLabel = 'Type to confirm',
  onConfirm,
}: ConfirmDialogProps) {
  const [typed, setTyped] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputId = useId()
  const ready = !confirmText || typed.trim() === confirmText

  const close = (next: boolean) => {
    if (pending) return
    if (!next) {
      setTyped('')
      setError(null)
    }
    onOpenChange(next)
  }

  const confirm = async () => {
    setPending(true)
    setError(null)
    try {
      await onConfirm()
      setTyped('')
      onOpenChange(false)
    } catch (cause) {
      setError(errorMessage(cause))
    } finally {
      setPending(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={close}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="text-sm text-muted-foreground [&_p+p]:mt-2">{description}</div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        {confirmText ? (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={inputId}>
              {confirmTextLabel}: <code className="font-mono text-xs">{confirmText}</code>
            </Label>
            <Input
              id={inputId}
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
          </div>
        ) : null}
        {error ? (
          <p role="alert" className="text-sm font-medium text-destructive">
            {error}
          </p>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <Button
            variant={destructive ? 'destructive' : 'default'}
            onClick={() => void confirm()}
            disabled={!ready || pending}
          >
            {pending ? (
              <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden />
            ) : null}
            {confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
