import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import { materialsApi } from '@/api/materials'
import type { Material } from '@/api/types'
import { useT } from '../i18n/use-i18n'
import { isApiStatus } from '../lib/error-message'
import { openDeferred, openInNewTab } from '../lib/open-url'
import { useTeachSheets } from '../sheets/use-teach-sheets'
import { playsInApp } from './utils'

/**
 * An uploaded video opens the workspace's player, which fetches its own URL. Everything else opens
 * in a new tab: links directly, other uploaded files through `GET /materials/{id}/download-url`,
 * which opens them inline (`501` until storage is configured).
 */
export function useOpenMaterial() {
  const t = useT()
  const sheets = useTeachSheets()
  const [openingId, setOpeningId] = useState<string | null>(null)

  const open = useCallback(
    async (material: Material) => {
      if (playsInApp(material)) {
        sheets.open({ kind: 'video', materialId: material.id, title: material.title })
        return
      }
      if (material.externalUrl) {
        if (!openInNewTab(material.externalUrl)) toast.error(t('materials.openFailed'))
        return
      }
      const tab = openDeferred()
      setOpeningId(material.id)
      try {
        const signed = await materialsApi.downloadUrl(material.id)
        tab.show(signed.url)
      } catch (error) {
        tab.fail()
        toast.error(
          isApiStatus(error, 501) ? t('materials.fileUnavailable') : t('materials.openFailed'),
        )
      } finally {
        setOpeningId(null)
      }
    },
    [sheets, t],
  )

  return { open, openingId }
}
