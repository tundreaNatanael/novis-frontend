import { NotebookPen } from 'lucide-react'
import { useT } from '../i18n/use-i18n'
import { IconBadge } from './icon-badge'
import { TeachCard } from './section'

/** The teacher's short note after a lesson. */
export function JournalBlock({ journal }: { journal: string | null }) {
  const t = useT()
  const text = journal?.trim()
  return (
    <TeachCard className={text ? undefined : 'bg-muted/40'}>
      <div className="flex items-center gap-2">
        <IconBadge icon={NotebookPen} size="sm" />
        <h3 className="font-semibold text-foreground">{t('lesson.journal')}</h3>
      </div>
      {text ? (
        <p className="mt-3 whitespace-pre-wrap text-sm text-foreground">{text}</p>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">{t('lesson.noJournal')}</p>
      )}
    </TeachCard>
  )
}
