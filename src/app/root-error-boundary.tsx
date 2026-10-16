import { isRouteErrorResponse, Link, useRouteError } from 'react-router'
import { errorMessage } from '@/api/errors'

/** Last line of defense for render errors and failed lazy imports. */
export function RootErrorBoundary() {
  const error = useRouteError()
  const title = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : 'Something went wrong'
  const detail = isRouteErrorResponse(error) ? error.data : errorMessage(error)
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-4 bg-background p-6 text-center">
      <h1 className="text-xl font-semibold text-foreground">{title}</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        {typeof detail === 'string' ? detail : 'An unexpected error interrupted the page.'}
      </p>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-sm border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-accent"
        >
          Reload
        </button>
        <Link
          to="/"
          className="rounded-sm bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
        >
          Go home
        </Link>
      </div>
    </main>
  )
}
