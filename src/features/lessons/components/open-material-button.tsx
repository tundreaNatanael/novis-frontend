import { useMutation } from '@tanstack/react-query'
import { ExternalLink } from 'lucide-react'
import { toast } from 'sonner'
import { errorMessage } from '@/api/errors'
import { materialsApi } from '@/api/materials'
import type { Material } from '@/api/types'
import { Button } from '@/components/ui/button'

/**
 * Opens an uploaded file in a new tab through a fresh signed URL (`GET /materials/{id}/download-url`):
 * it opens inline, so a video plays and a PDF shows in the browser. The tab is opened on the click
 * itself, before the request, so popup blockers let it through; it loses its opener first, since it
 * ends on the storage's origin. A failed request closes it again and says why.
 */
export function OpenMaterialButton({ material }: { material: Material }) {
  const open = useMutation({
    mutationFn: () => materialsApi.downloadUrl(material.id),
  })

  function handleClick() {
    const tab = window.open('', '_blank')
    if (tab) tab.opener = null
    open.mutate(undefined, {
      onSuccess: ({ url }) => {
        if (tab) tab.location.href = url
        else window.open(url, '_blank', 'noopener,noreferrer')
      },
      onError: (error) => {
        tab?.close()
        toast.error(`Could not open ${material.title}`, { description: errorMessage(error) })
      },
    })
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleClick}
      disabled={open.isPending}
      aria-label={`Open ${material.title}`}
    >
      <ExternalLink data-icon="inline-start" />
      Open
    </Button>
  )
}
