import { ChevronRight, Flag } from 'lucide-react'
import { Link } from 'react-router'
import { useT } from '../i18n/use-i18n'

/** "To finish (N)": jumps to the oldest lesson left to finish in the calendar. Shown only while N > 0. */
export function ToFinishBanner({ count, to }: { count: number; to: string }) {
  const t = useT()
  return (
    <Link
      to={to}
      aria-label={t('teacher.calendar.toFinishLabel', { count })}
      title={t('teacher.calendar.toFinishHint')}
      className="flex min-h-11 items-center gap-2 rounded-xl bg-warning-soft px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-warning-soft/80 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      <Flag className="size-4 text-warning" aria-hidden />
      <span className="flex-1 truncate">{t('teacher.calendar.toFinish', { count })}</span>
      <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
    </Link>
  )
}
