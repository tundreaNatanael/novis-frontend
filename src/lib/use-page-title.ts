import { useEffect } from 'react'

/** Sets `document.title` to "<title> · Novis admin" while the page is mounted. */
export function usePageTitle(title: string | undefined) {
  useEffect(() => {
    const previous = document.title
    document.title = title ? `${title} · Novis admin` : 'Novis admin'
    return () => {
      document.title = previous
    }
  }, [title])
}
