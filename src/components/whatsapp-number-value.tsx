import { whatsAppChatUrl } from '@/lib/whatsapp'

/** A teacher's WhatsApp number as a chat link (`wa.me`, D-056), or a dash when none is shared. */
export function WhatsAppNumberValue({ number }: { number: string | null }) {
  if (!number) return <span className="text-muted-foreground">—</span>
  return (
    <a
      href={whatsAppChatUrl(number)}
      target="_blank"
      rel="noreferrer"
      className="text-primary tabular-nums underline-offset-4 hover:underline"
    >
      {number}
    </a>
  )
}
