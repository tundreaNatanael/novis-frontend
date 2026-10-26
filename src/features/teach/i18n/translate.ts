import { en } from './en'
import { ro } from './ro'
import type { Locale, Plural, TranslateParams, TranslationKey, TranslationShape } from './types'

export const LOCALES: readonly Locale[] = ['en', 'ro']

/** The BCP-47 tag dates and numbers are formatted with. */
export const LOCALE_TAGS: Record<Locale, string> = { en: 'en-GB', ro: 'ro-RO' }

const dictionaries: Record<Locale, TranslationShape> = { en, ro }

export function isLocale(value: string | null | undefined): value is Locale {
  return value === 'en' || value === 'ro'
}

/** The locale a browser asks for: Romanian when its first language is, English otherwise. */
export function localeFromLanguage(language: string | undefined): Locale {
  return language?.toLowerCase().startsWith('ro') ? 'ro' : 'en'
}

function lookup(locale: Locale, key: string): string | Plural | undefined {
  let node: unknown = dictionaries[locale]
  for (const part of key.split('.')) {
    if (!node || typeof node !== 'object') return undefined
    node = (node as Record<string, unknown>)[part]
  }
  return typeof node === 'string' || (node && typeof node === 'object' && 'other' in node)
    ? (node as string | Plural)
    : undefined
}

function pick(entry: string | Plural, params: TranslateParams | undefined): string {
  if (typeof entry === 'string') return entry
  const count = Number(params?.count ?? 0)
  if (count === 0 && entry.zero !== undefined) return entry.zero
  return count === 1 ? entry.one : entry.other
}

/** `%{name}` → `params.name`; a missing parameter stays visible, so a wrong key is noticed. */
export function interpolate(text: string, params: TranslateParams | undefined): string {
  if (!params) return text
  return text.replace(/%\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  )
}

/** The string for `key` in `locale`, falling back to English, then to the key itself. */
export function translate(locale: Locale, key: TranslationKey, params?: TranslateParams): string {
  const entry = lookup(locale, key) ?? lookup('en', key)
  if (entry === undefined) return key
  return interpolate(pick(entry, params), params)
}
