import { describe, expect, it } from 'vitest'
import { meetingLinkChange } from './utils'

const link = 'https://meet.example.com/ana'
const none = { whatsapp: false, meetingUrl: null }

describe('meetingLinkChange (D-058)', () => {
  it('turns a WhatsApp call on once', () => {
    expect(meetingLinkChange(none, { whatsapp: true, meetingUrl: '' })).toEqual({
      kind: 'whatsapp',
    })
    expect(
      meetingLinkChange(
        { whatsapp: false, meetingUrl: link },
        { whatsapp: true, meetingUrl: link },
      ),
    ).toEqual({ kind: 'whatsapp' })
    expect(
      meetingLinkChange(
        { whatsapp: true, meetingUrl: 'https://wa.me/40712345678' },
        { whatsapp: true, meetingUrl: '' },
      ),
    ).toEqual({ kind: 'none' })
  })

  it('sets a link only when it changed', () => {
    expect(meetingLinkChange(none, { whatsapp: false, meetingUrl: ` ${link} ` })).toEqual({
      kind: 'link',
      meetingUrl: link,
    })
    expect(
      meetingLinkChange(
        { whatsapp: false, meetingUrl: link },
        { whatsapp: false, meetingUrl: link },
      ),
    ).toEqual({ kind: 'none' })
    expect(meetingLinkChange(none, { whatsapp: false, meetingUrl: '' })).toEqual({ kind: 'none' })
  })

  it('removes the link when emptied, or when a WhatsApp call is switched off with no link', () => {
    expect(
      meetingLinkChange({ whatsapp: false, meetingUrl: link }, { whatsapp: false, meetingUrl: '' }),
    ).toEqual({ kind: 'remove' })
    expect(
      meetingLinkChange({ whatsapp: true, meetingUrl: null }, { whatsapp: false, meetingUrl: '' }),
    ).toEqual({ kind: 'remove' })
    expect(
      meetingLinkChange(
        { whatsapp: true, meetingUrl: 'https://wa.me/40712345678' },
        { whatsapp: false, meetingUrl: 'https://wa.me/40712345678' },
      ),
    ).toEqual({ kind: 'link', meetingUrl: 'https://wa.me/40712345678' })
  })
})
