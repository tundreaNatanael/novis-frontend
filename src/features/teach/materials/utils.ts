import { FileText, Image, Link, Music, Play, type LucideIcon } from 'lucide-react'
import type { Material, MaterialType } from '@/api/types'
import type { Tone } from '../components/tone'
import type { TranslationKey } from '../i18n/types'

export const materialIcon: Record<MaterialType, LucideIcon> = {
  PDF: FileText,
  IMAGE: Image,
  MUSICXML: Music,
  VIDEO: Play,
  LINK: Link,
}

/** The icon colour per type: scores and PDFs purple, images orange, videos red, links the accent. */
export const materialTone: Record<MaterialType, Tone> = {
  PDF: 'credits',
  MUSICXML: 'credits',
  IMAGE: 'warning',
  VIDEO: 'danger',
  LINK: 'accent',
}

export const materialTypeLabelKey: Record<MaterialType, TranslationKey> = {
  PDF: 'materials.types.PDF',
  IMAGE: 'materials.types.IMAGE',
  MUSICXML: 'materials.types.MUSICXML',
  VIDEO: 'materials.types.VIDEO',
  LINK: 'materials.types.LINK',
}

export const materialTypeShortKey: Record<MaterialType, TranslationKey> = {
  PDF: 'materials.typeShort.PDF',
  IMAGE: 'materials.typeShort.IMAGE',
  MUSICXML: 'materials.typeShort.MUSICXML',
  VIDEO: 'materials.typeShort.VIDEO',
  LINK: 'materials.typeShort.LINK',
}

export const MATERIAL_TYPES: MaterialType[] = ['LINK', 'VIDEO', 'PDF', 'IMAGE', 'MUSICXML']

/** A material that plays in the workspace's own player: an uploaded video (a link video opens in a new tab). */
export function playsInApp(material: Pick<Material, 'type' | 'externalUrl'>): boolean {
  return material.type === 'VIDEO' && material.externalUrl === null
}

export type UploadableType = Exclude<MaterialType, 'LINK'>

/** Content types by file extension, for files the browser reports without one (or as `application/octet-stream`). */
const CONTENT_TYPE_BY_EXTENSION: Record<string, string> = {
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  m4v: 'video/x-m4v',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  heic: 'image/heic',
  webp: 'image/webp',
  gif: 'image/gif',
  pdf: 'application/pdf',
  musicxml: 'application/vnd.recordare.musicxml+xml',
  mxl: 'application/vnd.recordare.musicxml',
  xml: 'application/xml',
}

/** What the file picker offers (API.md §10): the types the API accepts. */
export const UPLOAD_ACCEPT = [
  '.mp4',
  '.mov',
  '.m4v',
  '.pdf',
  '.jpg',
  '.jpeg',
  '.png',
  '.heic',
  '.webp',
  '.gif',
  '.musicxml',
  '.mxl',
  '.xml',
  'video/mp4',
  'video/quicktime',
  'video/x-m4v',
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/heic',
  'image/webp',
  'image/gif',
].join(',')

function extensionOf(fileName: string): string {
  const dot = fileName.lastIndexOf('.')
  return dot < 0 ? '' : fileName.slice(dot + 1).toLowerCase()
}

/**
 * The content type an upload declares (and must then send): the browser's, without parameters,
 * or the extension's when the browser gave none. The API decides whether the type is accepted.
 */
export function uploadContentType(mimeType: string | null | undefined, fileName: string): string {
  const reported = mimeType?.split(';')[0]?.trim().toLowerCase()
  if (reported && reported !== 'application/octet-stream') return reported
  return CONTENT_TYPE_BY_EXTENSION[extensionOf(fileName)] ?? 'application/octet-stream'
}

/** The material type of a picked file: scores by extension, then images and videos by content type, else a PDF. */
export function uploadTypeFor(
  mimeType: string | null | undefined,
  fileName: string,
): UploadableType {
  const extension = extensionOf(fileName)
  const contentType = uploadContentType(mimeType, fileName)
  if (
    extension === 'musicxml' ||
    extension === 'mxl' ||
    extension === 'xml' ||
    contentType.includes('musicxml')
  ) {
    return 'MUSICXML'
  }
  if (contentType.startsWith('image/')) return 'IMAGE'
  if (contentType.startsWith('video/')) return 'VIDEO'
  return 'PDF'
}
