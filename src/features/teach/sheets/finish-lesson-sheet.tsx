import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Link2,
  Loader2,
  X,
  XCircle,
  type LucideIcon,
} from 'lucide-react'
import { useId, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import type { CloseLessonRequest, LessonOutcome, MaterialType } from '@/api/types'
import { Field } from '@/components/form/field'
import { SelectField } from '@/components/form/select-field'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { TeachConfirmDialog } from '../components/confirm-dialog'
import { ErrorState, SkeletonCard } from '../components/states'
import { TeachSheet } from '../components/teach-sheet'
import { TONE_SOFT, TONE_SOLID, TONE_TEXT, type Tone } from '../components/tone'
import { useLesson, useLessonLookups } from '../data/lessons'
import { useAddMaterialLink, useCloseLesson } from '../data/mutations'
import { useT } from '../i18n/use-i18n'
import { describeError } from '../lib/error-message'
import { makeSchemas } from '../lib/schemas'
import { useFormatters } from '../lib/use-formatters'
import { MATERIAL_TYPES, materialTypeShortKey } from '../materials/utils'
import { useTeachSheets } from './use-teach-sheets'

type LinkDraft = { title: string; type: MaterialType; url: string }

/**
 * The hero teacher flow: pick an outcome, write the journal, attach links, one submit.
 * `POST /lessons/{id}/close` then `POST /materials` per link. A held or late lesson then offers
 * to assign homework, which is its own sheet (`POST /homework` with the lesson).
 */
export function FinishLessonSheet({
  lessonId,
  open,
  onOpenChange,
}: {
  lessonId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = useT()
  const fmt = useFormatters()
  const sheets = useTeachSheets()
  const schemas = useMemo(() => makeSchemas(t), [t])
  const query = useLesson(lessonId)
  const { studentName, courseTitle } = useLessonLookups()
  const close = useCloseLesson()
  const addLink = useAddMaterialLink()
  const typeFieldId = useId()

  const [status, setStatus] = useState<LessonOutcome | null>(null)
  const [journal, setJournal] = useState('')
  const [links, setLinks] = useState<LinkDraft[]>([])
  const [draft, setDraft] = useState<LinkDraft | null>(null)
  const [draftError, setDraftError] = useState<{ title?: string; url?: string }>({})
  const [journalError, setJournalError] = useState<string | undefined>()
  const [submitting, setSubmitting] = useState(false)
  const [askHomework, setAskHomework] = useState<{ studentId: string; lessonId: string } | null>(
    null,
  )
  // Once the Assign homework sheet took over, closing the question must not close it too.
  const handedOver = useRef(false)

  const lesson = query.data?.lesson
  const charged = status === 'PRESENT' || status === 'CANCELED_LATE'

  const commitDraft = () => {
    if (!draft) return
    const title = schemas.name.safeParse(draft.title)
    const url = schemas.httpsUrl.safeParse(draft.url)
    const next: { title?: string; url?: string } = {}
    if (!title.success) next.title = title.error.issues[0]?.message
    if (!url.success) next.url = url.error.issues[0]?.message
    setDraftError(next)
    if (!title.success || !url.success) return
    setLinks((list) => [...list, { title: title.data, type: draft.type, url: url.data }])
    setDraft(null)
    setDraftError({})
  }

  const submit = async () => {
    if (!lesson || !status) return
    if (charged) {
      const check = schemas.longText().safeParse(journal)
      if (!check.success) {
        setJournalError(check.error.issues[0]?.message)
        return
      }
    }
    setJournalError(undefined)
    const body: CloseLessonRequest = { status }
    if (charged && journal.trim().length > 0) body.journal = journal.trim()

    setSubmitting(true)
    try {
      const result = await close.mutateAsync({ id: lesson.id, body })
      let failed = 0
      if (charged) {
        for (const link of links) {
          try {
            await addLink.mutateAsync({
              title: link.title,
              type: link.type,
              externalUrl: link.url,
              lessonId: lesson.id,
            })
          } catch {
            failed += 1
          }
        }
      }
      if (failed > 0) toast.error(t('teacher.finish.materialsFailed', { count: failed }))
      else toast.success(t('teacher.finish.done'))
      if (status === 'CANCELED' && result.rolledOverToLessonId) {
        toast.info(t('teacher.finish.creditReturnedTitle'), {
          description: t('teacher.finish.creditReturnedBody'),
        })
        onOpenChange(false)
      } else if (charged) {
        // Homework is no longer part of closing: offer it right away, with this lesson.
        setAskHomework({ studentId: lesson.studentId, lessonId: lesson.id })
      } else {
        onOpenChange(false)
      }
    } catch (error) {
      toast.error(describeError(error, t))
    } finally {
      setSubmitting(false)
    }
  }

  const date = lesson?.scheduledAt ? new Date(lesson.scheduledAt) : null
  const subtitle = lesson
    ? [
        studentName(lesson.studentId),
        date ? fmt.whenShort(date) : null,
        courseTitle(lesson.courseId),
      ]
        .filter(Boolean)
        .join(' · ')
    : undefined

  return (
    <>
      <TeachSheet
        open={open && !askHomework}
        onOpenChange={onOpenChange}
        title={t('teacher.finish.title')}
        subtitle={subtitle}
        onSubmit={() => void submit()}
        footer={
          <Button
            type="submit"
            size="lg"
            className="w-full rounded-full sm:w-auto"
            disabled={!status || !lesson || submitting}
          >
            {submitting ? (
              <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden />
            ) : (
              <Check aria-hidden />
            )}
            {submitting ? t('teacher.finish.submitting') : t('teacher.finish.submit')}
          </Button>
        }
      >
        {query.isPending ? (
          <SkeletonCard lines={3} />
        ) : query.isError ? (
          <ErrorState compact error={query.error} onRetry={() => void query.refetch()} />
        ) : (
          <>
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-2 text-base font-semibold text-foreground">
                {t('teacher.finish.chooseStatus')}
              </legend>
              <StatusChoice
                icon={CheckCircle2}
                tone="held"
                title={t('teacher.finish.present')}
                hint={t('teacher.finish.presentHint')}
                selected={status === 'PRESENT'}
                onSelect={() => setStatus('PRESENT')}
              />
              <StatusChoice
                icon={XCircle}
                tone="canceled"
                title={t('teacher.finish.canceled')}
                hint={t('teacher.finish.canceledHint')}
                selected={status === 'CANCELED'}
                onSelect={() => setStatus('CANCELED')}
              />
              <StatusChoice
                icon={AlertTriangle}
                tone="late"
                title={t('teacher.finish.canceledLate')}
                hint={t('teacher.finish.canceledLateHint')}
                selected={status === 'CANCELED_LATE'}
                onSelect={() => setStatus('CANCELED_LATE')}
              />
            </fieldset>

            {charged ? (
              <>
                <Field label={t('teacher.finish.journal')} error={journalError}>
                  {(a11y) => (
                    <Textarea
                      {...a11y}
                      rows={4}
                      placeholder={t('teacher.finish.journalPlaceholder')}
                      value={journal}
                      onChange={(event) => setJournal(event.target.value)}
                    />
                  )}
                </Field>
                <div className="flex flex-col gap-2">
                  <p className="text-sm font-medium text-muted-foreground">
                    {t('teacher.finish.materials')}
                  </p>
                  {links.map((link, index) => (
                    <div
                      key={`${link.url}-${index}`}
                      className="flex items-center gap-2 rounded-xl bg-muted/60 px-3 py-2"
                    >
                      <Link2 className="size-4 shrink-0 text-accent-foreground" aria-hidden />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{link.title}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {t(materialTypeShortKey[link.type])} · {link.url}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`${t('common.remove')}: ${link.title}`}
                        onClick={() => setLinks((list) => list.filter((_, i) => i !== index))}
                      >
                        <X aria-hidden />
                      </Button>
                    </div>
                  ))}
                  {draft ? (
                    <div className="flex flex-col gap-3 rounded-xl border border-border p-3">
                      <Field label={t('teacher.material.titleLabel')} error={draftError.title}>
                        {(a11y) => (
                          <Input
                            {...a11y}
                            placeholder={t('teacher.material.titlePlaceholder')}
                            value={draft.title}
                            onChange={(event) => setDraft({ ...draft, title: event.target.value })}
                          />
                        )}
                      </Field>
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor={typeFieldId}>{t('teacher.material.type')}</Label>
                        <SelectField
                          id={typeFieldId}
                          value={draft.type}
                          onChange={(type) => setDraft({ ...draft, type: type as MaterialType })}
                          placeholder={t('teacher.material.type')}
                          options={MATERIAL_TYPES.map((type) => ({
                            value: type,
                            label: t(materialTypeShortKey[type]),
                          }))}
                        />
                      </div>
                      <Field label={t('teacher.material.link')} error={draftError.url}>
                        {(a11y) => (
                          <Input
                            {...a11y}
                            type="url"
                            inputMode="url"
                            placeholder={t('teacher.material.linkPlaceholder')}
                            value={draft.url}
                            onChange={(event) => setDraft({ ...draft, url: event.target.value })}
                          />
                        )}
                      </Field>
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="rounded-full"
                          onClick={() => setDraft(null)}
                        >
                          {t('common.cancel')}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          className="rounded-full"
                          onClick={commitDraft}
                        >
                          {t('teacher.material.submit')}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="w-fit rounded-full"
                      onClick={() => setDraft({ title: '', type: 'LINK', url: '' })}
                    >
                      <Link2 aria-hidden />
                      {t('teacher.finish.addLink')}
                    </Button>
                  )}
                </div>
              </>
            ) : null}
          </>
        )}
      </TeachSheet>
      <TeachConfirmDialog
        open={askHomework !== null}
        onOpenChange={(next) => {
          if (!next) {
            setAskHomework(null)
            if (!handedOver.current) onOpenChange(false)
          }
        }}
        title={t('teacher.finish.assignTitle')}
        body={<p>{t('teacher.finish.assignBody')}</p>}
        confirmLabel={t('teacher.finish.assignAction')}
        cancelLabel={t('common.notNow')}
        onConfirm={() => {
          if (!askHomework) return
          handedOver.current = true
          sheets.open({ kind: 'homework', ...askHomework })
        }}
      />
    </>
  )
}

function StatusChoice({
  icon: Icon,
  tone,
  title,
  hint,
  selected,
  onSelect,
}: {
  icon: LucideIcon
  tone: Tone
  title: string
  hint: string
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={`${title}. ${hint}`}
      onClick={onSelect}
      className={cn(
        'flex min-h-16 items-center gap-3 rounded-xl border-2 p-3 text-left transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
        selected
          ? cn('border-current', TONE_SOFT[tone], TONE_TEXT[tone])
          : 'border-transparent bg-muted/60 hover:bg-muted',
      )}
    >
      <span
        className={cn(
          'inline-flex size-10 shrink-0 items-center justify-center rounded-full',
          selected
            ? cn(TONE_SOLID[tone], 'text-primary-foreground')
            : cn(TONE_SOFT[tone], TONE_TEXT[tone]),
        )}
      >
        <Icon className="size-5" aria-hidden />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="font-semibold text-foreground">{title}</span>
        <span className="text-xs text-muted-foreground">{hint}</span>
      </span>
      {selected ? <CheckCircle2 className="size-5 shrink-0" aria-hidden /> : null}
    </button>
  )
}
