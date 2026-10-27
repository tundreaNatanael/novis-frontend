import { z } from 'zod'
import { isWhatsAppNumber } from './whatsapp'

/** Field rules mirroring the backend (API.md §1.7). Server `fieldErrors` still win. */
export const emailSchema = z
  .string()
  .trim()
  .min(1, 'Enter an email address')
  .max(320, 'Email addresses are at most 320 characters')
  .pipe(z.email('Enter a valid email address'))

export const passwordSchema = z
  .string()
  .min(8, 'Passwords need at least 8 characters')
  .max(128, 'Passwords are at most 128 characters')

export const nameSchema = z
  .string()
  .trim()
  .min(1, 'Enter a name')
  .max(200, 'Names are at most 200 characters')

export const titleSchema = z
  .string()
  .trim()
  .min(1, 'Enter a title')
  .max(200, 'Titles are at most 200 characters')

export const longTextSchema = z.string().trim().max(4000, 'At most 4000 characters')

/** An optional title: empty means none. */
export const optionalTitleSchema = z.string().trim().max(200, 'Titles are at most 200 characters')

/**
 * A homework checklist being typed: 1–100 lines of up to 2000 characters; blank lines are dropped.
 * A line being edited carries the `itemId` and `done` it was loaded with (not `id`: that name is
 * `useFieldArray`'s own key).
 */
export const checklistSchema = z
  .array(
    z.object({
      text: z.string().trim().max(2000, 'At most 2000 characters'),
      itemId: z.string().optional(),
      done: z.boolean().optional(),
    }),
  )
  .max(100, 'At most 100 items')
  .refine((items) => items.some((item) => item.text.trim().length > 0), {
    message: 'Add at least one checklist item',
  })

export const slugSchema = z
  .string()
  .trim()
  .min(2, 'Slugs need at least 2 characters')
  .max(100, 'Slugs are at most 100 characters')
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Lower-case letters, digits and single dashes only')

export const httpsUrlSchema = z
  .string()
  .trim()
  .max(2048, 'Links are at most 2048 characters')
  .refine((value) => /^https:\/\/\S+$/.test(value) && URL.canParse(value), {
    message: 'Enter an absolute https:// link',
  })

/** An optional https link: empty means "not set"; anything else must be an absolute https:// URL. */
export const optionalHttpsUrl = z
  .string()
  .trim()
  .max(2048, 'Links are at most 2048 characters')
  .refine((value) => value === '' || (/^https:\/\/\S+$/.test(value) && URL.canParse(value)), {
    message: 'Enter an absolute https:// link',
  })

/**
 * A teacher's WhatsApp number being typed: empty means none; otherwise an international number
 * (`+`, the country code and the number; spaces, dashes, dots and parentheses allowed).
 */
export const optionalWhatsAppNumber = z
  .string()
  .trim()
  .max(32, 'Numbers are at most 32 characters')
  .refine((value) => value === '' || isWhatsAppNumber(value), {
    message: 'Enter the number with + and the country code, e.g. +40 712 345 678',
  })

export const prepaidCountSchema = z.coerce
  .number()
  .int('Enter a whole number')
  .min(1, 'At least 1 lesson')
  .max(50, 'At most 50 lessons at a time')

/** A lesson's length in whole minutes (API.md §1.7: 15–240). */
export const lessonDurationSchema = z.coerce
  .number('Enter the length in minutes')
  .int('Enter whole minutes')
  .min(15, 'At least 15 minutes')
  .max(240, 'At most 240 minutes')

/** A course's default lesson length being typed: empty means none (lessons then last 60 minutes). */
export const optionalLessonDurationSchema = z
  .string()
  .trim()
  .refine((value) => value === '' || /^\d+$/.test(value), { message: 'Enter whole minutes' })
  .transform((value) => (value === '' ? null : Number(value)))
  .refine((value) => value === null || (value >= 15 && value <= 240), {
    message: 'Between 15 and 240 minutes',
  })

export const uuidSchema = z.uuid('Choose an option')

/**
 * A password typed twice: spread `shape` into the object and add the refinement.
 * `z.object({ ...passwordConfirmation.shape }).refine(passwordConfirmation.refine, passwordConfirmation.error)`
 */
export const passwordConfirmation = {
  shape: { password: passwordSchema, confirmPassword: z.string() },
  refine: (data: { password: string; confirmPassword: string }) =>
    data.password === data.confirmPassword,
  error: { message: 'The passwords do not match', path: ['confirmPassword'] },
}
