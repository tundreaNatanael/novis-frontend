import { useSyncExternalStore } from 'react'

/** `window.matchMedia(query).matches`, kept current; `false` where matchMedia is unavailable. */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia?.(query)
      if (!list) return () => {}
      list.addEventListener?.('change', onChange)
      return () => list.removeEventListener?.('change', onChange)
    },
    () => window.matchMedia?.(query)?.matches ?? false,
    () => false,
  )
}
