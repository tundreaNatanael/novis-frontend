import { createContext } from 'react'
import type { Locale, Translator } from './types'

export interface TeachI18n {
  locale: Locale
  /** The BCP-47 tag for `Intl` formatting. */
  localeTag: string
  setLocale: (locale: Locale) => void
  t: Translator
}

export const TeachI18nContext = createContext<TeachI18n | null>(null)
