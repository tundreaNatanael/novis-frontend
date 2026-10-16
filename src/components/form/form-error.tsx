import { AlertTriangle } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

/** A form-level error (not tied to one field): says what happened and what to do. */
export function FormError({
  title = 'That did not work',
  message,
}: {
  title?: string
  message: string | null | undefined
}) {
  if (!message) return null
  return (
    <Alert variant="destructive" role="alert">
      <AlertTriangle aria-hidden />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  )
}
