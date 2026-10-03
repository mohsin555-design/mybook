export interface ImageCompressionOptions {
  /** Maximum width or height in pixels. Default is 2048px (high-DPI 2x retina standard). */
  maxDimension?: number
  /** Compression quality (0 to 1). Default is 0.90 for high visual fidelity with ~90% size reduction. */
  quality?: number
}

function readFileAsDataUrl(file: Blob): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read image.'))
    reader.readAsDataURL(file)
  })
}

interface ImageDimensions {
  width: number
  height: number
  draw: (ctx: CanvasRenderingContext2D, width: number, height: number) => void
  cleanup?: () => void
}

async function loadImageDimensions(file: Blob, dataUrl: string): Promise<ImageDimensions | null> {
  // Prefer createImageBitmap if available (faster, off-thread decoding in modern browsers)
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file)
      return {
        width: bitmap.width,
        height: bitmap.height,
        draw: (ctx, width, height) => ctx.drawImage(bitmap, 0, 0, width, height),
        cleanup: () => bitmap.close(),
      }
    } catch {
      // Fall through to Image element fallback
    }
  }

  // Fallback to HTMLImageElement with safety timeout
  return new Promise<ImageDimensions | null>((resolve) => {
    const image = new Image()
    const timer = setTimeout(() => {
      image.onload = null
      image.onerror = null
      resolve(null)
    }, 200)

    image.onload = () => {
      clearTimeout(timer)
      resolve({
        width: image.naturalWidth || image.width,
        height: image.naturalHeight || image.height,
        draw: (ctx, width, height) => ctx.drawImage(image, 0, 0, width, height),
      })
    }
    image.onerror = () => {
      clearTimeout(timer)
      resolve(null)
    }
    image.src = dataUrl
  })
}

/**
 * Compresses an image file client-side before inserting it into a document.
 * - Animated GIFs and vector SVGs are preserved without canvas re-compression.
 * - Large photos/PNGs/JPEGs are proportionally downscaled if exceeding maxDimension (2048px).
 * - Encoded as modern WebP (or JPEG fallback) at high quality (0.90).
 * - Gracefully falls back to raw data URL if canvas or format encoding fails.
 */
export async function compressImageFile(
  file: File | Blob,
  options: ImageCompressionOptions = {}
): Promise<string> {
  const fileType = file.type.toLowerCase()

  // Always preserve GIFs (animations) and SVGs (vector)
  if (fileType === 'image/gif' || fileType === 'image/svg+xml') {
    return readFileAsDataUrl(file)
  }

  // If outside browser environment, fallback
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return readFileAsDataUrl(file)
  }

  const maxDimension = options.maxDimension ?? 2048
  const quality = options.quality ?? 0.9

  try {
    const originalDataUrl = await readFileAsDataUrl(file)
    const loaded = await loadImageDimensions(file, originalDataUrl)

    if (!loaded || !loaded.width || !loaded.height) {
      return originalDataUrl
    }

    try {
      let { width, height } = loaded
      const needsDownscale = width > maxDimension || height > maxDimension

      if (needsDownscale) {
        const scale = Math.min(maxDimension / width, maxDimension / height)
        width = Math.max(1, Math.round(width * scale))
        height = Math.max(1, Math.round(height * scale))
      }

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height

      const ctx = canvas.getContext('2d')
      if (!ctx) {
        return originalDataUrl
      }

      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'
      loaded.draw(ctx, width, height)

      // Try webp first, check if browser supports webp canvas export
      let compressedDataUrl = canvas.toDataURL('image/webp', quality)
      if (!compressedDataUrl.startsWith('data:image/webp')) {
        // Fallback to jpeg
        compressedDataUrl = canvas.toDataURL('image/jpeg', quality)
      }

      // If compression resulted in a larger string (can happen on already optimized tiny images), keep original
      if (compressedDataUrl && compressedDataUrl.length < originalDataUrl.length) {
        return compressedDataUrl
      }

      return originalDataUrl
    } finally {
      loaded.cleanup?.()
    }
  } catch {
    return readFileAsDataUrl(file)
  }
}
