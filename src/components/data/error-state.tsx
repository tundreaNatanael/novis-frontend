import { AlertTriangle, RotateCw } from 'lucide-react'
import { errorMessage, isApiError } from '@/api/errors'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface ErrorStateProps {
  error: unknown
  onRetry?: () => void
  className?: string
}

/** Inline error with the server's message and a retry; 404s read as "not found or not accessible". */
export function ErrorState({ error, onRetry, className }: ErrorStateProps) {
  const notFound = isApiError(error) && error.isNotFound
  const forbidden = isApiError(error) && error.isForbidden
  const title = notFound
    ? 'Not found, or not accessible with your role'
    : forbidden
      ? 'Your role cannot view this'
      : 'Could not load'
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center justify-center gap-2 rounded-lg border border-border bg-card px-6 py-10 text-center',
        className,
      )}
    >
      <AlertTriangle className="size-7 text-destructive" aria-hidden />
      <h3 className="text-base font-medium text-foreground">{title}</h3>
      {!notFound ? (
        <p className="max-w-md text-sm text-muted-foreground">{errorMessage(error)}</p>
      ) : null}
      {onRetry && !notFound && !forbidden ? (
        <Button variant="outline" size="sm" onClick={onRetry} className="mt-2">
          <RotateCw aria-hidden />
          Try again
        </Button>
      ) : null}
    </div>
  )
}
