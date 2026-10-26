import { ExternalLink, Loader2, Play, Trash2 } from 'lucide-react'
import type { Material } from '@/api/types'
import { Button } from '@/components/ui/button'
import { useT } from '../i18n/use-i18n'
import { materialIcon, materialTone, materialTypeShortKey, playsInApp } from '../materials/utils'
import { IconBadge } from './icon-badge'
import { ListRow } from './list-row'

/** An uploaded video shows a play icon (it opens the player); anything else opens in a new tab. */
export function MaterialRow({
  material,
  onOpen,
  opening = false,
  onRemove,
}: {
  material: Material
  onOpen: () => void
  opening?: boolean
  onRemove?: () => void
}) {
  const t = useT()
  const OpenIcon = playsInApp(material) ? Play : ExternalLink
  return (
    <ListRow
      title={material.title}
      subtitle={
        material.fileName
          ? `${t(materialTypeShortKey[material.type])} · ${material.fileName}`
          : t(materialTypeShortKey[material.type])
      }
      leading={<IconBadge icon={materialIcon[material.type]} tone={materialTone[material.type]} />}
      onClick={onOpen}
      aria-label={`${t('common.open')}: ${material.title}`}
      chevron={false}
      trailing={
        <>
          {opening ? (
            <Loader2
              className="size-4 animate-spin text-muted-foreground motion-reduce:animate-none"
              aria-hidden
            />
          ) : (
            <OpenIcon className="size-4 text-muted-foreground" aria-hidden />
          )}
          {onRemove ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="text-danger hover:text-danger"
              aria-label={`${t('common.remove')}: ${material.title}`}
              onClick={onRemove}
            >
              <Trash2 aria-hidden />
            </Button>
          ) : null}
        </>
      }
    />
  )
}
