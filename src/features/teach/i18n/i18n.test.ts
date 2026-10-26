import { describe, expect, it } from 'vitest'
import { en } from './en'
import { ro } from './ro'
import { interpolate, localeFromLanguage, translate } from './translate'

function leaves(node: unknown, prefix = ''): string[] {
  if (!node || typeof node !== 'object') return [prefix]
  if ('other' in node) return [prefix]
  return Object.entries(node).flatMap(([key, value]) =>
    leaves(value, prefix ? `${prefix}.${key}` : key),
  )
}

describe('teacher workspace translations', () => {
  it('has the same keys in English and Romanian', () => {
    expect(leaves(ro).sort()).toEqual(leaves(en).sort())
  })

  it('interpolates parameters and keeps unknown ones visible', () => {
    expect(interpolate('Hello, %{name}', { name: 'Ana' })).toBe('Hello, Ana')
    expect(interpolate('%{a} and %{b}', { a: 1 })).toBe('1 and %{b}')
  })

  it('picks plural forms by count, zero included', () => {
    expect(translate('en', 'teacher.students.count', { count: 0 })).toBe('No students')
    expect(translate('en', 'teacher.students.count', { count: 1 })).toBe('1 student')
    expect(translate('en', 'teacher.students.count', { count: 3 })).toBe('3 students')
    expect(translate('ro', 'teacher.payments.lessons', { count: 2 })).toBe('2 lecții')
    expect(translate('ro', 'teacher.payments.lessons', { count: 1 })).toBe('1 lecție')
  })

  it('falls back to English and then to the key', () => {
    expect(translate('ro', 'common.ok')).toBe('OK')
    // A key that no dictionary holds comes back as itself.
    expect(translate('en', 'teacher.today.nothing' as never)).toBe('teacher.today.nothing')
  })

  it('reads the browser language', () => {
    expect(localeFromLanguage('ro-RO')).toBe('ro')
    expect(localeFromLanguage('en-US')).toBe('en')
    expect(localeFromLanguage(undefined)).toBe('en')
  })
})
