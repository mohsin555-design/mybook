// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'

import { compressImageFile } from './imageCompression'

describe('compressImageFile', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('preserves animated GIFs without canvas re-compression', async () => {
    const gifBlob = new Blob(['GIF89a dummy content'], { type: 'image/gif' })
    const result = await compressImageFile(gifBlob)
    expect(result).toMatch(/^data:image\/gif;base64,/)
  })

  it('preserves SVG files without canvas re-compression', async () => {
    const svgBlob = new Blob(['<svg></svg>'], { type: 'image/svg+xml' })
    const result = await compressImageFile(svgBlob)
    expect(result).toMatch(/^data:image\/svg\+xml;base64,/)
  })

  it('falls back gracefully to raw data url if image decoding fails in test environment', async () => {
    const originalImage = window.Image
    class FailingImage {
      onload: (() => void) | null = null
      onerror: (() => void) | null = null
      set src(_val: string) {
        setTimeout(() => this.onerror?.(), 0)
      }
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    window.Image = FailingImage as any

    const corruptedBlob = new Blob(['corrupted'], { type: 'image/jpeg' })
    const result = await compressImageFile(corruptedBlob)
    expect(result).toMatch(/^data:image\/jpeg;base64,/)

    window.Image = originalImage
  })

  it('uses createImageBitmap to resize and compress when available', async () => {
    const mockBitmap = {
      width: 4000,
      height: 3000,
      close: vi.fn(),
    }
    const windowWithBitmap = window as unknown as { createImageBitmap?: unknown }
    windowWithBitmap.createImageBitmap = vi.fn().mockResolvedValue(mockBitmap)

    const mockToDataUrl = vi.fn().mockReturnValue('data:image/webp;base64,compressed')
    const originalCreateElement = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      if (tagName === 'canvas') {
        const canvas = originalCreateElement('canvas')
        canvas.toDataURL = mockToDataUrl
        canvas.getContext = vi.fn().mockReturnValue({
          drawImage: vi.fn(),
          imageSmoothingEnabled: true,
          imageSmoothingQuality: 'high',
        })
        return canvas
      }
      return originalCreateElement(tagName)
    })

    const largeBlob = new Blob(['large jpeg content that is longer than the mock result'], { type: 'image/jpeg' })
    const result = await compressImageFile(largeBlob, { maxDimension: 2048, quality: 0.9 })

    expect(result).toBe('data:image/webp;base64,compressed')
    expect(mockToDataUrl).toHaveBeenCalledWith('image/webp', 0.9)
    expect(mockBitmap.close).toHaveBeenCalled()

    delete windowWithBitmap.createImageBitmap
  })
})
