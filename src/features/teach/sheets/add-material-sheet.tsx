import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, Paperclip, Upload } from 'lucide-react'
import { useId, useMemo, useRef, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import type { MaterialType } from '@/api/types'
import { Field } from '@/components/form/field'
import { SelectField } from '@/components/form/select-field'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { TeachConfirmDialog } from '../components/confirm-dialog'
import { TeachSheet } from '../components/teach-sheet'
import { UploadProgress } from '../components/upload-progress'
import { useAddMaterialLink } from '../data/mutations'
import { useT } from '../i18n/use-i18n'
import { describeError } from '../lib/error-message'
import { applyFieldErrors } from '../lib/form'
import { makeSchemas } from '../lib/schemas'
import { useUploadsAvailable } from '../materials/uploads-state'
import { describeUploadError, useUploadMaterial } from '../materials/use-upload-material'
import { MATERIAL_TYPES, materialTypeLabelKey, UPLOAD_ACCEPT } from '../materials/utils'

/**
 * Attach a link, or (behind `VITE_ENABLE_UPLOADS`, hidden after a `501`) upload a file. While an
 * upload runs the sheet shows its progress with Cancel and cannot be dismissed; closing it asks
 * first and cancels the upload. An upload that ends with the sheet still open (cancelled, failed,
 * unavailable) says so inside the sheet until the next upload starts.
 */
export function AddMaterialSheet({
  courseId,
  lessonId,
  open,
  onOpenChange,
}: {
  courseId?: string
  lessonId?: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = useT()
  const add = useAddMaterialLink()
  const uploadsAvailable = useUploadsAvailable()
  const { upload, cancel, phase, progress } = useUploadMaterial()
  const busy = phase !== null
  const fileInput = useRef<HTMLInputElement>(null)
  const closeAfterCancel = useRef(false)
  const [notice, setNotice] = useState<{ tone: 'info' | 'error'; message: string } | null>(null)
  const [askStop, setAskStop] = useState(false)
  const typeFieldId = useId()

  const schema = useMemo(() => {
    const s = makeSchemas(t)
    return z.object({
      title: s.name,
      type: z.enum(['PDF', 'IMAGE', 'MUSICXML', 'VIDEO', 'LINK']),
      externalUrl: s.httpsUrl,
    })
  }, [t])
  type FormValues = z.infer<typeof schema>
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { title: '', type: 'LINK', externalUrl: '' },
  })

  const submit = form.handleSubmit(async (values) => {
    try {
      await add.mutateAsync({ ...values, courseId, lessonId })
      toast.success(t('teacher.material.added'))
      onOpenChange(false)
    } catch (error) {
      if (!applyFieldErrors(error, form.setError, ['title', 'type', 'externalUrl'])) {
        toast.error(describeError(error, t))
      }
    }
  })

  const runUpload = async (file: File) => {
    closeAfterCancel.current = false
    setNotice(null)
    try {
      const result = await upload(file, { courseId, lessonId, title: form.getValues('title') })
      switch (result.status) {
        case 'uploaded':
          toast.success(t('teacher.material.fileUploaded'))
          onOpenChange(false)
          return
        case 'canceled':
          if (closeAfterCancel.current) {
            toast.info(t('teacher.material.uploadCanceled'))
            onOpenChange(false)
          } else {
            setNotice({ tone: 'info', message: t('teacher.material.uploadCanceled') })
          }
          return
        case 'unavailable':
          setNotice({ tone: 'error', message: t('teacher.material.uploadUnavailable') })
          return
      }
    } catch (error) {
      setNotice({ tone: 'error', message: describeUploadError(error, t) })
    }
  }

  /** Closing mid-upload asks first; stopping cancels the upload and then closes the sheet. */
  const requestClose = (next: boolean) => {
    if (next) return
    if (!busy) {
      onOpenChange(false)
      return
    }
    setAskStop(true)
  }

  return (
    <>
      <TeachSheet
        open={open}
        onOpenChange={requestClose}
        title={t('teacher.material.title')}
        preventClose={busy}
        onSubmit={() => void submit()}
        footer={
          <Button
            type="submit"
            size="lg"
            className="w-full rounded-full sm:w-auto"
            disabled={busy || add.isPending}
          >
            {add.isPending ? (
              <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden />
            ) : (
              <Paperclip aria-hidden />
            )}
            {t('teacher.material.submit')}
          </Button>
        }
      >
        <Field
          label={t('teacher.material.titleLabel')}
          required
          error={form.formState.errors.title?.message}
        >
          {(a11y) => (
            <Input
              {...a11y}
              autoFocus
              placeholder={t('teacher.material.titlePlaceholder')}
              {...form.register('title')}
            />
          )}
        </Field>
        <Controller
          control={form.control}
          name="type"
          render={({ field }) => (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={typeFieldId}>{t('teacher.material.type')}</Label>
              <SelectField
                id={typeFieldId}
                value={field.value}
                onChange={(value) => field.onChange(value as MaterialType)}
                placeholder={t('teacher.material.type')}
                options={MATERIAL_TYPES.map((type) => ({
                  value: type,
                  label: t(materialTypeLabelKey[type]),
                }))}
              />
            </div>
          )}
        />
        <Field
          label={t('teacher.material.link')}
          required
          hint={t('validation.httpsUrl')}
          error={form.formState.errors.externalUrl?.message}
        >
          {(a11y) => (
            <Input
              {...a11y}
              type="url"
              inputMode="url"
              placeholder={t('teacher.material.linkPlaceholder')}
              {...form.register('externalUrl')}
            />
          )}
        </Field>
        {phase ? (
          <UploadProgress phase={phase} progress={progress} onCancel={cancel} />
        ) : uploadsAvailable ? (
          <div className="flex flex-col gap-2 rounded-xl border border-dashed border-border p-4">
            <p className="text-sm font-medium text-muted-foreground">{t('teacher.material.or')}</p>
            <input
              ref={fileInput}
              type="file"
              accept={UPLOAD_ACCEPT}
              className="sr-only"
              aria-label={t('teacher.material.uploadFile')}
              onChange={(event) => {
                const file = event.target.files?.[0]
                event.target.value = ''
                if (file) void runUpload(file)
              }}
            />
            <Button
              type="button"
              variant="secondary"
              className="w-fit rounded-full"
              onClick={() => fileInput.current?.click()}
            >
              <Upload aria-hidden />
              {t('teacher.material.uploadFile')}
            </Button>
            <p className="text-xs text-muted-foreground">{t('teacher.material.uploadHint')}</p>
          </div>
        ) : null}
        {notice && !busy ? (
          <p
            role="alert"
            className={
              notice.tone === 'error' ? 'text-sm text-danger' : 'text-sm text-muted-foreground'
            }
          >
            {notice.message}
          </p>
        ) : null}
      </TeachSheet>
      <TeachConfirmDialog
        open={askStop}
        onOpenChange={setAskStop}
        title={t('teacher.material.stopTitle')}
        body={<p>{t('teacher.material.stopBody')}</p>}
        confirmLabel={t('teacher.material.stopUpload')}
        cancelLabel={t('teacher.material.keepUploading')}
        destructive
        onConfirm={() => {
          closeAfterCancel.current = true
          cancel()
        }}
      />
    </>
  )
}
