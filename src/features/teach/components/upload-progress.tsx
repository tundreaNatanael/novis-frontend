import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useT } from '../i18n/use-i18n'
import type { UploadPhase } from '../materials/use-upload-material'

/**
 * Where an upload is: preparing, the bytes sent (a bar and a percentage) or finishing, with Cancel
 * until the file has arrived (`complete` is not cancelled).
 */
export function UploadProgress({
  phase,
  progress,
  onCancel,
}: {
  phase: UploadPhase
  progress: number
  onCancel: () => void
}) {
  const t = useT()
  const percent = Math.round(progress * 100)
  const now = phase === 'uploading' ? percent : phase === 'finishing' ? 100 : 0
  const label =
    phase === 'preparing'
      ? t('teacher.material.preparing')
      : phase === 'uploading'
        ? t('teacher.material.uploading', { percent })
        : t('teacher.material.finishing')
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-muted/40 p-4">
      <p className="text-sm font-medium" aria-live="polite">
        {label}
      </p>
      <div
        role="progressbar"
        aria-label={t('teacher.material.progressLabel')}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={now}
        className="h-2 overflow-hidden rounded-full bg-muted"
      >
        <div
          className="h-full rounded-full bg-primary transition-[width]"
          style={{ width: `${now}%` }}
        />
      </div>
      {phase === 'finishing' ? null : (
        <Button type="button" variant="destructive" size="sm" className="w-fit" onClick={onCancel}>
          <X aria-hidden />
          {t('teacher.material.cancelUpload')}
        </Button>
      )}
    </div>
  )
}
