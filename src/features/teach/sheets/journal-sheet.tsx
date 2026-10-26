import { Loader2, NotebookPen } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import type { Lesson } from '@/api/types'
import { Field } from '@/components/form/field'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ErrorState, SkeletonCard } from '../components/states'
import { TeachSheet } from '../components/teach-sheet'
import { useLesson } from '../data/lessons'
import { useUpdateJournal } from '../data/mutations'
import { useT } from '../i18n/use-i18n'
import { describeError } from '../lib/error-message'
import { makeSchemas } from '../lib/schemas'

export function JournalSheet({
  lessonId,
  open,
  onOpenChange,
}: {
  lessonId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = useT()
  const query = useLesson(lessonId)
  const lesson = query.data?.lesson
  if (!lesson) {
    return (
      <TeachSheet open={open} onOpenChange={onOpenChange} title={t('teacher.journal.title')}>
        {query.isError ? (
          <ErrorState compact error={query.error} onRetry={() => void query.refetch()} />
        ) : (
          <SkeletonCard lines={3} />
        )}
      </TeachSheet>
    )
  }
  return <JournalForm key={lesson.id} lesson={lesson} open={open} onOpenChange={onOpenChange} />
}

/** Mounted only once the lesson is loaded, so the initial text comes straight from it. */
function JournalForm({
  lesson,
  open,
  onOpenChange,
}: {
  lesson: Lesson
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = useT()
  const schemas = useMemo(() => makeSchemas(t), [t])
  const update = useUpdateJournal()
  const [journal, setJournal] = useState(lesson.journal ?? '')
  const [error, setError] = useState<string | undefined>()

  const save = async () => {
    const parsed = schemas.longText().safeParse(journal)
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message)
      return
    }
    try {
      await update.mutateAsync({ id: lesson.id, journal: parsed.data })
      toast.success(t('teacher.journal.saved'))
      onOpenChange(false)
    } catch (e) {
      toast.error(describeError(e, t))
    }
  }

  return (
    <TeachSheet
      open={open}
      onOpenChange={onOpenChange}
      title={t('teacher.journal.title')}
      onSubmit={() => void save()}
      footer={
        <Button
          type="submit"
          size="lg"
          className="w-full rounded-full sm:w-auto"
          disabled={update.isPending}
        >
          {update.isPending ? (
            <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden />
          ) : (
            <NotebookPen aria-hidden />
          )}
          {t('teacher.journal.submit')}
        </Button>
      }
    >
      <Field label={t('lesson.journal')} error={error}>
        {(a11y) => (
          <Textarea
            {...a11y}
            rows={8}
            autoFocus
            placeholder={t('teacher.journal.placeholder')}
            value={journal}
            onChange={(event) => setJournal(event.target.value)}
          />
        )}
      </Field>
    </TeachSheet>
  )
}
