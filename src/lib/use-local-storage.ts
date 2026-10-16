import { useCallback, useState } from 'react'

/** A piece of per-browser UI state (sidebar collapsed, last tab). Never server data. */
export function useLocalStorage<T extends string | boolean>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = window.localStorage.getItem(key)
      if (raw === null) return initial
      return (typeof initial === 'boolean' ? raw === 'true' : raw) as T
    } catch {
      return initial
    }
  })
  const update = useCallback(
    (next: T) => {
      setValue(next)
      try {
        window.localStorage.setItem(key, String(next))
      } catch {
        // Fine: the preference lasts for this tab.
      }
    },
    [key],
  )
  return [value, update] as const
}
