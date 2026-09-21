import { describe, expect, it } from 'vitest'
import { computeCrc32, createZipArchive } from './zip'

describe('zip utility', () => {
  it('computes CRC-32 correctly for sample text', () => {
    const textEncoder = new TextEncoder()
    const bytes = textEncoder.encode('123456789')
    // Standard test vector for CRC32 of "123456789" is 0xcbf43926 (3421780262)
    expect(computeCrc32(bytes)).toBe(0xcbf43926)
  })

  it('creates a valid zip blob from text and binary entries', async () => {
    const entries = [
      { path: 'note.md', data: '# Hello World\n' },
      { path: 'folder/sub.md', data: 'Second document' },
      { path: 'folder/sub.attachments/image.png', data: new Uint8Array([0x89, 0x50, 0x4e, 0x47]) },
    ]

    const blob = await createZipArchive(entries)
    expect(blob.size).toBeGreaterThan(100)
    expect(blob.type).toBe('application/zip')

    const arrayBuffer = await blob.arrayBuffer()
    const view = new DataView(arrayBuffer)
    // First 4 bytes of ZIP are PK\x03\x04 (0x04034b50)
    expect(view.getUint32(0, true)).toBe(0x04034b50)
  })
})

