import { useCallback, useRef, useState } from 'react'
import { isApiError } from '@/api/errors'
import { materialsApi } from '@/api/materials'
import type { Material } from '@/api/types'
import { useInvalidateMaterials } from '../data/mutations'
import type { Translator } from '../i18n/types'
import { describeError, fieldErrorOf, isApiStatus } from '../lib/error-message'
import { uploadsState } from './uploads-state'
import { uploadContentType, uploadTypeFor } from './utils'

export type UploadTarget = { courseId?: string; lessonId?: string; title?: string }

/** `preparing`: asking for the upload URL; `uploading`: the `PUT` (with progress); `finishing`: `complete`. */
export type UploadPhase = 'preparing' | 'uploading' | 'finishing'

export type UploadResult =
  | { status: 'uploaded'; material: Material }
  /** The teacher cancelled; the pending material is deleted. */
  | { status: 'canceled' }
  /** `501`: no storage provider; uploads are hidden for the session. */
  | { status: 'unavailable' }

/** The storage answered the `PUT` with an error status (an expired URL, a refused content type, CORS…). */
export class UploadFailedError extends Error {
  readonly status: number
  constructor(status: number) {
    super(`Upload failed with HTTP ${status}`)
    this.name = 'UploadFailedError'
    this.status = status
  }
}

/** `PUT`s the bytes to the signed URL with the signed content type, reporting progress; aborts with `signal`. */
function putFile(
  url: string,
  file: File,
  contentType: string,
  onProgress: (fraction: number) => void,
  signal: AbortSignal,
): Promise<number> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', url)
    xhr.setRequestHeader('Content-Type', contentType)
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0)
        onProgress(Math.min(event.loaded / event.total, 1))
    }
    xhr.onload = () => resolve(xhr.status)
    xhr.onerror = () => reject(new UploadFailedError(0))
    xhr.onabort = () => reject(new DOMException('Upload canceled', 'AbortError'))
    signal.addEventListener('abort', () => xhr.abort(), { once: true })
    xhr.send(file)
  })
}

/**
 * The upload flow of API.md §10 in the browser (D-052): `POST /materials/upload-url` (a pending
 * material) → `PUT` the file to the signed URL with the signed `Content-Type` (progress, cancel) →
 * `POST /materials/{id}/complete` → refresh the lists. A failure or a cancel deletes the pending
 * material (the server already did on `UPLOAD_REJECTED`); what still slips through is removed by
 * the server after a day. Behind `VITE_ENABLE_UPLOADS`; a `501` hides uploads for the session.
 */
export function useUploadMaterial() {
  const invalidate = useInvalidateMaterials()
  const [phase, setPhase] = useState<UploadPhase | null>(null)
  const [progress, setProgress] = useState(0)
  const abortRef = useRef<AbortController | null>(null)

  const upload = useCallback(
    async (file: File, target: UploadTarget): Promise<UploadResult> => {
      const abort = new AbortController()
      abortRef.current = abort
      setProgress(0)
      setPhase('preparing')
      let pending: Material | null = null
      try {
        const contentType = uploadContentType(file.type, file.name)
        const created = await materialsApi.createUploadUrl({
          title: target.title?.trim() || file.name,
          type: uploadTypeFor(file.type, file.name),
          fileName: file.name,
          contentType,
          sizeBytes: file.size,
          courseId: target.courseId,
          lessonId: target.lessonId,
        })
        pending = created.material
        if (abort.signal.aborted) throw new DOMException('Upload canceled', 'AbortError')
        setPhase('uploading')
        const status = await putFile(
          created.uploadUrl,
          file,
          created.material.contentType ?? contentType,
          setProgress,
          abort.signal,
        )
        if (status < 200 || status >= 300) throw new UploadFailedError(status)
        setPhase('finishing')
        const material = await materialsApi.complete(created.material.id)
        await invalidate(material)
        return { status: 'uploaded', material }
      } catch (error) {
        if (pending && !(isApiError(error) && error.is('UPLOAD_REJECTED'))) {
          await materialsApi.remove(pending.id).catch(() => undefined)
        }
        if (abort.signal.aborted) return { status: 'canceled' }
        if (isApiStatus(error, 501)) {
          uploadsState.markUnavailable()
          return { status: 'unavailable' }
        }
        throw error
      } finally {
        abortRef.current = null
        setPhase(null)
        setProgress(0)
      }
    },
    [invalidate],
  )

  /** Stops the upload before `complete`; the flow then deletes the pending material. */
  const cancel = useCallback(() => abortRef.current?.abort(), [])

  return { upload, cancel, phase, progress }
}

/** Copy for a failed upload: the limits and the storage's refusal get their own sentence (§10). */
export function describeUploadError(error: unknown, t: Translator): string {
  if (error instanceof UploadFailedError) return t('teacher.material.uploadFailed')
  if (isApiError(error) && error.is('VALIDATION_FAILED')) {
    if (fieldErrorOf(error, 'sizeBytes')) return t('teacher.material.tooLarge')
    if (fieldErrorOf(error, 'contentType')) return t('teacher.material.unsupportedType')
  }
  return describeError(error, t)
}
