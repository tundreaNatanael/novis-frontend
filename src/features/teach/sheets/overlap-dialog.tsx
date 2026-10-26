import { TeachConfirmDialog } from '../components/confirm-dialog'
import { useT } from '../i18n/use-i18n'

/**
 * After a `409 SCHEDULE_CONFLICT`: the time overlaps another lesson of the teacher or the student.
 * "Book anyway" (or "Move anyway") sends the same request again with `allowOverlap: true`;
 * "Change time" keeps the sheet open as it is (D-045).
 */
export function OverlapDialog({
  open,
  onOpenChange,
  series = false,
  move = false,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  series?: boolean
  move?: boolean
  onConfirm: () => Promise<unknown>
}) {
  const t = useT()
  return (
    <TeachConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('teacher.conflict.title')}
      body={<p>{series ? t('teacher.conflict.bodySeries') : t('teacher.conflict.body')}</p>}
      confirmLabel={move ? t('teacher.conflict.moveAnyway') : t('teacher.conflict.bookAnyway')}
      cancelLabel={t('teacher.conflict.changeTime')}
      onConfirm={onConfirm}
    />
  )
}
