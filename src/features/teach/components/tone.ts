/**
 * The workspace's status colours (the mobile app's): each tone has a strong colour for text and
 * icons and a soft surface under them, all from the tokens in `src/index.css`.
 */
export type Tone =
  | 'upcoming'
  | 'held'
  | 'canceled'
  | 'late'
  | 'unpaid'
  | 'paid'
  | 'credits'
  | 'warning'
  | 'danger'
  | 'success'
  | 'accent'
  | 'neutral'

export const TONE_TEXT: Record<Tone, string> = {
  upcoming: 'text-upcoming',
  held: 'text-held',
  canceled: 'text-canceled',
  late: 'text-late',
  unpaid: 'text-unpaid',
  paid: 'text-paid',
  credits: 'text-credits',
  warning: 'text-warning',
  danger: 'text-danger',
  success: 'text-success',
  accent: 'text-accent-foreground',
  neutral: 'text-muted-foreground',
}

export const TONE_SOFT: Record<Tone, string> = {
  upcoming: 'bg-upcoming-soft',
  held: 'bg-held-soft',
  canceled: 'bg-canceled-soft',
  late: 'bg-late-soft',
  unpaid: 'bg-unpaid-soft',
  paid: 'bg-paid-soft',
  credits: 'bg-credits-soft',
  warning: 'bg-warning-soft',
  danger: 'bg-danger-soft',
  success: 'bg-success-soft',
  accent: 'bg-accent',
  neutral: 'bg-muted',
}

export const TONE_SOLID: Record<Tone, string> = {
  upcoming: 'bg-upcoming',
  held: 'bg-held',
  canceled: 'bg-canceled',
  late: 'bg-late',
  unpaid: 'bg-unpaid',
  paid: 'bg-paid',
  credits: 'bg-credits',
  warning: 'bg-warning',
  danger: 'bg-danger',
  success: 'bg-success',
  accent: 'bg-primary',
  neutral: 'bg-muted-foreground',
}

/** A left border in the tone's colour (calendar blocks, agenda rows). */
export const TONE_BORDER: Record<Tone, string> = {
  upcoming: 'border-upcoming',
  held: 'border-held',
  canceled: 'border-canceled',
  late: 'border-late',
  unpaid: 'border-unpaid',
  paid: 'border-paid',
  credits: 'border-credits',
  warning: 'border-warning',
  danger: 'border-danger',
  success: 'border-success',
  accent: 'border-primary',
  neutral: 'border-muted-foreground',
}
