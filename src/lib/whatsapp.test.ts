import { describe, expect, it } from 'vitest'
import {
  isWhatsAppChatWith,
  isWhatsAppLink,
  isWhatsAppNumber,
  whatsAppChatUrl,
  whatsAppNumberChange,
} from './whatsapp'

describe('WhatsApp links (D-056)', () => {
  it('turns a number into a wa.me chat link with digits only', () => {
    expect(whatsAppChatUrl('+40712345678')).toBe('https://wa.me/40712345678')
    expect(whatsAppChatUrl('+40 (712) 345-678')).toBe('https://wa.me/40712345678')
  })

  it('accepts international numbers as the API does (API.md §1.7)', () => {
    expect(isWhatsAppNumber('+40 712 345 678')).toBe(true)
    expect(isWhatsAppNumber('+1 202-555-0143')).toBe(true)
    expect(isWhatsAppNumber('0712345678')).toBe(false)
    expect(isWhatsAppNumber('+0712345678')).toBe(false)
    expect(isWhatsAppNumber('+123456')).toBe(false)
    expect(isWhatsAppNumber('+1234567890123456')).toBe(false)
  })

  it('recognizes WhatsApp call and chat links among meeting links', () => {
    expect(isWhatsAppLink('https://call.whatsapp.com/video/AbC123')).toBe(true)
    expect(isWhatsAppLink('https://wa.me/40712345678')).toBe(true)
    expect(isWhatsAppLink('https://chat.whatsapp.com/Invite')).toBe(true)
    expect(isWhatsAppLink('https://meet.google.com/abc-defg-hij')).toBe(false)
    expect(isWhatsAppLink('https://notwhatsapp.com/x')).toBe(false)
    expect(isWhatsAppLink(null)).toBe(false)
    expect(isWhatsAppLink('not a link')).toBe(false)
  })

  it('tells the chat with a number apart from other WhatsApp links (D-058)', () => {
    expect(isWhatsAppChatWith('https://wa.me/40712345678', '+40712345678')).toBe(true)
    expect(isWhatsAppChatWith('https://wa.me/40712345678/', '+40 712 345 678')).toBe(true)
    expect(isWhatsAppChatWith('https://wa.me/40799999999', '+40712345678')).toBe(false)
    expect(isWhatsAppChatWith('https://call.whatsapp.com/video/x', '+40712345678')).toBe(false)
    expect(isWhatsAppChatWith('https://wa.me/40712345678', null)).toBe(false)
    expect(isWhatsAppChatWith(null, '+40712345678')).toBe(false)
  })

  it('sends the number only when it changed, null when it was emptied', () => {
    expect(whatsAppNumberChange('+40712345678', '+40712345678')).toEqual({})
    expect(whatsAppNumberChange('', null)).toEqual({})
    expect(whatsAppNumberChange(' +40 712 345 678 ', null)).toEqual({
      whatsappNumber: '+40 712 345 678',
    })
    expect(whatsAppNumberChange('', '+40712345678')).toEqual({ whatsappNumber: null })
  })
})
