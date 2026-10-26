import { Loader2, RotateCw } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { materialsApi } from '@/api/materials'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { useT } from '../i18n/use-i18n'
import { describeError } from '../lib/error-message'

/** A second failure this soon after a fresh URL is the file's, not the URL's: show the error. */
const REFRESH_WINDOW_MS = 60_000

/**
 * Plays an uploaded video from `GET /materials/{id}/download-url` (a signed URL that lasts 6
 * hours) in the browser's own player. When playback fails — the URL expired, the network dropped
 * — it fetches a new URL once and resumes at the same position; a failure again within a minute
 * is shown, with Try again.
 */
export function VideoPlayerDialog({
  materialId,
  title,
  open,
  onOpenChange,
}: {
  materialId: string
  title: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = useT()
  const video = useRef<HTMLVideoElement>(null)
  const [attempt, setAttempt] = useState(0)
  const [src, setSrc] = useState<string | null>(null)
  const [resumeAt, setResumeAt] = useState(0)
  const [error, setError] = useState<{ attempt: number; message: string | null } | null>(null)
  const position = useRef(0)
  const lastRefresh = useRef<number | null>(null)

  useEffect(() => {
    let current = true
    setSrc(null)
    void materialsApi
      .downloadUrl(materialId)
      .then((signed) => {
        if (current) setSrc(signed.url)
      })
      .catch((cause: unknown) => {
        if (current) setError({ attempt, message: describeError(cause, t) })
      })
    return () => {
      current = false
    }
  }, [materialId, attempt, t])

  const onPlaybackError = () => {
    const now = Date.now()
    if (lastRefresh.current !== null && now - lastRefresh.current < REFRESH_WINDOW_MS) {
      setError({ attempt, message: null })
      return
    }
    lastRefresh.current = now
    setResumeAt(position.current)
    setAttempt((value) => value + 1)
  }

  const retry = useCallback(() => {
    lastRefresh.current = Date.now()
    setResumeAt(position.current)
    setError(null)
    setAttempt((value) => value + 1)
  }, [])

  const failed = error !== null && error.attempt === attempt

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[min(96vw,64rem)] bg-black p-0 text-white ring-0 sm:max-w-[min(96vw,64rem)] [&_[data-slot=dialog-close]]:text-white">
        <DialogTitle className="px-4 pt-4 pr-12 text-white">{title}</DialogTitle>
        <DialogDescription className="sr-only">
          {t('materials.player.label', { title })}
        </DialogDescription>
        <div className="relative aspect-video w-full bg-black">
          {src ? (
            <video
              ref={video}
              src={src}
              controls
              autoPlay
              playsInline
              className="size-full"
              aria-label={t('materials.player.label', { title })}
              onLoadedMetadata={(event) => {
                if (resumeAt > 0) event.currentTarget.currentTime = resumeAt
              }}
              onTimeUpdate={(event) => {
                if (event.currentTarget.currentTime > 0)
                  position.current = event.currentTarget.currentTime
              }}
              onError={onPlaybackError}
            />
          ) : null}
          {!src && !failed ? (
            <div className="absolute inset-0 flex items-center justify-center" role="status">
              <Loader2 className="size-8 animate-spin motion-reduce:animate-none" aria-hidden />
              <span className="sr-only">{t('common.loading')}</span>
            </div>
          ) : null}
          {failed ? (
            <div className="absolute inset-0 flex items-center justify-center p-6" role="alert">
              <div className="flex max-w-sm flex-col items-center gap-2 rounded-2xl bg-card p-5 text-center text-card-foreground">
                <p className="font-semibold">{t('materials.player.failedTitle')}</p>
                <p className="text-sm text-muted-foreground">
                  {error?.message ?? t('materials.player.failed')}
                </p>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="rounded-full"
                  onClick={retry}
                >
                  <RotateCw aria-hidden />
                  {t('common.retry')}
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}
