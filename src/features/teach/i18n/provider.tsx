import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { TeachI18nContext, type TeachI18n } from './context'
import { isLocale, LOCALE_TAGS, localeFromLanguage, translate } from './translate'
import type { Locale, TranslateParams, TranslationKey } from './types'

export const LOCALE_STORAGE_KEY = 'novis-teach.locale'

function readLocale(): Locale {
  try {
    const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY)
    if (isLocale(stored)) return stored
  } catch {
    // Storage unavailable: follow the browser's language.
  }
  return localeFromLanguage(navigator.language)
}

/**
 * The teacher workspace's language (D-051): English or Romanian, remembered per browser, the
 * browser's language by default. The admin console stays English; this provider lives under
 * `/teach` only.
 */
export function TeachI18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(readLocale)

  useEffect(() => {
    const previous = document.documentElement.lang
    document.documentElement.lang = locale
    return () => {
      document.documentElement.lang = previous
    }
  }, [locale])

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next)
    try {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, next)
    } catch {
      // The choice lasts for this tab only.
    }
  }, [])

  const value = useMemo<TeachI18n>(
    () => ({
      locale,
      localeTag: LOCALE_TAGS[locale],
      setLocale,
      t: (key: TranslationKey, params?: TranslateParams) => translate(locale, key, params),
    }),
    [locale, setLocale],
  )

  return <TeachI18nContext.Provider value={value}>{children}</TeachI18nContext.Provider>
}
