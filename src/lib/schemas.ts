import { z } from 'zod'

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

export const prepaidCountSchema = z.coerce
  .number()
  .int('Enter a whole number')
  .min(1, 'At least 1 lesson')
  .max(50, 'At most 50 lessons at a time')

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
