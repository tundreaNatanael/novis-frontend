import { useEffect } from 'react'

/** Sets `document.title` to "<title> · Novis" while the page is mounted (the workspace is not the admin console). */
export function useTeachTitle(title: string | undefined) {
  useEffect(() => {
    const previous = document.title
    document.title = title ? `${title} · Novis` : 'Novis'
    return () => {
      document.title = previous
    }
  }, [title])
}
