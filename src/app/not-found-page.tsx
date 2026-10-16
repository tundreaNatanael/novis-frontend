import { Link } from 'react-router'

export function Component() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-3 bg-background p-6 text-center">
      <p className="font-mono text-sm text-muted-foreground">404</p>
      <h1 className="text-xl font-semibold text-foreground">This page does not exist</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        Check the address, or go back to the console.
      </p>
      <Link
        to="/"
        className="mt-2 rounded-sm bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
      >
        Go home
      </Link>
    </main>
  )
}
