/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the Novis API, no trailing slash. Defaults to http://localhost:8080. */
  readonly VITE_API_BASE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
