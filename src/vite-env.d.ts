/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the Novis API, no trailing slash. Defaults to http://localhost:8080. */
  readonly VITE_API_BASE_URL?: string
  /**
   * `true` shows "Upload a file" on the teacher workspace's Attach material sheet. Keep it unset
   * until the backend has a storage provider (`STORAGE_PROVIDER=r2`); a `501` hides it anyway.
   */
  readonly VITE_ENABLE_UPLOADS?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
