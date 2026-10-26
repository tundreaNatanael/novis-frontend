import { describe, expect, it } from 'vitest'
import { playsInApp, uploadContentType, uploadTypeFor } from './utils'

describe('materials', () => {
  it('plays only uploaded videos in the workspace', () => {
    expect(playsInApp({ type: 'VIDEO', externalUrl: null })).toBe(true)
    expect(playsInApp({ type: 'VIDEO', externalUrl: 'https://youtu.be/x' })).toBe(false)
    expect(playsInApp({ type: 'PDF', externalUrl: null })).toBe(false)
  })

  it('declares the content type the browser reports, else the extension’s', () => {
    expect(uploadContentType('video/quicktime; codecs=hvc1', 'clip.mov')).toBe('video/quicktime')
    expect(uploadContentType('', 'scales.MP4')).toBe('video/mp4')
    expect(uploadContentType('application/octet-stream', 'score.mxl')).toBe(
      'application/vnd.recordare.musicxml',
    )
    expect(uploadContentType(undefined, 'unknown.bin')).toBe('application/octet-stream')
  })

  it('picks the material type from the file', () => {
    expect(uploadTypeFor('video/mp4', 'a.mp4')).toBe('VIDEO')
    expect(uploadTypeFor('image/png', 'a.png')).toBe('IMAGE')
    expect(uploadTypeFor('application/pdf', 'a.pdf')).toBe('PDF')
    expect(uploadTypeFor('', 'etude.musicxml')).toBe('MUSICXML')
    expect(uploadTypeFor('text/xml', 'etude.xml')).toBe('MUSICXML')
  })
})
