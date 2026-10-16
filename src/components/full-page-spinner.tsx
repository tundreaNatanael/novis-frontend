import { Loader2 } from 'lucide-react'

/** Centered loading state for whole-screen waits (session restore, lazy routes). */
export function FullPageSpinner({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="flex min-h-svh items-center justify-center bg-background" role="status">
      <Loader2
        className="size-6 animate-spin text-muted-foreground motion-reduce:animate-none"
        aria-hidden
      />
      <span className="sr-only">{label}</span>
    </div>
  )
}
