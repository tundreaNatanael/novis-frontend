import { useContext } from 'react'
import { TeachI18nContext, type TeachI18n } from './context'
import type { Translator } from './types'

export function useI18n(): TeachI18n {
  const context = useContext(TeachI18nContext)
  if (!context) throw new Error('useI18n must be used inside <TeachI18nProvider>')
  return context
}

/** The translator of the active language. */
export function useT(): Translator {
  return useI18n().t
}
