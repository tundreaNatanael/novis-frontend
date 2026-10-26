import type { en } from './en'

/** A plural entry: picked by `count` (`zero` when given and the count is 0, `one` for 1, else `other`). */
export interface Plural {
  zero?: string
  one: string
  other: string
}

type Shape<T> = {
  [K in keyof T]: T[K] extends string
    ? string
    : T[K] extends { one: string; other: string }
      ? Plural
      : Shape<T[K]>
}

/** What every language file must hold: the keys of `en.ts`, each a string or a plural. */
export type TranslationShape = Shape<typeof en>

type Keys<T, Prefix extends string = ''> = {
  [K in keyof T & string]: T[K] extends string
    ? `${Prefix}${K}`
    : T[K] extends { one: string; other: string }
      ? `${Prefix}${K}`
      : Keys<T[K], `${Prefix}${K}.`>
}[keyof T & string]

/** Every dotted key of the dictionary (`teacher.today.title`). */
export type TranslationKey = Keys<typeof en>

export type Locale = 'en' | 'ro'

export type TranslateParams = Record<string, string | number>

export type Translator = (key: TranslationKey, params?: TranslateParams) => string
