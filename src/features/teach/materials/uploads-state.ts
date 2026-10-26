import { useSyncExternalStore } from 'react'

/**
 * Upload availability: on by the `VITE_ENABLE_UPLOADS` flag, switched off for the session the
 * first time the API answers `501` (no storage provider configured).
 */
let unavailable = false
const listeners = new Set<() => void>()

export const uploadsState = {
  get enabledByFlag(): boolean {
    return import.meta.env.VITE_ENABLE_UPLOADS === 'true'
  },
  markUnavailable() {
    if (unavailable) return
    unavailable = true
    for (const listener of listeners) listener()
  },
  reset() {
    unavailable = false
    for (const listener of listeners) listener()
  },
  get available(): boolean {
    return uploadsState.enabledByFlag && !unavailable
  },
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useUploadsAvailable(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => uploadsState.available,
    () => uploadsState.available,
  )
}
