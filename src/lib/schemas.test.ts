import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import {
  emailSchema,
  httpsUrlSchema,
  optionalHttpsUrl,
  passwordConfirmation,
  passwordSchema,
  prepaidCountSchema,
  slugSchema,
} from './schemas'

describe('schemas mirror API.md §1.7', () => {
  it('email: trimmed, valid, at most 320 characters', () => {
    expect(emailSchema.parse('  Ana@Test.io ')).toBe('Ana@Test.io')
    expect(emailSchema.safeParse('nope').success).toBe(false)
    expect(emailSchema.safeParse(`${'a'.repeat(316)}@x.io`).success).toBe(false)
  })

  it('password: 8 to 128 characters', () => {
    expect(passwordSchema.safeParse('short').success).toBe(false)
    expect(passwordSchema.safeParse('long enough').success).toBe(true)
    expect(passwordSchema.safeParse('x'.repeat(129)).success).toBe(false)
  })

  it('slug: lower-case letters, digits and single dashes, 2–100', () => {
    expect(slugSchema.safeParse('riverside-music').success).toBe(true)
    expect(slugSchema.safeParse('Riverside').success).toBe(false)
    expect(slugSchema.safeParse('a').success).toBe(false)
    expect(slugSchema.safeParse('double--dash').success).toBe(false)
  })

  it('links must be absolute https', () => {
    expect(httpsUrlSchema.safeParse('https://meet.example.com/room').success).toBe(true)
    expect(httpsUrlSchema.safeParse('http://meet.example.com').success).toBe(false)
    expect(httpsUrlSchema.safeParse('meet.example.com').success).toBe(false)
  })

  it('prepaid count: whole number 1–50', () => {
    expect(prepaidCountSchema.parse('10')).toBe(10)
    expect(prepaidCountSchema.safeParse(0).success).toBe(false)
    expect(prepaidCountSchema.safeParse(51).success).toBe(false)
    expect(prepaidCountSchema.safeParse(2.5).success).toBe(false)
  })

  it('optionalHttpsUrl accepts empty and valid https links only', () => {
    expect(optionalHttpsUrl.parse('')).toBe('')
    expect(optionalHttpsUrl.parse(' https://meet.example.com ')).toBe('https://meet.example.com')
    expect(optionalHttpsUrl.safeParse('ftp://x').success).toBe(false)
  })

  it('password confirmation points the error at the repeated field', () => {
    const schema = z
      .object({ ...passwordConfirmation.shape })
      .refine(passwordConfirmation.refine, passwordConfirmation.error)
    const result = schema.safeParse({ password: 'long enough', confirmPassword: 'different' })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.issues[0]?.path).toEqual(['confirmPassword'])
  })
})
