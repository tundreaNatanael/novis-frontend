import { z } from 'zod'
import type { Translator } from '../i18n/types'

/**
 * Zod building blocks mirroring API.md §1.7 with translated messages, so they are built per
 * render with the active translator (the mobile app's `makeSchemas`).
 */
export function makeSchemas(t: Translator) {
  const email = z
    .string()
    .trim()
    .min(1, t('validation.required'))
    .max(320, t('validation.tooLong', { max: 320 }))
    .pipe(z.email(t('validation.email')))

  const password = z
    .string()
    .min(8, t('validation.passwordLength'))
    .max(128, t('validation.passwordLength'))

  const name = z
    .string()
    .trim()
    .min(1, t('validation.required'))
    .max(200, t('validation.nameLength'))

  const longText = (max = 4000) => z.string().trim().max(max, t('validation.tooLong', { max }))

  const httpsUrl = z
    .string()
    .trim()
    .max(2048, t('validation.tooLong', { max: 2048 }))
    .refine(
      (value) => /^https:\/\/\S+$/i.test(value) && URL.canParse(value),
      t('validation.httpsUrl'),
    )

  const optionalHttpsUrl = z
    .string()
    .trim()
    .max(2048, t('validation.tooLong', { max: 2048 }))
    .refine(
      (value) => value.length === 0 || (/^https:\/\/\S+$/i.test(value) && URL.canParse(value)),
      t('validation.httpsUrl'),
    )

  const homeworkItem = z
    .string()
    .trim()
    .min(1, t('validation.itemEmpty'))
    .max(2000, t('validation.tooLong', { max: 2000 }))

  /** An optional title (homework): empty means none. */
  const optionalTitle = z
    .string()
    .trim()
    .max(200, t('validation.tooLong', { max: 200 }))

  /** A course's default lesson length typed in minutes: empty means none, else whole minutes 15–240. */
  const optionalLessonMinutes = z
    .string()
    .trim()
    .refine(
      (value) =>
        value.length === 0 || (/^\d+$/.test(value) && Number(value) >= 15 && Number(value) <= 240),
      t('validation.lessonLength'),
    )

  return {
    email,
    password,
    name,
    longText,
    httpsUrl,
    optionalHttpsUrl,
    homeworkItem,
    optionalTitle,
    optionalLessonMinutes,
  }
}

export type Schemas = ReturnType<typeof makeSchemas>

/** A trimmed string, `undefined` when blank (an optional request field left out). */
export function optionalText(value: string | undefined | null): string | undefined {
  const text = value?.trim() ?? ''
  return text.length > 0 ? text : undefined
}
