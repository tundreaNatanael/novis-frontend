/**
 * WhatsApp links (D-056). A teacher's number (E.164, `User.whatsappNumber`) opens a chat:
 * `https://wa.me/<digits>` hands over to the WhatsApp app on a phone and to WhatsApp Desktop / Web
 * on a computer. A lesson's meeting link may itself be a WhatsApp call or chat link; its Join button
 * then says so. A pair set to "WhatsApp call" (D-058) gets the chat with the teacher's number as its
 * link, so the teacher's own Join opens WhatsApp instead of a chat with themself.
 */

/** Spaces, dashes, dots and parentheses are dropped, as the API does (API.md §1.7). */
const SEPARATORS = /[\s\-.()]/g
const E164 = /^\+[1-9]\d{6,14}$/

/** The chat link for a number, e.g. `+40 712 345 678` → `https://wa.me/40712345678`. */
export function whatsAppChatUrl(number: string): string {
  return `https://wa.me/${number.replace(/\D/g, '')}`
}

/**
 * The WhatsApp app on this computer (WhatsApp Desktop registers `whatsapp:`): what the teacher's Join
 * opens for a WhatsApp call on their own number.
 */
export const WHATSAPP_APP_URL = 'whatsapp://'

/** Whether the link is the chat with that number (`https://wa.me/<its digits>`). */
export function isWhatsAppChatWith(
  url: string | null | undefined,
  number: string | null | undefined,
): boolean {
  if (!url || !number || !URL.canParse(url)) return false
  const parsed = new URL(url)
  return (
    parsed.hostname.toLowerCase() === 'wa.me' &&
    parsed.pathname.replace(/\/$/, '') === `/${number.replace(/\D/g, '')}`
  )
}

/** Whether the typed number is international (`+`, the country code, 7–15 digits in all). */
export function isWhatsAppNumber(value: string): boolean {
  return E164.test(value.replace(SEPARATORS, ''))
}

const WHATSAPP_HOSTS = new Set([
  'wa.me',
  'call.whatsapp.com',
  'chat.whatsapp.com',
  'api.whatsapp.com',
  'whatsapp.com',
  'www.whatsapp.com',
])

/** A meeting link that opens WhatsApp (a call link from WhatsApp → Calls, a group or chat link). */
export function isWhatsAppLink(url: string | null | undefined): boolean {
  if (!url || !URL.canParse(url)) return false
  return WHATSAPP_HOSTS.has(new URL(url).hostname.toLowerCase())
}

/**
 * The `whatsappNumber` of a `PATCH` body from the form value: left out when unchanged, `null` when
 * emptied (the API removes it), else the typed number (the API drops the separators).
 */
export function whatsAppNumberChange(
  value: string,
  current: string | null,
): { whatsappNumber?: string | null } {
  const typed = value.trim()
  if (typed === (current ?? '')) return {}
  return { whatsappNumber: typed === '' ? null : typed }
}
